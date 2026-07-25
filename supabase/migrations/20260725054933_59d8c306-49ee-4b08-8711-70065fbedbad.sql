-- =====================================================================
-- Recibo Inteligente v1.7.6 — Encerramento unificado
-- =====================================================================

-- 1) Enum semântico do tipo de encerramento
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'receipt_closure_type') THEN
    CREATE TYPE public.receipt_closure_type AS ENUM (
      'seller_cancelled',
      'buyer_declined',
      'admin_cancelled'
    );
  END IF;
END $$;

-- 2) Novos campos
ALTER TABLE public.smart_receipts
  ADD COLUMN IF NOT EXISTS closure_type public.receipt_closure_type,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid,
  ADD COLUMN IF NOT EXISTS cancelled_by_role text,
  ADD COLUMN IF NOT EXISTS cancellation_reason_code text,
  ADD COLUMN IF NOT EXISTS cancellation_notes text,
  ADD COLUMN IF NOT EXISTS cancellation_origin text,
  ADD COLUMN IF NOT EXISTS previous_status text;

-- 3) Sanitização de dados legados: fechar duplicatas ativas antigas
-- (mantém apenas o processo ativo mais recente por motocicleta)
WITH ranked AS (
  SELECT id, motorcycle_id, status, created_at,
         row_number() OVER (
           PARTITION BY motorcycle_id
           ORDER BY created_at DESC
         ) AS rn
    FROM public.smart_receipts
   WHERE status IN ('draft','issued','awaiting_acceptance')
)
UPDATE public.smart_receipts s
   SET status = 'cancelled',
       previous_status = r.status,
       closure_type = 'admin_cancelled',
       cancelled_by_role = 'system',
       cancellation_reason_code = 'duplicate_process',
       cancellation_origin = 'legacy',
       cancellation_notes = 'Encerrado automaticamente durante migração v1.7.6 — processo duplicado para a mesma motocicleta.',
       cancelled_at = now(),
       cancelled_reason = 'duplicate_process',
       updated_at = now()
  FROM ranked r
 WHERE s.id = r.id
   AND r.rn > 1;

-- 4) Índice parcial: apenas um processo ativo por moto
CREATE UNIQUE INDEX IF NOT EXISTS smart_receipts_one_active_per_moto
  ON public.smart_receipts (motorcycle_id)
  WHERE status IN ('draft','issued','awaiting_acceptance');

-- 5) RPC unificada
CREATE OR REPLACE FUNCTION public.close_smart_receipt_process(
  _id uuid,
  _reason_code text,
  _notes text,
  _origin text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  _uid uuid := auth.uid();
  _r record;
  _is_admin boolean := false;
  _role text;
  _closure public.receipt_closure_type;
  _prev_status text;
  _now timestamptz := now();
  _moto_name text;
  _counter_id uuid;
  _updated integer;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
  END IF;
  IF _id IS NULL THEN
    RAISE EXCEPTION 'ID do processo obrigatório';
  END IF;
  IF _reason_code IS NULL OR btrim(_reason_code) = '' THEN
    RAISE EXCEPTION 'Motivo obrigatório';
  END IF;
  IF _reason_code = 'other' AND (
    _notes IS NULL OR length(btrim(_notes)) < 10
  ) THEN
    RAISE EXCEPTION 'Descrição obrigatória (mínimo 10 caracteres)';
  END IF;
  IF _notes IS NOT NULL AND length(_notes) > 500 THEN
    RAISE EXCEPTION 'Descrição não pode exceder 500 caracteres';
  END IF;

  SELECT r.*, m.brand, m.model, m.nickname
    INTO _r
  FROM public.smart_receipts r
  JOIN public.motorcycles m ON m.id = r.motorcycle_id
  WHERE r.id = _id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Processo não encontrado';
  END IF;

  IF _r.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_cancelled', true,
      'receipt_id', _r.id,
      'code', _r.code,
      'motorcycle_id', _r.motorcycle_id,
      'closure_type', _r.closure_type,
      'previous_status', _r.previous_status,
      'status', _r.status
    );
  END IF;

  IF _r.status IN ('completed', 'revoked', 'superseded') THEN
    RAISE EXCEPTION 'Esta transferência já foi concluída e não pode ser cancelada por esta opção.'
      USING ERRCODE = 'P0001';
  END IF;

  IF _r.status NOT IN ('draft','issued','awaiting_acceptance') THEN
    RAISE EXCEPTION 'Não é possível encerrar no estado %', _r.status;
  END IF;

  _is_admin := public.has_role(_uid, 'admin'::public.app_role);

  IF _uid = _r.seller_id THEN
    _role := 'seller';
    _closure := 'seller_cancelled';
  ELSIF _r.buyer_id IS NOT NULL AND _uid = _r.buyer_id THEN
    _role := 'buyer';
    _closure := 'buyer_declined';
    IF _r.status = 'draft' THEN
      RAISE EXCEPTION 'O comprador não pode recusar um rascunho ainda não emitido.';
    END IF;
  ELSIF _is_admin THEN
    _role := 'admin';
    _closure := 'admin_cancelled';
  ELSE
    RAISE EXCEPTION 'Você não tem permissão para encerrar este processo.'
      USING ERRCODE = '42501';
  END IF;

  _prev_status := _r.status;

  UPDATE public.smart_receipts
     SET status = 'cancelled',
         previous_status = _prev_status,
         closure_type = _closure,
         cancelled_by = _uid,
         cancelled_by_role = _role,
         cancellation_reason_code = _reason_code,
         cancellation_notes = NULLIF(btrim(coalesce(_notes,'')), ''),
         cancellation_origin = NULLIF(btrim(coalesce(_origin,'')), ''),
         cancelled_at = _now,
         cancelled_reason = coalesce(NULLIF(btrim(coalesce(_notes,'')), ''), _reason_code),
         updated_at = _now
   WHERE id = _r.id
     AND status = _prev_status;
  GET DIAGNOSTICS _updated = ROW_COUNT;
  IF _updated = 0 THEN
    RAISE EXCEPTION 'O processo foi alterado por outra ação. Recarregue e tente novamente.'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.audit_log(
    table_name, record_id, motorcycle_id, actor_id, action, old_values, new_values
  ) VALUES (
    'smart_receipts', _r.id, _r.motorcycle_id, _uid, 'update'::public.audit_action,
    jsonb_build_object('status', _prev_status),
    jsonb_build_object(
      'status', 'cancelled',
      'closure_type', _closure,
      'reason_code', _reason_code,
      'notes', NULLIF(btrim(coalesce(_notes,'')), ''),
      'origin', NULLIF(btrim(coalesce(_origin,'')), ''),
      'role', _role
    )
  );

  _moto_name := coalesce(NULLIF(btrim(coalesce(_r.nickname,'')), ''), btrim(_r.brand || ' ' || _r.model));
  _counter_id := CASE
    WHEN _role = 'seller' THEN _r.buyer_id
    WHEN _role = 'buyer'  THEN _r.seller_id
    ELSE NULL
  END;

  IF _counter_id IS NOT NULL AND _counter_id <> _uid THEN
    INSERT INTO public.notifications(user_id, kind, title, body, link)
    VALUES (
      _counter_id,
      'receipt_closed',
      CASE _closure
        WHEN 'seller_cancelled' THEN 'Processo cancelado pelo vendedor'
        WHEN 'buyer_declined'   THEN 'Compra recusada pelo comprador'
        ELSE 'Processo encerrado'
      END,
      CASE _closure
        WHEN 'seller_cancelled' THEN 'O vendedor cancelou o processo de compra e venda da motocicleta ' || _moto_name || '.'
        WHEN 'buyer_declined'   THEN 'O comprador informou que não dará continuidade à compra da motocicleta ' || _moto_name || '.'
        ELSE 'O processo de compra e venda da motocicleta ' || _moto_name || ' foi encerrado.'
      END,
      '/transfers?filter=cancelled&receipt=' || _r.code
    );
  END IF;

  IF _role = 'admin' THEN
    IF _r.seller_id IS NOT NULL AND _r.seller_id <> _uid THEN
      INSERT INTO public.notifications(user_id, kind, title, body, link)
      VALUES (
        _r.seller_id, 'receipt_closed',
        'Processo encerrado administrativamente',
        'O processo de compra e venda da motocicleta ' || _moto_name || ' foi encerrado administrativamente.',
        '/transfers?filter=cancelled&receipt=' || _r.code
      );
    END IF;
    IF _r.buyer_id IS NOT NULL AND _r.buyer_id <> _uid THEN
      INSERT INTO public.notifications(user_id, kind, title, body, link)
      VALUES (
        _r.buyer_id, 'receipt_closed',
        'Processo encerrado administrativamente',
        'O processo de compra e venda da motocicleta ' || _moto_name || ' foi encerrado administrativamente.',
        '/transfers?filter=cancelled&receipt=' || _r.code
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'already_cancelled', false,
    'receipt_id', _r.id,
    'code', _r.code,
    'motorcycle_id', _r.motorcycle_id,
    'closure_type', _closure,
    'previous_status', _prev_status,
    'status', 'cancelled',
    'counterparty_id', _counter_id
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.close_smart_receipt_process(uuid, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.close_smart_receipt_process(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_smart_receipt_process(uuid, text, text, text) TO service_role;

COMMENT ON FUNCTION public.close_smart_receipt_process(uuid, text, text, text) IS
  'Encerra (cancela / recusa / admin) um processo de Compra e Venda. Valida papel, status e concorrência; grava auditoria e notifica contraparte. Idempotente para status=cancelled.';