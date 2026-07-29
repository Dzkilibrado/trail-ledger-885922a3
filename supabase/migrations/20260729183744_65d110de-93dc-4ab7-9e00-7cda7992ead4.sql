-- =========================================================
-- TrailBook Health — Etapa 3: Check-up Inteligente e Laudo
-- =========================================================

CREATE TYPE public.health_run_status AS ENUM ('started','collecting','processing','previewed','emitted','blocked','failed','abandoned');
CREATE TYPE public.health_report_status AS ENUM ('valid','expiring','outdated','superseded','revoked');
CREATE TYPE public.health_share_preset AS ENUM ('buyer','workshop','custom');

-- ---------------------------------------------------------
-- 1. health_check_runs
-- ---------------------------------------------------------
CREATE TABLE public.health_check_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  motorcycle_id uuid NOT NULL REFERENCES public.motorcycles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status public.health_run_status NOT NULL DEFAULT 'started',
  til_version text,
  rule_version text,
  preview jsonb,
  blockers jsonb NOT NULL DEFAULT '[]'::jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

GRANT SELECT, INSERT, UPDATE ON public.health_check_runs TO authenticated;
GRANT ALL ON public.health_check_runs TO service_role;
ALTER TABLE public.health_check_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "runs_select_own" ON public.health_check_runs FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_moto_owner(motorcycle_id) OR public.is_user_admin(auth.uid()));
CREATE POLICY "runs_insert_own" ON public.health_check_runs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_moto_owner(motorcycle_id));
CREATE POLICY "runs_update_own" ON public.health_check_runs FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX health_check_runs_moto_idx ON public.health_check_runs(motorcycle_id, created_at DESC);

-- ---------------------------------------------------------
-- 2. health_reports
-- ---------------------------------------------------------
CREATE SEQUENCE public.health_report_code_seq;

CREATE TABLE public.health_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  motorcycle_id uuid NOT NULL REFERENCES public.motorcycles(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  issued_by uuid NOT NULL,
  run_id uuid REFERENCES public.health_check_runs(id) ON DELETE SET NULL,
  status public.health_report_status NOT NULL DEFAULT 'valid',
  format_version text NOT NULL DEFAULT 'laudo-1.0.0',
  til_version text NOT NULL,
  rule_version text NOT NULL,
  snapshot_sha256 text NOT NULL,
  overall_status text NOT NULL,
  confidence_level text NOT NULL,
  has_reservations boolean NOT NULL DEFAULT false,
  reservations jsonb NOT NULL DEFAULT '[]'::jsonb,
  critical_count integer NOT NULL DEFAULT 0,
  attention_count integer NOT NULL DEFAULT 0,
  ok_count integer NOT NULL DEFAULT 0,
  unknown_count integer NOT NULL DEFAULT 0,
  conservation_index integer,
  hours_at_issue numeric,
  km_at_issue numeric,
  issued_at timestamptz NOT NULL DEFAULT now(),
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  valid_until timestamptz,
  valid_hours_limit numeric,
  valid_km_limit numeric,
  validity_reason text,
  outdated_at timestamptz,
  outdated_reason text,
  outdated_event_id uuid,
  superseded_by uuid REFERENCES public.health_reports(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  revoked_reason_code text,
  revoked_reason_notes text,
  revoked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.health_reports TO authenticated;
GRANT ALL ON public.health_reports TO service_role;
ALTER TABLE public.health_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_select_own" ON public.health_reports FOR SELECT TO authenticated
  USING (public.is_moto_owner(motorcycle_id) OR owner_id = auth.uid() OR public.is_user_admin(auth.uid()));
CREATE POLICY "reports_insert_own" ON public.health_reports FOR INSERT TO authenticated
  WITH CHECK (issued_by = auth.uid() AND owner_id = auth.uid() AND public.is_moto_owner(motorcycle_id));
CREATE POLICY "reports_update_own" ON public.health_reports FOR UPDATE TO authenticated
  USING (public.is_moto_owner(motorcycle_id) OR public.is_user_admin(auth.uid()))
  WITH CHECK (public.is_moto_owner(motorcycle_id) OR public.is_user_admin(auth.uid()));

CREATE INDEX health_reports_moto_idx ON public.health_reports(motorcycle_id, issued_at DESC);
CREATE INDEX health_reports_owner_idx ON public.health_reports(owner_id, issued_at DESC);

-- código legível
CREATE OR REPLACE FUNCTION public.generate_health_report_code()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    PERFORM pg_advisory_xact_lock(hashtext('health_report_code'));
    NEW.code := 'TB-LAUDO-' || to_char(now(),'YYYY') || '-' ||
                lpad(nextval('public.health_report_code_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER health_reports_generate_code
  BEFORE INSERT ON public.health_reports
  FOR EACH ROW EXECUTE FUNCTION public.generate_health_report_code();

-- imutabilidade do conteúdo emitido
CREATE OR REPLACE FUNCTION public.health_reports_immutable_content()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.code IS DISTINCT FROM OLD.code
     OR NEW.motorcycle_id IS DISTINCT FROM OLD.motorcycle_id
     OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
     OR NEW.issued_by IS DISTINCT FROM OLD.issued_by
     OR NEW.issued_at IS DISTINCT FROM OLD.issued_at
     OR NEW.snapshot_sha256 IS DISTINCT FROM OLD.snapshot_sha256
     OR NEW.til_version IS DISTINCT FROM OLD.til_version
     OR NEW.rule_version IS DISTINCT FROM OLD.rule_version
     OR NEW.format_version IS DISTINCT FROM OLD.format_version
     OR NEW.overall_status IS DISTINCT FROM OLD.overall_status
     OR NEW.confidence_level IS DISTINCT FROM OLD.confidence_level
     OR NEW.critical_count IS DISTINCT FROM OLD.critical_count
     OR NEW.attention_count IS DISTINCT FROM OLD.attention_count
     OR NEW.ok_count IS DISTINCT FROM OLD.ok_count
     OR NEW.unknown_count IS DISTINCT FROM OLD.unknown_count
     OR NEW.hours_at_issue IS DISTINCT FROM OLD.hours_at_issue
     OR NEW.km_at_issue IS DISTINCT FROM OLD.km_at_issue
  THEN
    RAISE EXCEPTION 'Conteúdo do laudo emitido é imutável';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER health_reports_immutable
  BEFORE UPDATE ON public.health_reports
  FOR EACH ROW EXECUTE FUNCTION public.health_reports_immutable_content();

-- ---------------------------------------------------------
-- 3. health_report_snapshots
-- ---------------------------------------------------------
CREATE TABLE public.health_report_snapshots (
  report_id uuid PRIMARY KEY REFERENCES public.health_reports(id) ON DELETE CASCADE,
  format_version text NOT NULL DEFAULT 'laudo-1.0.0',
  payload jsonb NOT NULL,
  sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.health_report_snapshots TO authenticated;
GRANT ALL ON public.health_report_snapshots TO service_role;
ALTER TABLE public.health_report_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "snapshots_select_own" ON public.health_report_snapshots FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.health_reports r WHERE r.id = report_id
                 AND (public.is_moto_owner(r.motorcycle_id) OR public.is_user_admin(auth.uid()))));
CREATE POLICY "snapshots_insert_own" ON public.health_report_snapshots FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.health_reports r WHERE r.id = report_id AND r.issued_by = auth.uid()));

CREATE OR REPLACE FUNCTION public.health_snapshots_immutable()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'A fotografia do laudo é imutável';
END $$;

CREATE TRIGGER health_snapshots_no_update
  BEFORE UPDATE OR DELETE ON public.health_report_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.health_snapshots_immutable();

-- ---------------------------------------------------------
-- 4. health_report_components
-- ---------------------------------------------------------
CREATE TABLE public.health_report_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.health_reports(id) ON DELETE CASCADE,
  schedule_id uuid,
  name text NOT NULL,
  category text NOT NULL,
  status text NOT NULL,
  severity text,
  conclusion text,
  reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  trend text,
  remaining_label text,
  next_action text,
  confidence_level text,
  missing_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_safety_item boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.health_report_components TO authenticated;
GRANT ALL ON public.health_report_components TO service_role;
ALTER TABLE public.health_report_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rcomponents_select_own" ON public.health_report_components FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.health_reports r WHERE r.id = report_id
                 AND (public.is_moto_owner(r.motorcycle_id) OR public.is_user_admin(auth.uid()))));
CREATE POLICY "rcomponents_insert_own" ON public.health_report_components FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.health_reports r WHERE r.id = report_id AND r.issued_by = auth.uid()));

CREATE INDEX health_report_components_report_idx ON public.health_report_components(report_id);

-- ---------------------------------------------------------
-- 5. health_report_recommendations
-- ---------------------------------------------------------
CREATE TABLE public.health_report_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.health_reports(id) ON DELETE CASCADE,
  schedule_id uuid,
  action_group text NOT NULL,
  title text NOT NULL,
  recommendation text NOT NULL,
  status_at_issue text NOT NULL,
  lifecycle_at_issue text NOT NULL,
  due_estimate_label text,
  is_safety_item boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.health_report_recommendations TO authenticated;
GRANT ALL ON public.health_report_recommendations TO service_role;
ALTER TABLE public.health_report_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rrecs_select_own" ON public.health_report_recommendations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.health_reports r WHERE r.id = report_id
                 AND (public.is_moto_owner(r.motorcycle_id) OR public.is_user_admin(auth.uid()))));
CREATE POLICY "rrecs_insert_own" ON public.health_report_recommendations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.health_reports r WHERE r.id = report_id AND r.issued_by = auth.uid()));

CREATE INDEX health_report_recommendations_report_idx ON public.health_report_recommendations(report_id);

-- ---------------------------------------------------------
-- 6. health_report_shares
-- ---------------------------------------------------------
CREATE TABLE public.health_report_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.health_reports(id) ON DELETE CASCADE,
  public_token text NOT NULL UNIQUE,
  preset public.health_share_preset NOT NULL DEFAULT 'custom',
  allowed_sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.health_report_shares TO authenticated;
GRANT ALL ON public.health_report_shares TO service_role;
ALTER TABLE public.health_report_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rshares_select_own" ON public.health_report_shares FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.health_reports r WHERE r.id = report_id
                 AND (public.is_moto_owner(r.motorcycle_id) OR public.is_user_admin(auth.uid()))));
CREATE POLICY "rshares_insert_own" ON public.health_report_shares FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND EXISTS (
    SELECT 1 FROM public.health_reports r WHERE r.id = report_id AND public.is_moto_owner(r.motorcycle_id)));
CREATE POLICY "rshares_update_own" ON public.health_report_shares FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.health_reports r WHERE r.id = report_id
                 AND (public.is_moto_owner(r.motorcycle_id) OR public.is_user_admin(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.health_reports r WHERE r.id = report_id
                 AND (public.is_moto_owner(r.motorcycle_id) OR public.is_user_admin(auth.uid()))));

CREATE INDEX health_report_shares_report_idx ON public.health_report_shares(report_id);

-- ---------------------------------------------------------
-- 7. health_report_access_logs
-- ---------------------------------------------------------
CREATE TABLE public.health_report_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id uuid NOT NULL REFERENCES public.health_report_shares(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES public.health_reports(id) ON DELETE CASCADE,
  accessed_at timestamptz NOT NULL DEFAULT now(),
  result text NOT NULL DEFAULT 'ok',
  ip text,
  user_agent text,
  referer text
);

GRANT SELECT ON public.health_report_access_logs TO authenticated;
GRANT ALL ON public.health_report_access_logs TO service_role;
ALTER TABLE public.health_report_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "raccess_select_own" ON public.health_report_access_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.health_reports r WHERE r.id = report_id
                 AND (public.is_moto_owner(r.motorcycle_id) OR public.is_user_admin(auth.uid()))));

CREATE INDEX health_report_access_logs_report_idx ON public.health_report_access_logs(report_id, accessed_at DESC);

-- ---------------------------------------------------------
-- 8. health_report_events
-- ---------------------------------------------------------
CREATE TABLE public.health_report_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.health_reports(id) ON DELETE CASCADE,
  motorcycle_id uuid NOT NULL,
  kind text NOT NULL,
  description text,
  actor_id uuid,
  source_event_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.health_report_events TO authenticated;
GRANT ALL ON public.health_report_events TO service_role;
ALTER TABLE public.health_report_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "revents_select_own" ON public.health_report_events FOR SELECT TO authenticated
  USING (public.is_moto_owner(motorcycle_id) OR public.is_user_admin(auth.uid()));
CREATE POLICY "revents_insert_own" ON public.health_report_events FOR INSERT TO authenticated
  WITH CHECK (public.is_moto_owner(motorcycle_id) OR public.is_user_admin(auth.uid()));

CREATE INDEX health_report_events_report_idx ON public.health_report_events(report_id, created_at DESC);
CREATE INDEX health_report_events_moto_idx ON public.health_report_events(motorcycle_id, created_at DESC);

-- ---------------------------------------------------------
-- 9. updated_at triggers
-- ---------------------------------------------------------
CREATE TRIGGER health_check_runs_touch BEFORE UPDATE ON public.health_check_runs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER health_report_shares_touch BEFORE UPDATE ON public.health_report_shares
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------------------------------------------------------
-- 10. Acesso público controlado ao laudo compartilhado
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_health_report(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record;
  r record;
  snap jsonb;
BEGIN
  SELECT * INTO s FROM public.health_report_shares WHERE public_token = _token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF s.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'revoked');
  END IF;
  IF s.expires_at IS NOT NULL AND s.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;

  SELECT * INTO r FROM public.health_reports WHERE id = s.report_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF r.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'report_revoked',
      'code', r.code, 'revoked_at', r.revoked_at);
  END IF;

  SELECT payload INTO snap FROM public.health_report_snapshots WHERE report_id = r.id;

  RETURN jsonb_build_object(
    'ok', true,
    'code', r.code,
    'status', r.status,
    'issued_at', r.issued_at,
    'valid_until', r.valid_until,
    'valid_hours_limit', r.valid_hours_limit,
    'valid_km_limit', r.valid_km_limit,
    'outdated_at', r.outdated_at,
    'outdated_reason', r.outdated_reason,
    'sha256', r.snapshot_sha256,
    'format_version', r.format_version,
    'allowed_sections', s.allowed_sections,
    'preset', s.preset,
    'share_id', s.id,
    'snapshot', snap
  );
END $$;

GRANT EXECUTE ON FUNCTION public.get_public_health_report(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_health_report_access(_token text, _result text DEFAULT 'ok', _user_agent text DEFAULT NULL, _referer text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE s record;
BEGIN
  SELECT id, report_id INTO s FROM public.health_report_shares WHERE public_token = _token;
  IF NOT FOUND THEN RETURN; END IF;
  INSERT INTO public.health_report_access_logs (share_id, report_id, result, user_agent, referer)
  VALUES (s.id, s.report_id, coalesce(_result,'ok'), _user_agent, _referer);
END $$;

GRANT EXECUTE ON FUNCTION public.log_health_report_access(text, text, text, text) TO anon, authenticated;

-- ---------------------------------------------------------
-- 11. Validação pública (QR Code) — sem expor conteúdo
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_health_report(_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r record;
BEGIN
  SELECT code, status, issued_at, valid_until, snapshot_sha256, format_version,
         outdated_at, outdated_reason, revoked_at
    INTO r FROM public.health_reports WHERE code = _code;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('exists', false);
  END IF;
  RETURN jsonb_build_object(
    'exists', true,
    'code', r.code,
    'status', r.status,
    'issued_at', r.issued_at,
    'valid_until', r.valid_until,
    'sha256', r.snapshot_sha256,
    'format_version', r.format_version,
    'outdated_at', r.outdated_at,
    'outdated_reason', r.outdated_reason,
    'revoked', r.revoked_at IS NOT NULL
  );
END $$;

GRANT EXECUTE ON FUNCTION public.validate_health_report(text) TO anon, authenticated;

-- ---------------------------------------------------------
-- 12. Desatualização por evento relevante
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mark_health_reports_outdated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  relevant boolean := false;
  label text;
BEGIN
  IF NEW.type IN ('incident','accessory','maintenance','revision','ownership_transfer','recall') THEN
    relevant := true;
  END IF;
  IF NOT relevant THEN RETURN NEW; END IF;

  label := 'Evento relevante registrado: ' || coalesce(NEW.title, NEW.type::text);

  UPDATE public.health_reports r
     SET status = 'outdated',
         outdated_at = now(),
         outdated_reason = label,
         outdated_event_id = NEW.id
   WHERE r.motorcycle_id = NEW.motorcycle_id
     AND r.status IN ('valid','expiring')
     AND r.issued_at < NEW.created_at;

  INSERT INTO public.health_report_events (report_id, motorcycle_id, kind, description, source_event_id)
  SELECT r.id, r.motorcycle_id, 'outdated', label, NEW.id
    FROM public.health_reports r
   WHERE r.motorcycle_id = NEW.motorcycle_id
     AND r.outdated_event_id = NEW.id;

  RETURN NEW;
END $$;

CREATE TRIGGER events_mark_health_reports_outdated
  AFTER INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.mark_health_reports_outdated();