
-- 1) Revoke public access on internal SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.admin_log_event(uuid, text, text, text, text, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_profile_snapshot(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.emit_system_message(uuid, public.message_type, public.message_subject_key, text, text, public.message_priority, uuid) FROM PUBLIC, anon, authenticated;

-- 2) Fix motorcycle_documents admin SELECT policy: {public} -> {authenticated}
DROP POLICY IF EXISTS docs_select_admin ON public.motorcycle_documents;
CREATE POLICY docs_select_admin
  ON public.motorcycle_documents
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3) admin_user_events policy: use has_role('admin') strictly (drop legacy USER_ADMIN acceptance)
DROP POLICY IF EXISTS "admin can read admin_user_events" ON public.admin_user_events;
CREATE POLICY "admin can read admin_user_events"
  ON public.admin_user_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 4) Set fixed search_path on remaining functions
ALTER FUNCTION public.comm_subject_default(public.message_subject_key, text) SET search_path = public;
ALTER FUNCTION public.admin_user_events_immutable() SET search_path = public;
