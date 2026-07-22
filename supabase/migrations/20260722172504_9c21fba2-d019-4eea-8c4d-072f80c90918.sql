
-- =============================================================================
-- 1) RECOMPOSIÇÃO CRONOLÓGICA ATÔMICA (server-side, com advisory lock por moto)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.recompose_timeline_server(_moto uuid)
RETURNS TABLE(hours_total numeric, km_total numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_h0 numeric;
  v_k0 numeric;
  v_hours numeric;
  v_km numeric;
  r RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT (public.is_moto_owner(_moto) OR public.is_user_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- Advisory lock por moto (transaction-scoped). Serializa recomposições
  -- concorrentes na mesma motocicleta, sem bloquear outras motos.
  PERFORM pg_advisory_xact_lock(hashtextextended(_moto::text, 42));

  SELECT COALESCE(hours_initial, 0), COALESCE(km_initial, 0)
    INTO v_h0, v_k0
    FROM public.motorcycles WHERE id = _moto FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Motocicleta não encontrada'; END IF;

  v_hours := v_h0;
  v_km := v_k0;

  FOR r IN
    SELECT id, hours_delta, km_delta
      FROM public.events
     WHERE motorcycle_id = _moto
     ORDER BY occurred_at ASC, created_at ASC
     FOR UPDATE
  LOOP
    -- Diferenciamos NULL (delta ausente) de 0 (delta explícito).
    -- NULL não altera o acumulado; 0 também não, mas é gravado como tal.
    v_hours := v_hours + COALESCE(r.hours_delta, 0);
    v_km    := v_km    + COALESCE(r.km_delta,    0);
    UPDATE public.events
       SET hours_at_event = v_hours,
           km_at_event    = v_km
     WHERE id = r.id
       AND (hours_at_event IS DISTINCT FROM v_hours OR km_at_event IS DISTINCT FROM v_km);
  END LOOP;

  -- Aplica totais com a mesma regra da RPC existente (respeita baseline).
  PERFORM set_config('trailbook.allow_totals_reduction', 'on', true);
  UPDATE public.motorcycles
     SET hours_total = GREATEST(v_hours, v_h0),
         km_total    = GREATEST(v_km,    v_k0)
   WHERE id = _moto;

  -- Recompõe last_done_* de cada schedule a partir do maintenance_item
  -- mais recente vinculado (ordem cronológica já normalizada).
  UPDATE public.maintenance_schedules s
     SET last_done_at = latest.occurred_at,
         last_done_hours = latest.hours_at_event,
         last_done_km    = latest.km_at_event,
         last_completed_event_id = latest.event_id
    FROM (
      SELECT DISTINCT ON (mi.schedule_id)
             mi.schedule_id, e.id AS event_id,
             e.occurred_at, e.hours_at_event, e.km_at_event
        FROM public.maintenance_items mi
        JOIN public.events e ON e.id = mi.event_id
       WHERE e.motorcycle_id = _moto AND mi.schedule_id IS NOT NULL
       ORDER BY mi.schedule_id, e.occurred_at DESC, e.created_at DESC
    ) latest
   WHERE s.id = latest.schedule_id
     AND s.motorcycle_id = _moto;

  -- Schedules sem nenhum item associado: zera last_done_*.
  UPDATE public.maintenance_schedules s
     SET last_done_at = NULL, last_done_hours = NULL,
         last_done_km = NULL, last_completed_event_id = NULL
   WHERE s.motorcycle_id = _moto
     AND NOT EXISTS (
       SELECT 1 FROM public.maintenance_items mi
        JOIN public.events e ON e.id = mi.event_id
       WHERE mi.schedule_id = s.id AND e.motorcycle_id = _moto
     );

  hours_total := GREATEST(v_hours, v_h0);
  km_total    := GREATEST(v_km,    v_k0);
  RETURN NEXT;
END $$;

GRANT EXECUTE ON FUNCTION public.recompose_timeline_server(uuid) TO authenticated;

-- =============================================================================
-- 2) OPERAÇÕES ATÔMICAS DE ATIVIDADE (INSERT / UPDATE / DELETE + recompose)
--    Cada função executa a mutação e a recomposição na MESMA transação,
--    protegida pelo advisory lock. Snapshots hours_at_event / km_at_event
--    NUNCA são fornecidos pelo cliente — sempre calculados pelo servidor.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.commit_event_and_recompose(
  _moto uuid,
  _type text,
  _title text,
  _description text,
  _location text,
  _occurred_at timestamptz,
  _hours_delta numeric,
  _km_delta numeric,
  _cost numeric,
  _workshop_id uuid DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(event_id uuid, hours_total numeric, km_total numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ev_id uuid;
  v_totals RECORD;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT public.is_moto_owner(_moto) THEN RAISE EXCEPTION 'Forbidden'; END IF;

  -- Validação estrita: diferencia null (ausente) de valor inválido.
  IF _hours_delta IS NOT NULL AND _hours_delta < 0 THEN
    RAISE EXCEPTION 'hours_delta inválido: negativo (%)', _hours_delta;
  END IF;
  IF _km_delta IS NOT NULL AND _km_delta < 0 THEN
    RAISE EXCEPTION 'km_delta inválido: negativo (%)', _km_delta;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_moto::text, 42));

  INSERT INTO public.events (
    motorcycle_id, created_by, type, occurred_at, title, description,
    location, hours_delta, km_delta, cost, workshop_id, metadata
  ) VALUES (
    _moto, v_uid, _type::event_type, _occurred_at, _title,
    NULLIF(_description, ''), NULLIF(_location, ''),
    _hours_delta, _km_delta, _cost, _workshop_id, COALESCE(_metadata, '{}'::jsonb)
  ) RETURNING id INTO v_ev_id;

  -- Recomposição imediata na mesma transação — hours_at_event/km_at_event
  -- do novo evento serão gravados corretamente pela recomposição.
  SELECT * INTO v_totals FROM public.recompose_timeline_server(_moto);

  event_id := v_ev_id;
  hours_total := v_totals.hours_total;
  km_total := v_totals.km_total;
  RETURN NEXT;
END $$;
GRANT EXECUTE ON FUNCTION public.commit_event_and_recompose(uuid,text,text,text,text,timestamptz,numeric,numeric,numeric,uuid,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_event_and_recompose(
  _event_id uuid,
  _title text,
  _description text,
  _occurred_at timestamptz,
  _hours_delta numeric,
  _km_delta numeric,
  _cost numeric
)
RETURNS TABLE(hours_total numeric, km_total numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_moto uuid;
  v_totals RECORD;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT motorcycle_id INTO v_moto FROM public.events WHERE id = _event_id;
  IF v_moto IS NULL THEN RAISE EXCEPTION 'Evento não encontrado'; END IF;
  IF NOT public.is_moto_owner(v_moto) THEN RAISE EXCEPTION 'Forbidden'; END IF;

  IF _hours_delta IS NOT NULL AND _hours_delta < 0 THEN
    RAISE EXCEPTION 'hours_delta inválido: negativo';
  END IF;
  IF _km_delta IS NOT NULL AND _km_delta < 0 THEN
    RAISE EXCEPTION 'km_delta inválido: negativo';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_moto::text, 42));

  UPDATE public.events
     SET title = _title,
         description = NULLIF(_description, ''),
         occurred_at = _occurred_at,
         hours_delta = _hours_delta,
         km_delta    = _km_delta,
         cost        = _cost
   WHERE id = _event_id;

  SELECT * INTO v_totals FROM public.recompose_timeline_server(v_moto);
  hours_total := v_totals.hours_total;
  km_total    := v_totals.km_total;
  RETURN NEXT;
END $$;
GRANT EXECUTE ON FUNCTION public.update_event_and_recompose(uuid,text,text,timestamptz,numeric,numeric,numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_event_and_recompose(_event_id uuid)
RETURNS TABLE(hours_total numeric, km_total numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_moto uuid;
  v_totals RECORD;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT motorcycle_id INTO v_moto FROM public.events WHERE id = _event_id;
  IF v_moto IS NULL THEN RAISE EXCEPTION 'Evento não encontrado'; END IF;
  IF NOT public.is_moto_owner(v_moto) THEN RAISE EXCEPTION 'Forbidden'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_moto::text, 42));

  -- maintenance_items e event_attachments têm ON DELETE CASCADE.
  DELETE FROM public.events WHERE id = _event_id;

  SELECT * INTO v_totals FROM public.recompose_timeline_server(v_moto);
  hours_total := v_totals.hours_total;
  km_total    := v_totals.km_total;
  RETURN NEXT;
END $$;
GRANT EXECUTE ON FUNCTION public.delete_event_and_recompose(uuid) TO authenticated;

-- =============================================================================
-- 3) IDEMPOTÊNCIA FORTE DO RASCUNHO DE RECIBO
--    Garante 1 único draft aberto por (motorcycle_id, seller_id) — impede
--    corrida entre múltiplas abas/dispositivos criando drafts duplicados.
--    Não afeta recibos issued/completed/cancelled (que podem coexistir
--    historicamente com novos drafts para novas negociações).
-- =============================================================================
-- Consolida drafts duplicados existentes (mantém o mais recente).
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY motorcycle_id, seller_id
                            ORDER BY created_at DESC) AS rn
    FROM public.smart_receipts
   WHERE status = 'draft' AND seller_id IS NOT NULL
),
to_cancel AS (
  SELECT id FROM ranked WHERE rn > 1
)
UPDATE public.smart_receipts
   SET status = 'cancelled',
       cancelled_reason = 'Consolidado automaticamente pela migração v1.7 (rascunho duplicado)'
 WHERE id IN (SELECT id FROM to_cancel);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_smart_receipts_one_draft_per_seller_moto
  ON public.smart_receipts (motorcycle_id, seller_id)
  WHERE status = 'draft';

-- =============================================================================
-- 4) DIAGNÓSTICO DE CONSISTÊNCIA DE BASELINE (somente leitura, admin)
--    Classifica cada moto em: consistente | baseline_suspeita |
--    total_abaixo_deltas | historico_insuficiente. NÃO altera dados.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_diagnose_baseline_consistency()
RETURNS TABLE(
  motorcycle_id uuid,
  trailbook_id text,
  brand text,
  model text,
  hours_initial numeric,
  hours_total numeric,
  hours_sum_deltas numeric,
  hours_expected numeric,
  hours_diff numeric,
  km_initial numeric,
  km_total numeric,
  km_sum_deltas numeric,
  km_expected numeric,
  km_diff numeric,
  event_count int,
  classification text,
  recommendation text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_user_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;

  RETURN QUERY
  WITH agg AS (
    SELECT m.id AS moto_id, m.trailbook_id, m.brand, m.model,
           COALESCE(m.hours_initial, 0) AS h0,
           COALESCE(m.hours_total, 0)   AS ht,
           COALESCE(m.km_initial, 0)    AS k0,
           COALESCE(m.km_total, 0)      AS kt,
           COALESCE((SELECT SUM(COALESCE(hours_delta,0)) FROM public.events WHERE motorcycle_id = m.id), 0) AS hsum,
           COALESCE((SELECT SUM(COALESCE(km_delta,0))    FROM public.events WHERE motorcycle_id = m.id), 0) AS ksum,
           (SELECT COUNT(*)::int FROM public.events WHERE motorcycle_id = m.id) AS ec
      FROM public.motorcycles m
  )
  SELECT a.moto_id, a.trailbook_id, a.brand, a.model,
         a.h0, a.ht, a.hsum, (a.h0 + a.hsum) AS h_exp, (a.ht - (a.h0 + a.hsum)) AS h_diff,
         a.k0, a.kt, a.ksum, (a.k0 + a.ksum) AS k_exp, (a.kt - (a.k0 + a.ksum)) AS k_diff,
         a.ec,
         CASE
           WHEN a.ec = 0 AND (a.ht = a.h0 AND a.kt = a.k0) THEN 'consistente_sem_historico'
           WHEN ABS(a.ht - (a.h0 + a.hsum)) < 0.05 AND ABS(a.kt - (a.k0 + a.ksum)) < 0.05 THEN 'consistente'
           WHEN a.ht < a.hsum OR a.kt < a.ksum THEN 'total_abaixo_deltas'
           WHEN a.ht < a.h0 OR a.kt < a.k0 THEN 'total_abaixo_baseline'
           ELSE 'baseline_suspeita'
         END AS classification,
         CASE
           WHEN ABS(a.ht - (a.h0 + a.hsum)) < 0.05 AND ABS(a.kt - (a.k0 + a.ksum)) < 0.05 THEN 'nenhuma'
           WHEN a.ec = 0 THEN 'revisar baseline manualmente'
           ELSE 'rodar recompose_timeline_server e comparar antes/depois'
         END AS recommendation
    FROM agg a
   ORDER BY (ABS(a.ht - (a.h0 + a.hsum)) + ABS(a.kt - (a.k0 + a.ksum))) DESC;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_diagnose_baseline_consistency() TO authenticated;
