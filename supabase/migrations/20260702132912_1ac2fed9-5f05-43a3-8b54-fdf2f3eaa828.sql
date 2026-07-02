CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND (
        role = _role
        OR (_role = 'USER_ADMIN'::public.app_role AND role = 'admin'::public.app_role)
      )
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_user_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('USER_ADMIN'::public.app_role, 'admin'::public.app_role)
  )
$function$;

REVOKE EXECUTE ON FUNCTION public.is_user_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_user_admin(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE r JSONB;
BEGIN
  IF NOT public.is_user_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT jsonb_build_object(
    'users_total',(SELECT count(*) FROM public.profiles),
    'users_active',(SELECT count(*) FROM public.profiles WHERE status='active'),
    'users_pending',(SELECT count(*) FROM public.profiles WHERE status='pending'),
    'users_blocked',(SELECT count(*) FROM public.profiles WHERE status='blocked'),
    'motorcycles_total',(SELECT count(*) FROM public.motorcycles),
    'tickets_open',(SELECT count(*) FROM public.tickets WHERE status IN ('open','in_analysis','in_progress')),
    'tickets_critical',(SELECT count(*) FROM public.tickets WHERE priority='critical' AND status NOT IN ('closed','cancelled','resolved')),
    'tickets_waiting',(SELECT count(*) FROM public.tickets WHERE status='awaiting_user')
  ) INTO r;
  RETURN r;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_list_users(
  _status TEXT DEFAULT NULL, _plan TEXT DEFAULT NULL, _search TEXT DEFAULT NULL,
  _has_moto BOOLEAN DEFAULT NULL, _has_ticket BOOLEAN DEFAULT NULL,
  _from TIMESTAMPTZ DEFAULT NULL, _to TIMESTAMPTZ DEFAULT NULL, _limit INT DEFAULT 200
)
RETURNS TABLE(id UUID, full_name TEXT, email TEXT, phone TEXT, status public.user_status, plan public.plan_tier, created_at TIMESTAMPTZ, last_seen_at TIMESTAMPTZ, motorcycles_count BIGINT, open_tickets BIGINT, is_admin BOOLEAN)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_user_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
  SELECT p.id, p.full_name, p.email, p.phone, p.status, p.plan, p.created_at, p.last_seen_at,
         (SELECT count(*) FROM public.motorcycles m WHERE m.owner_id = p.id),
         (SELECT count(*) FROM public.tickets t WHERE t.user_id = p.id AND t.status NOT IN ('closed','cancelled','resolved')),
         public.is_user_admin(p.id)
    FROM public.profiles p
   WHERE (_status IS NULL OR p.status::text = _status)
     AND (_plan   IS NULL OR p.plan::text  = _plan)
     AND (_search IS NULL OR p.full_name ILIKE '%'||_search||'%' OR p.email ILIKE '%'||_search||'%' OR p.phone ILIKE '%'||_search||'%')
     AND (_from   IS NULL OR p.created_at >= _from)
     AND (_to     IS NULL OR p.created_at <= _to)
     AND (_has_moto IS NULL OR (_has_moto AND EXISTS(SELECT 1 FROM public.motorcycles m WHERE m.owner_id = p.id))
                            OR (NOT _has_moto AND NOT EXISTS(SELECT 1 FROM public.motorcycles m WHERE m.owner_id = p.id)))
     AND (_has_ticket IS NULL OR (_has_ticket AND EXISTS(SELECT 1 FROM public.tickets t WHERE t.user_id = p.id AND t.status NOT IN ('closed','cancelled','resolved')))
                              OR (NOT _has_ticket AND NOT EXISTS(SELECT 1 FROM public.tickets t WHERE t.user_id = p.id AND t.status NOT IN ('closed','cancelled','resolved'))))
   ORDER BY p.created_at DESC LIMIT _limit;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_set_user_role(_user uuid, _is_admin boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_user_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _user = auth.uid() AND NOT _is_admin THEN
    RAISE EXCEPTION 'Você não pode remover o próprio acesso de administrador';
  END IF;
  IF _is_admin THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (_user, 'USER_ADMIN')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = _user AND role IN ('USER_ADMIN', 'admin');
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_set_user_plan(_user uuid, _plan public.plan_tier)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_user_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.profiles SET plan = _plan, plan_since = now(), updated_at = now() WHERE id = _user;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_set_user_status(_user uuid, _status public.user_status)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_user_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.profiles SET status = _status, updated_at = now() WHERE id = _user;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_update_module(
  _key text,
  _status public.module_status,
  _maintenance_message text DEFAULT NULL,
  _maintenance_until timestamptz DEFAULT NULL,
  _maintenance_reason text DEFAULT NULL,
  _hide_when_disabled boolean DEFAULT NULL
)
RETURNS public.platform_modules
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE r public.platform_modules%ROWTYPE;
BEGIN
  IF NOT public.is_user_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.platform_modules
     SET status = _status,
         maintenance_message = _maintenance_message,
         maintenance_until = _maintenance_until,
         maintenance_reason = _maintenance_reason,
         hide_when_disabled = COALESCE(_hide_when_disabled, hide_when_disabled),
         updated_by = auth.uid(),
         updated_at = now()
   WHERE key = _key
   RETURNING * INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'Módulo não encontrado'; END IF;
  RETURN r;
END $function$;

DO $$
DECLARE v_user uuid;
BEGIN
  SELECT id INTO v_user FROM public.profiles WHERE lower(email) = lower('dzkilibrado@gmail.com') LIMIT 1;
  IF v_user IS NOT NULL THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (v_user, 'USER_ADMIN')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;