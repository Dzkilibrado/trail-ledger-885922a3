
-- 1) has_role: exact match only
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = _user_id AND role = _role
  )
$$;

-- 2) admin_set_user_role now writes canonical 'admin' role
CREATE OR REPLACE FUNCTION public.admin_set_user_role(_user uuid, _is_admin boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_user_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _user = auth.uid() AND NOT _is_admin THEN
    RAISE EXCEPTION 'Você não pode remover o próprio acesso de administrador';
  END IF;
  IF _is_admin THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (_user, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = _user AND role IN ('USER_ADMIN', 'admin');
  END IF;
END $$;

-- 3) Public certificate: strip sensitive vehicle identifiers
CREATE OR REPLACE FUNCTION public.get_public_certificate(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cert public.certificates%ROWTYPE;
  v_moto public.motorcycles%ROWTYPE;
  v_moto_public JSONB;
  v_result JSONB;
  v_has_invoice BOOLEAN;
BEGIN
  SELECT * INTO v_cert FROM public.certificates WHERE public_token = _token;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_cert.status <> 'active' THEN RETURN NULL; END IF;
  IF v_cert.expires_at IS NOT NULL AND v_cert.expires_at < now() THEN RETURN NULL; END IF;
  SELECT * INTO v_moto FROM public.motorcycles WHERE id = v_cert.motorcycle_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.motorcycle_documents
    WHERE motorcycle_id = v_moto.id
      AND doc_type = 'invoice'
      AND is_current
      AND deleted_at IS NULL
  ) INTO v_has_invoice;

  -- Redact sensitive identifiers before publishing.
  v_moto_public := to_jsonb(v_moto)
    - 'plate' - 'chassis' - 'engine_number' - 'renavam';

  v_result := jsonb_build_object(
    'certificate', jsonb_build_object(
      'id', v_cert.id,
      'public_token', v_cert.public_token,
      'created_at', v_cert.created_at,
      'expires_at', v_cert.expires_at,
      'status', v_cert.status,
      'audience', v_cert.audience,
      'allowed_sections', v_cert.allowed_sections
    ),
    'motorcycle', v_moto_public,
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
              FROM public.ownership_history h WHERE h.motorcycle_id = v_moto.id), '[]'::jsonb),
    'documents_presence', jsonb_build_object('invoice', v_has_invoice)
  );
  RETURN v_result;
END;
$$;

-- 4) Explicit deny-all INSERT policy on certificate_access_log (writes flow through log_certificate_access SECURITY DEFINER)
DROP POLICY IF EXISTS cal_deny_direct_insert ON public.certificate_access_log;
CREATE POLICY cal_deny_direct_insert ON public.certificate_access_log
  FOR INSERT TO anon, authenticated
  WITH CHECK (false);
COMMENT ON POLICY cal_deny_direct_insert ON public.certificate_access_log IS
  'Inserts are only allowed through log_certificate_access() (SECURITY DEFINER).';

-- 5) Redact ownership_transfers.to_email from recipients: revoke column select and expose a masked view.
REVOKE SELECT (to_email) ON public.ownership_transfers FROM anon, authenticated;

DROP VIEW IF EXISTS public.my_ownership_transfers;
CREATE VIEW public.my_ownership_transfers
WITH (security_invoker = true) AS
SELECT
  id, motorcycle_id, from_user_id, to_user_id,
  CASE WHEN auth.uid() = from_user_id THEN to_email ELSE NULL END AS to_email,
  status, message, requested_at, resolved_at, resolved_by, created_at, updated_at
FROM public.ownership_transfers;

GRANT SELECT ON public.my_ownership_transfers TO authenticated;

-- 6) validate_cpf is an internal helper; not needed via API.
REVOKE EXECUTE ON FUNCTION public.validate_cpf(text) FROM anon, authenticated, PUBLIC;
