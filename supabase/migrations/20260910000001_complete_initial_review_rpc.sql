-- =============================================================
-- RPC: complete_initial_review
-- =============================================================
-- Registra a revisao inicial da motocicleta de forma atomica.
-- GARANTIAS:
--   Toda a operacao ocorre em UMA transacao PostgreSQL.
--   Rollback total em qualquer falha - sem estado parcial.
--   advisory_xact_lock serializa concorrencia por moto.
--   Dupla defesa de idempotencia: initial_review_done_at +
--     evento de revisao existente.
--   Horas/km vem EXCLUSIVAMENTE do banco (hours_total, km_total).
--   Banco valida action de cada schedule via JOIN com
--     maintenance_plan_items.
-- =============================================================

CREATE OR REPLACE FUNCTION public.complete_initial_review(
  _motorcycle_id         uuid,
  _inspected_ids         uuid[],
  _confirmed_service_ids uuid[],
  _unconfirmed_ids       uuid[],
  _mode                  text DEFAULT 'quick_review'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_uid          uuid;
  v_owner_id     uuid;
  v_reviewed_at  timestamptz;
  v_hours        numeric;
  v_km           numeric;
  v_now          timestamptz;
  v_event_id     uuid;
  v_all_ids      uuid[];
  v_count        int;
  v_bad_id       uuid;
BEGIN

  -- 1. Autenticacao
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- 2. Lock por moto (mesmo mecanismo de recompose_timeline_server)
  PERFORM pg_advisory_xact_lock(hashtextextended(_motorcycle_id::text, 42));

  -- 3. Leitura consistente da moto com FOR UPDATE
  -- Horas/km vem EXCLUSIVAMENTE do banco
  SELECT owner_id,
         initial_review_done_at,
         COALESCE(hours_total, 0),
         COALESCE(km_total,    0)
    INTO v_owner_id, v_reviewed_at, v_hours, v_km
    FROM public.motorcycles
   WHERE id = _motorcycle_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'motorcycle_not_found';
  END IF;

  -- 4. Verificar propriedade
  IF v_owner_id IS DISTINCT FROM v_uid
     AND NOT public.is_user_admin(v_uid) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- 5. Idempotencia - defesa 1: initial_review_done_at
  IF v_reviewed_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_reviewed');
  END IF;

  -- 6. Idempotencia - defesa 2: evento de revisao existente
  IF EXISTS (
    SELECT 1 FROM public.events
     WHERE motorcycle_id = _motorcycle_id
       AND type = 'revision'
       AND (metadata->>'review_type') = 'initial'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_reviewed');
  END IF;

  -- 7. Timestamp do servidor
  v_now := now();

  -- 8. Normalizar arrays nulos
  _inspected_ids         := COALESCE(_inspected_ids,         '{}');
  _confirmed_service_ids := COALESCE(_confirmed_service_ids, '{}');
  _unconfirmed_ids       := COALESCE(_unconfirmed_ids,       '{}');

  -- 9. Exclusividade mutua entre grupos
  IF _inspected_ids && _confirmed_service_ids THEN
    RAISE EXCEPTION 'overlap_inspected_vs_confirmed';
  END IF;
  IF _inspected_ids && _unconfirmed_ids THEN
    RAISE EXCEPTION 'overlap_inspected_vs_unconfirmed';
  END IF;
  IF _confirmed_service_ids && _unconfirmed_ids THEN
    RAISE EXCEPTION 'overlap_confirmed_vs_unconfirmed';
  END IF;

  -- 10. Validar elegibilidade dos IDs nesta moto
  v_all_ids := _inspected_ids || _confirmed_service_ids || _unconfirmed_ids;

  IF array_length(v_all_ids, 1) > 0 THEN
    SELECT COUNT(*)
      INTO v_count
      FROM public.maintenance_schedules
     WHERE id = ANY(v_all_ids)
       AND motorcycle_id = _motorcycle_id
       AND status NOT IN ('not_applicable', 'ignored', 'done')
       AND hidden IS NOT TRUE;

    IF v_count <> array_length(v_all_ids, 1) THEN
      RAISE EXCEPTION 'invalid_schedule_ids';
    END IF;
  END IF;

  -- 11. Validar acao dos schedules em _inspected_ids
  -- Somente inspect/check_level sao aceitos; sem action = rejeitado
  IF array_length(_inspected_ids, 1) > 0 THEN
    SELECT s.id INTO v_bad_id
      FROM public.maintenance_schedules s
      LEFT JOIN public.maintenance_plan_items pi ON pi.id = s.template_item_id
     WHERE s.id = ANY(_inspected_ids)
       AND s.motorcycle_id = _motorcycle_id
       AND (
         s.template_item_id IS NULL
         OR pi.id IS NULL
         OR pi.action NOT IN ('inspect', 'check_level')
       )
     LIMIT 1;

    IF FOUND THEN
      RAISE EXCEPTION 'invalid_inspection_action: %', v_bad_id;
    END IF;
  END IF;

  -- 12. Validar acao dos schedules em _confirmed_service_ids
  -- Rejeita inspect/check_level enviados indevidamente neste grupo
  IF array_length(_confirmed_service_ids, 1) > 0 THEN
    SELECT s.id INTO v_bad_id
      FROM public.maintenance_schedules s
      LEFT JOIN public.maintenance_plan_items pi ON pi.id = s.template_item_id
     WHERE s.id = ANY(_confirmed_service_ids)
       AND s.motorcycle_id = _motorcycle_id
       AND pi.action IN ('inspect', 'check_level')
     LIMIT 1;

    IF FOUND THEN
      RAISE EXCEPTION 'invalid_service_action: %', v_bad_id;
    END IF;
  END IF;

  -- 13. Atualizar schedules de inspecao
  IF array_length(_inspected_ids, 1) > 0 THEN
    UPDATE public.maintenance_schedules
       SET status          = 'active',
           last_done_at    = v_now,
           last_done_hours = v_hours,
           last_done_km    = v_km,
           updated_at      = v_now
     WHERE id = ANY(_inspected_ids)
       AND motorcycle_id = _motorcycle_id;
  END IF;

  -- 14. Atualizar schedules de servico fisico confirmados
  IF array_length(_confirmed_service_ids, 1) > 0 THEN
    UPDATE public.maintenance_schedules
       SET status          = 'active',
           last_done_at    = v_now,
           last_done_hours = v_hours,
           last_done_km    = v_km,
           updated_at      = v_now
     WHERE id = ANY(_confirmed_service_ids)
       AND motorcycle_id = _motorcycle_id;
  END IF;

  -- 15. Criar evento de revisao inicial
  -- hours_delta/km_delta = NULL -> nao altera odometro na recomposicao
  INSERT INTO public.events (
    motorcycle_id, created_by, type, title, occurred_at,
    hours_at_event, km_at_event, hours_delta, km_delta, metadata
  ) VALUES (
    _motorcycle_id, v_uid, 'revision', 'Revisao inicial', v_now,
    v_hours, v_km, NULL, NULL,
    jsonb_build_object(
      'review_type',                    'initial',
      'mode',                           _mode,
      'inspected_schedule_ids',         to_jsonb(_inspected_ids),
      'confirmed_service_schedule_ids', to_jsonb(_confirmed_service_ids),
      'unconfirmed_schedule_ids',       to_jsonb(_unconfirmed_ids)
    )
  )
  RETURNING id INTO v_event_id;

  -- 16. Marcar revisao como concluida na moto
  UPDATE public.motorcycles
     SET initial_review_done_at = v_now,
         plan_review_status     = 'reviewed',
         updated_at             = v_now
   WHERE id = _motorcycle_id;

  RETURN jsonb_build_object('ok', true, 'event_id', v_event_id);
END;
$func$;

REVOKE ALL ON FUNCTION public.complete_initial_review(uuid, uuid[], uuid[], uuid[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_initial_review(uuid, uuid[], uuid[], uuid[], text) TO authenticated;
