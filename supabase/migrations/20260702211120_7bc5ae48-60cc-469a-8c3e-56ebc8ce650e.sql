
-- 1) Certificates: remove anon full enumeration; force lookup via get_public_certificate(token)
DROP POLICY IF EXISTS cert_select_public ON public.certificates;

-- 2) Storage: remove anon-read policies on private buckets
DROP POLICY IF EXISTS motorcycle_photos_public_read ON storage.objects;
DROP POLICY IF EXISTS event_media_public_read ON storage.objects;

-- 3) Workshops: hide sensitive columns from authenticated/anon
REVOKE SELECT (cnpj, phone) ON public.workshops FROM authenticated;
REVOKE SELECT (cnpj, phone) ON public.workshops FROM anon;

-- 4) SECURITY DEFINER function exposure: revoke EXECUTE from anon (and authenticated for trigger/internal fns);
--    keep only the intentional public endpoints callable by anon.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;

-- Re-grant to the intended callers.
-- Public (anon) endpoints:
GRANT EXECUTE ON FUNCTION public.get_public_certificate(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_certificate_access(text, text, text, text, text) TO anon, authenticated;

-- Authenticated user endpoints:
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_moto_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_platform_modules() TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_ownership_transfer(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_ownership_transfer(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_ownership_transfer(uuid) TO authenticated;

-- Admin endpoints (self-guarded; keep executable so guard runs)
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text, text, text, boolean, boolean, timestamptz, timestamptz, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_details(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_status(uuid, public.user_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_plan(uuid, public.plan_tier) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_profile(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_module(text, public.module_status, text, timestamptz, text, boolean) TO authenticated;

-- 5) Set a fixed search_path on the only function still missing it.
ALTER FUNCTION public.audit_log_immutable() SET search_path = public;
