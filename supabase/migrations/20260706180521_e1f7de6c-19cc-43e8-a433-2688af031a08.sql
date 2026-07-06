
CREATE OR REPLACE FUNCTION public.admin_log_view_as_user(_action text, _metadata jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_user_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _action NOT IN ('view_as_user_enter','view_as_user_exit') THEN
    RAISE EXCEPTION 'Invalid action';
  END IF;
  INSERT INTO public.admin_user_events(actor_id, target_user_id, action, metadata)
  VALUES (auth.uid(), auth.uid(), _action, COALESCE(_metadata, '{}'::jsonb));
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_log_view_as_user(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_log_view_as_user(text, jsonb) TO authenticated;
