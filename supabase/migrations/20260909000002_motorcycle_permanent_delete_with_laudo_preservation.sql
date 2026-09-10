-- =====================================================================
-- Migration B: laudos emitidos sobrevivem à exclusão da motocicleta
-- =====================================================================
-- DECISÃO DE PRODUTO: laudo TrailBook formalmente emitido é evidência
-- histórica independente. Deve ser preservado e verificável mesmo após
-- o proprietário excluir a moto da conta.
--
-- MUDANÇAS:
--   1. health_reports.motorcycle_id → nullable + ON DELETE SET NULL
--   2. health_reports_immutable_content() → permite motorcycle_id→NULL
--      somente via variável de sessão app.deleting_motorcycle_id
--   3. RPC delete_motorcycle_permanently → único ponto de exclusão
--   4. RLS: health_reports, tabelas filhas, health_check_runs
--   5. Auditoria mínima da exclusão permanente
-- =====================================================================

BEGIN;

-- ─── 1. motorcycle_id em health_reports: nullable + SET NULL ──────────
ALTER TABLE public.health_reports
  ALTER COLUMN motorcycle_id DROP NOT NULL;

ALTER TABLE public.health_reports
  DROP CONSTRAINT health_reports_motorcycle_id_fkey;

ALTER TABLE public.health_reports
  ADD CONSTRAINT health_reports_motorcycle_id_fkey
    FOREIGN KEY (motorcycle_id)
    REFERENCES public.motorcycles(id)
    ON DELETE SET NULL;

-- ─── 2. Índice para laudos históricos do proprietário ─────────────────
CREATE INDEX IF NOT EXISTS health_reports_owner_history_idx
  ON public.health_reports(owner_id, issued_at DESC)
  WHERE motorcycle_id IS NULL;

-- ─── 3. Trigger de imutabilidade revisado ─────────────────────────────
-- Permite motorcycle_id → NULL somente quando a variável de sessão
-- app.deleting_motorcycle_id coincide com o motorcycle_id do laudo.
-- Todos os demais campos permanecem imutáveis sem exceção.
-- updated_at é atualizado (comportamento já existente — não é conteúdo).
CREATE OR REPLACE FUNCTION public.health_reports_immutable_content()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  _deleting_moto_id text;
BEGIN
  _deleting_moto_id := coalesce(
    current_setting('app.deleting_motorcycle_id', true), ''
  );

  -- motorcycle_id: apenas nulificação por exclusão autorizada
  IF NEW.motorcycle_id IS DISTINCT FROM OLD.motorcycle_id THEN
    IF NOT (
      NEW.motorcycle_id IS NULL
      AND _deleting_moto_id <> ''
      AND _deleting_moto_id = OLD.motorcycle_id::text
    ) THEN
      RAISE EXCEPTION 'Conteúdo do laudo emitido é imutável';
    END IF;
  END IF;

  -- Demais campos de conteúdo: imutáveis sem nenhuma exceção
  IF NEW.code             IS DISTINCT FROM OLD.code
  OR NEW.owner_id         IS DISTINCT FROM OLD.owner_id
  OR NEW.issued_by        IS DISTINCT FROM OLD.issued_by
  OR NEW.issued_at        IS DISTINCT FROM OLD.issued_at
  OR NEW.snapshot_sha256  IS DISTINCT FROM OLD.snapshot_sha256
  OR NEW.til_version      IS DISTINCT FROM OLD.til_version
  OR NEW.rule_version     IS DISTINCT FROM OLD.rule_version
  OR NEW.format_version   IS DISTINCT FROM OLD.format_version
  OR NEW.overall_status   IS DISTINCT FROM OLD.overall_status
  OR NEW.confidence_level IS DISTINCT FROM OLD.confidence_level
  OR NEW.critical_count   IS DISTINCT FROM OLD.critical_count
  OR NEW.attention_count  IS DISTINCT FROM OLD.attention_count
  OR NEW.ok_count         IS DISTINCT FROM OLD.ok_count
  OR NEW.unknown_count    IS DISTINCT FROM OLD.unknown_count
  OR NEW.hours_at_issue   IS DISTINCT FROM OLD.hours_at_issue
  OR NEW.km_at_issue      IS DISTINCT FROM OLD.km_at_issue
  THEN
    RAISE EXCEPTION 'Conteúdo do laudo emitido é imutável';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- ─── 4. RPC de exclusão permanente ────────────────────────────────────
-- SECURITY DEFINER: único ponto que pode definir a variável de sessão.
-- Valida ownership antes de qualquer operação.
-- set_config is_local=true: variável expira ao final da transação.
CREATE OR REPLACE FUNCTION public.delete_motorcycle_permanently(_moto_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner_id uuid;
BEGIN
  SELECT owner_id INTO _owner_id
    FROM public.motorcycles
   WHERE id = _moto_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Motocicleta não encontrada.';
  END IF;

  IF _owner_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Sem permissão para excluir esta motocicleta.';
  END IF;

  -- Contexto de exclusão autorizada (dura apenas nesta transação)
  PERFORM set_config('app.deleting_motorcycle_id', _moto_id::text, true);

  -- DELETE com cascades dentro desta transação:
  --   health_check_runs          → CASCADE (dados de sessão — apagados)
  --   health_reports.motorcycle_id → SET NULL (laudos preservados)
  --   events, schedules, docs, fotos → CASCADE (apagados)
  --   ownership_transfers.motorcycle_id → SET NULL (já existente)
  DELETE FROM public.motorcycles WHERE id = _moto_id;
END $$;

REVOKE ALL ON FUNCTION public.delete_motorcycle_permanently(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_motorcycle_permanently(uuid) TO authenticated;

-- ─── 5. RLS de health_reports ─────────────────────────────────────────
-- SELECT: moto ativa (is_moto_owner) OU proprietário histórico (owner_id)
DROP POLICY IF EXISTS "reports_select_own" ON public.health_reports;
CREATE POLICY "reports_select_own" ON public.health_reports
  FOR SELECT TO authenticated
  USING (
    (motorcycle_id IS NOT NULL AND public.is_moto_owner(motorcycle_id))
    OR owner_id = auth.uid()
    OR public.is_user_admin(auth.uid())
  );

-- UPDATE: permite revogação pelo owner_id histórico (RevokeReportDialog).
-- O trigger de imutabilidade garante que apenas campos permitidos mudem.
DROP POLICY IF EXISTS "reports_update_own" ON public.health_reports;
CREATE POLICY "reports_update_own" ON public.health_reports
  FOR UPDATE TO authenticated
  USING (
    (motorcycle_id IS NOT NULL AND public.is_moto_owner(motorcycle_id))
    OR owner_id = auth.uid()
    OR public.is_user_admin(auth.uid())
  )
  WITH CHECK (
    (motorcycle_id IS NOT NULL AND public.is_moto_owner(motorcycle_id))
    OR owner_id = auth.uid()
    OR public.is_user_admin(auth.uid())
  );

-- health_check_runs SELECT
DROP POLICY IF EXISTS "runs_select_own" ON public.health_check_runs;
CREATE POLICY "runs_select_own" ON public.health_check_runs
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (motorcycle_id IS NOT NULL AND public.is_moto_owner(motorcycle_id))
    OR public.is_user_admin(auth.uid())
  );

-- ─── 6. RLS das tabelas filhas ────────────────────────────────────────
-- Todas adicionam r.owner_id = auth.uid() para acesso histórico.
DROP POLICY IF EXISTS "snapshots_select_own" ON public.health_report_snapshots;
CREATE POLICY "snapshots_select_own" ON public.health_report_snapshots
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.health_reports r WHERE r.id = report_id
    AND (
      (r.motorcycle_id IS NOT NULL AND public.is_moto_owner(r.motorcycle_id))
      OR r.owner_id = auth.uid()
      OR public.is_user_admin(auth.uid())
    )
  ));

DROP POLICY IF EXISTS "rcomponents_select_own" ON public.health_report_components;
CREATE POLICY "rcomponents_select_own" ON public.health_report_components
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.health_reports r WHERE r.id = report_id
    AND (
      (r.motorcycle_id IS NOT NULL AND public.is_moto_owner(r.motorcycle_id))
      OR r.owner_id = auth.uid()
      OR public.is_user_admin(auth.uid())
    )
  ));

DROP POLICY IF EXISTS "rrecs_select_own" ON public.health_report_recommendations;
CREATE POLICY "rrecs_select_own" ON public.health_report_recommendations
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.health_reports r WHERE r.id = report_id
    AND (
      (r.motorcycle_id IS NOT NULL AND public.is_moto_owner(r.motorcycle_id))
      OR r.owner_id = auth.uid()
      OR public.is_user_admin(auth.uid())
    )
  ));

DROP POLICY IF EXISTS "rshares_select_own" ON public.health_report_shares;
CREATE POLICY "rshares_select_own" ON public.health_report_shares
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.health_reports r WHERE r.id = report_id
    AND (
      (r.motorcycle_id IS NOT NULL AND public.is_moto_owner(r.motorcycle_id))
      OR r.owner_id = auth.uid()
      OR public.is_user_admin(auth.uid())
    )
  ));

DROP POLICY IF EXISTS "raccess_select_own" ON public.health_report_access_logs;
CREATE POLICY "raccess_select_own" ON public.health_report_access_logs
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.health_reports r WHERE r.id = report_id
    AND (
      (r.motorcycle_id IS NOT NULL AND public.is_moto_owner(r.motorcycle_id))
      OR r.owner_id = auth.uid()
      OR public.is_user_admin(auth.uid())
    )
  ));

-- health_report_events: motorcycle_id é coluna própria sem FK ativa após exclusão.
-- Acesso via JOIN em health_reports para usar owner_id histórico.
DROP POLICY IF EXISTS "revents_select_own" ON public.health_report_events;
CREATE POLICY "revents_select_own" ON public.health_report_events
  FOR SELECT TO authenticated
  USING (
    public.is_user_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.health_reports r WHERE r.id = report_id
      AND (
        (r.motorcycle_id IS NOT NULL AND public.is_moto_owner(r.motorcycle_id))
        OR r.owner_id = auth.uid()
      )
    )
  );

-- ─── 7. Auditoria mínima da exclusão permanente ────────────────────────
-- Registra apenas dados de identificação — não preserva cópia completa.
-- Campos excluídos intencionalmente: chassi, placa, RENAVAM, nº motor,
-- observações e demais dados detalhados que o usuário solicitou excluir.
CREATE OR REPLACE FUNCTION public.audit_motorcycle_delete()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_log (
    table_name, record_id, motorcycle_id, actor_id, action, old_values, new_values
  ) VALUES (
    'motorcycles',
    OLD.id,
    OLD.id,
    auth.uid(),
    'permanent_delete'::public.audit_action,
    jsonb_build_object(
      'brand',              OLD.brand,
      'model',              OLD.model,
      'year_make',          OLD.year_make,
      'condition',          OLD.condition,
      'had_emitted_laudos', EXISTS (
        SELECT 1 FROM public.health_reports WHERE motorcycle_id = OLD.id
      )
    ),
    NULL
  );
  RETURN OLD;
END $$;

CREATE TRIGGER motorcycles_audit_delete
  BEFORE DELETE ON public.motorcycles
  FOR EACH ROW EXECUTE FUNCTION public.audit_motorcycle_delete();

COMMIT;
