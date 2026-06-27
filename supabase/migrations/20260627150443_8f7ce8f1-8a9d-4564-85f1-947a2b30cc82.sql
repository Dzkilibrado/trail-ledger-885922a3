
-- 1) TrailBook ID
CREATE SEQUENCE IF NOT EXISTS public.trailbook_id_seq;
ALTER TABLE public.motorcycles ADD COLUMN IF NOT EXISTS trailbook_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS motorcycles_trailbook_id_key ON public.motorcycles(trailbook_id);

CREATE OR REPLACE FUNCTION public.generate_trailbook_id()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE n BIGINT;
BEGIN
  IF NEW.trailbook_id IS NULL THEN
    n := nextval('public.trailbook_id_seq');
    NEW.trailbook_id := 'TB-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS moto_trailbook_id ON public.motorcycles;
CREATE TRIGGER moto_trailbook_id BEFORE INSERT ON public.motorcycles
  FOR EACH ROW EXECUTE FUNCTION public.generate_trailbook_id();

-- Backfill
UPDATE public.motorcycles SET trailbook_id =
  'TB-' || to_char(created_at, 'YYYY') || '-' || lpad(nextval('public.trailbook_id_seq')::text, 6, '0')
WHERE trailbook_id IS NULL;

ALTER TABLE public.motorcycles ALTER COLUMN trailbook_id SET NOT NULL;

-- 2) Ownership history
CREATE TYPE public.ownership_method AS ENUM ('creation', 'transfer', 'import');

CREATE TABLE public.ownership_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  motorcycle_id UUID NOT NULL REFERENCES public.motorcycles(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  method public.ownership_method NOT NULL DEFAULT 'transfer',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ownership_history_moto_idx ON public.ownership_history(motorcycle_id, started_at DESC);

GRANT SELECT, INSERT ON public.ownership_history TO authenticated;
GRANT ALL ON public.ownership_history TO service_role;
ALTER TABLE public.ownership_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY oh_select_owner ON public.ownership_history FOR SELECT TO authenticated
  USING (public.is_moto_owner(motorcycle_id) OR owner_id = auth.uid());
CREATE POLICY oh_insert_owner ON public.ownership_history FOR INSERT TO authenticated
  WITH CHECK (public.is_moto_owner(motorcycle_id));

-- Backfill ownership history for existing motorcycles
INSERT INTO public.ownership_history (motorcycle_id, owner_id, started_at, method)
SELECT m.id, m.owner_id, m.created_at, 'creation'
FROM public.motorcycles m
WHERE NOT EXISTS (SELECT 1 FROM public.ownership_history h WHERE h.motorcycle_id = m.id);

-- Auto-insert initial ownership row on motorcycle creation
CREATE OR REPLACE FUNCTION public.bootstrap_ownership()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.ownership_history (motorcycle_id, owner_id, started_at, method)
  VALUES (NEW.id, NEW.owner_id, NEW.created_at, 'creation');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS moto_bootstrap_ownership ON public.motorcycles;
CREATE TRIGGER moto_bootstrap_ownership AFTER INSERT ON public.motorcycles
  FOR EACH ROW EXECUTE FUNCTION public.bootstrap_ownership();

-- 3) Ownership transfers
CREATE TYPE public.transfer_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

CREATE TABLE public.ownership_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  motorcycle_id UUID NOT NULL REFERENCES public.motorcycles(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  to_email TEXT NOT NULL,
  status public.transfer_status NOT NULL DEFAULT 'pending',
  message TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ot_moto_idx ON public.ownership_transfers(motorcycle_id);
CREATE INDEX ot_to_user_idx ON public.ownership_transfers(to_user_id) WHERE status = 'pending';
CREATE UNIQUE INDEX ot_one_pending_per_moto ON public.ownership_transfers(motorcycle_id) WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE ON public.ownership_transfers TO authenticated;
GRANT ALL ON public.ownership_transfers TO service_role;
ALTER TABLE public.ownership_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY ot_select_party ON public.ownership_transfers FOR SELECT TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());
CREATE POLICY ot_insert_owner ON public.ownership_transfers FOR INSERT TO authenticated
  WITH CHECK (from_user_id = auth.uid() AND public.is_moto_owner(motorcycle_id));
CREATE POLICY ot_update_party ON public.ownership_transfers FOR UPDATE TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

CREATE TRIGGER ot_touch BEFORE UPDATE ON public.ownership_transfers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4) Audit log (immutable)
CREATE TYPE public.audit_action AS ENUM ('insert', 'update', 'delete');

CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  motorcycle_id UUID,
  actor_id UUID,
  action public.audit_action NOT NULL,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_moto_idx ON public.audit_log(motorcycle_id, created_at DESC);
CREATE INDEX audit_log_record_idx ON public.audit_log(table_name, record_id);

GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only the current motorcycle owner can read its audit trail
CREATE POLICY audit_select_owner ON public.audit_log FOR SELECT TO authenticated
  USING (motorcycle_id IS NOT NULL AND public.is_moto_owner(motorcycle_id));

-- Block any UPDATE/DELETE through a guard trigger (defense in depth)
CREATE OR REPLACE FUNCTION public.audit_log_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is immutable';
END $$;
CREATE TRIGGER audit_log_no_update BEFORE UPDATE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_immutable();
CREATE TRIGGER audit_log_no_delete BEFORE DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_immutable();

-- Generic audit writer
CREATE OR REPLACE FUNCTION public.write_audit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_moto UUID;
  v_old JSONB;
  v_new JSONB;
  v_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD); v_new := NULL; v_id := OLD.id;
  ELSIF TG_OP = 'INSERT' THEN
    v_old := NULL; v_new := to_jsonb(NEW); v_id := NEW.id;
  ELSE
    v_old := to_jsonb(OLD); v_new := to_jsonb(NEW); v_id := NEW.id;
  END IF;

  IF TG_TABLE_NAME = 'motorcycles' THEN
    v_moto := v_id;
  ELSIF TG_TABLE_NAME = 'events' THEN
    v_moto := COALESCE((v_new->>'motorcycle_id')::uuid, (v_old->>'motorcycle_id')::uuid);
  END IF;

  INSERT INTO public.audit_log (table_name, record_id, motorcycle_id, actor_id, action, old_values, new_values)
  VALUES (TG_TABLE_NAME, v_id, v_moto, auth.uid(), lower(TG_OP)::public.audit_action, v_old, v_new);

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;

CREATE TRIGGER motorcycles_audit AFTER INSERT OR UPDATE OR DELETE ON public.motorcycles
  FOR EACH ROW EXECUTE FUNCTION public.write_audit();
CREATE TRIGGER events_audit AFTER INSERT OR UPDATE OR DELETE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.write_audit();

-- 5) Workshops verified badge
ALTER TABLE public.workshops ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE public.workshops ADD COLUMN IF NOT EXISTS verified_label TEXT;

-- 6) Transfer RPCs
CREATE OR REPLACE FUNCTION public.request_ownership_transfer(_moto_id UUID, _to_email TEXT, _message TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_to UUID;
  v_id UUID;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.motorcycles WHERE id = _moto_id AND owner_id = v_caller) THEN
    RAISE EXCEPTION 'Only the current owner can request a transfer';
  END IF;
  IF EXISTS (SELECT 1 FROM public.ownership_transfers WHERE motorcycle_id = _moto_id AND status = 'pending') THEN
    RAISE EXCEPTION 'There is already a pending transfer for this motorcycle';
  END IF;
  SELECT id INTO v_to FROM auth.users WHERE lower(email) = lower(_to_email) LIMIT 1;
  IF v_to = v_caller THEN RAISE EXCEPTION 'You cannot transfer to yourself'; END IF;

  INSERT INTO public.ownership_transfers (motorcycle_id, from_user_id, to_user_id, to_email, message)
  VALUES (_moto_id, v_caller, v_to, lower(_to_email), _message)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.respond_ownership_transfer(_transfer_id UUID, _approve BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_t public.ownership_transfers%ROWTYPE;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_t FROM public.ownership_transfers WHERE id = _transfer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transfer not found'; END IF;
  IF v_t.status <> 'pending' THEN RAISE EXCEPTION 'Transfer is not pending'; END IF;
  IF v_t.to_user_id IS NULL OR v_t.to_user_id <> v_caller THEN
    RAISE EXCEPTION 'Only the recipient can respond to this transfer';
  END IF;

  IF _approve THEN
    UPDATE public.ownership_history SET ended_at = now()
      WHERE motorcycle_id = v_t.motorcycle_id AND ended_at IS NULL;
    INSERT INTO public.ownership_history (motorcycle_id, owner_id, started_at, method, notes)
      VALUES (v_t.motorcycle_id, v_caller, now(), 'transfer', v_t.message);
    UPDATE public.motorcycles SET owner_id = v_caller WHERE id = v_t.motorcycle_id;
    UPDATE public.ownership_transfers SET status = 'approved', resolved_at = now(), resolved_by = v_caller
      WHERE id = _transfer_id;
  ELSE
    UPDATE public.ownership_transfers SET status = 'rejected', resolved_at = now(), resolved_by = v_caller
      WHERE id = _transfer_id;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_ownership_transfer(_transfer_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_t public.ownership_transfers%ROWTYPE;
BEGIN
  SELECT * INTO v_t FROM public.ownership_transfers WHERE id = _transfer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transfer not found'; END IF;
  IF v_t.from_user_id <> v_caller THEN RAISE EXCEPTION 'Only sender can cancel'; END IF;
  IF v_t.status <> 'pending' THEN RAISE EXCEPTION 'Transfer is not pending'; END IF;
  UPDATE public.ownership_transfers SET status = 'cancelled', resolved_at = now(), resolved_by = v_caller
    WHERE id = _transfer_id;
END $$;

-- 7) Update public certificate RPC to expose TrailBook ID and ownership timeline
CREATE OR REPLACE FUNCTION public.get_public_certificate(_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cert public.certificates%ROWTYPE;
  v_moto public.motorcycles%ROWTYPE;
  v_result JSONB;
BEGIN
  SELECT * INTO v_cert FROM public.certificates WHERE public_token = _token;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_cert.status <> 'active' THEN RETURN NULL; END IF;
  IF v_cert.expires_at IS NOT NULL AND v_cert.expires_at < now() THEN RETURN NULL; END IF;
  SELECT * INTO v_moto FROM public.motorcycles WHERE id = v_cert.motorcycle_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_result := jsonb_build_object(
    'certificate', jsonb_build_object(
      'public_token', v_cert.public_token,
      'created_at', v_cert.created_at,
      'expires_at', v_cert.expires_at,
      'status', v_cert.status,
      'allowed_sections', v_cert.allowed_sections
    ),
    'motorcycle', to_jsonb(v_moto),
    'owner', (SELECT jsonb_build_object('full_name', full_name, 'avatar_url', avatar_url)
              FROM public.profiles WHERE id = v_moto.owner_id),
    'events', COALESCE((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.occurred_at DESC)
              FROM public.events e WHERE e.motorcycle_id = v_moto.id), '[]'::jsonb),
    'schedules', COALESCE((SELECT jsonb_agg(to_jsonb(s))
              FROM public.maintenance_schedules s WHERE s.motorcycle_id = v_moto.id AND s.active), '[]'::jsonb),
    'attachments', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'id', a.id, 'event_id', a.event_id, 'bucket', a.bucket,
                'storage_path', a.storage_path, 'kind', a.kind, 'caption', a.caption))
              FROM public.event_attachments a JOIN public.events e ON e.id = a.event_id
              WHERE e.motorcycle_id = v_moto.id), '[]'::jsonb),
    'workshops', COALESCE((SELECT jsonb_agg(DISTINCT jsonb_build_object(
                'id', w.id, 'name', w.name, 'city', w.city,
                'verified', w.verified, 'verified_label', w.verified_label))
              FROM public.workshops w JOIN public.events e ON e.workshop_id = w.id
              WHERE e.motorcycle_id = v_moto.id), '[]'::jsonb),
    'ownership', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'id', h.id, 'started_at', h.started_at, 'ended_at', h.ended_at,
                'method', h.method,
                'owner_name', (SELECT full_name FROM public.profiles WHERE id = h.owner_id)
              ) ORDER BY h.started_at)
              FROM public.ownership_history h WHERE h.motorcycle_id = v_moto.id), '[]'::jsonb)
  );

  RETURN v_result;
END;
$$;
