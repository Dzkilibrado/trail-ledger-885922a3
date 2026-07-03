-- Normalize admin permission checks: older admin_* functions checked only 'admin'
-- role, but is_user_admin() also accepts 'USER_ADMIN'. This caused
-- admin_user_details (and other older admin RPCs) to raise Forbidden for
-- USER_ADMIN accounts, leaving the frontend drawer stuck in loading.

CREATE OR REPLACE FUNCTION public.admin_user_details(_user uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE r JSONB;
BEGIN
  IF NOT public.is_user_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT jsonb_build_object(
    'profile', (SELECT to_jsonb(p) FROM public.profiles p WHERE p.id = _user),
    'is_admin', public.is_user_admin(_user),
    'motorcycles', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', m.id, 'trailbook_id', m.trailbook_id, 'brand', m.brand,
        'model', m.model, 'year', m.year, 'created_at', m.created_at
      ) ORDER BY m.created_at DESC) FROM public.motorcycles m WHERE m.owner_id = _user), '[]'::jsonb),
    'documents', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', d.id, 'motorcycle_id', d.motorcycle_id, 'doc_type', d.doc_type,
        'file_name', d.file_name, 'created_at', d.created_at, 'deleted_at', d.deleted_at
      ) ORDER BY d.created_at DESC)
      FROM public.motorcycle_documents d
      JOIN public.motorcycles m ON m.id = d.motorcycle_id
      WHERE m.owner_id = _user), '[]'::jsonb),
    'certificates', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'motorcycle_id', c.motorcycle_id, 'public_token', c.public_token,
        'status', c.status, 'created_at', c.created_at, 'expires_at', c.expires_at
      ) ORDER BY c.created_at DESC)
      FROM public.certificates c
      JOIN public.motorcycles m ON m.id = c.motorcycle_id
      WHERE m.owner_id = _user), '[]'::jsonb),
    'tickets', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', t.id, 'code', t.code, 'subject', t.subject, 'status', t.status,
        'priority', t.priority, 'created_at', t.created_at
      ) ORDER BY t.created_at DESC)
      FROM public.tickets t WHERE t.user_id = _user), '[]'::jsonb)
  ) INTO r;
  RETURN r;
END $$;

-- Generic guard rewrite for the remaining older admin_* functions.
-- We only replace the guard clause, keeping their bodies intact.
DO $mig$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'admin_update_profile','admin_update_help_request','admin_get_comm_settings',
    'admin_list_help_requests','admin_update_comm_settings',
    'admin_send_message','admin_reply_message','admin_list_messages',
    'admin_list_deliveries','admin_message_thread'
  ];
  def text;
  new_def text;
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    SELECT pg_get_functiondef(p.oid) INTO def
    FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname=fn LIMIT 1;
    IF def IS NULL THEN CONTINUE; END IF;
    new_def := replace(def, 'has_role(auth.uid(),''admin'')', 'is_user_admin(auth.uid())');
    new_def := replace(new_def, 'has_role(auth.uid(), ''admin'')', 'is_user_admin(auth.uid())');
    new_def := replace(new_def, 'public.has_role(auth.uid(),''admin'')', 'public.is_user_admin(auth.uid())');
    new_def := replace(new_def, 'public.has_role(auth.uid(), ''admin'')', 'public.is_user_admin(auth.uid())');
    IF new_def <> def THEN
      EXECUTE new_def;
    END IF;
  END LOOP;
END $mig$;

-- comm_expand_audience is a helper; align it too so audience filters work for USER_ADMIN
DO $mig$
DECLARE def text; new_def text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO def FROM pg_proc
   WHERE pronamespace='public'::regnamespace AND proname='comm_expand_audience' LIMIT 1;
  IF def IS NULL THEN RETURN; END IF;
  new_def := replace(def, 'has_role(auth.uid(),''admin'')', 'is_user_admin(auth.uid())');
  new_def := replace(new_def, 'has_role(auth.uid(), ''admin'')', 'is_user_admin(auth.uid())');
  new_def := replace(new_def, 'public.has_role(auth.uid(),''admin'')', 'public.is_user_admin(auth.uid())');
  new_def := replace(new_def, 'public.has_role(auth.uid(), ''admin'')', 'public.is_user_admin(auth.uid())');
  IF new_def <> def THEN EXECUTE new_def; END IF;
END $mig$;