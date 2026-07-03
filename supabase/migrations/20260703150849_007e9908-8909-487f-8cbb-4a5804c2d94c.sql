
-- 1) Profile columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_homologation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blocked_reason text,
  ADD COLUMN IF NOT EXISTS blocked_notes text,
  ADD COLUMN IF NOT EXISTS blocked_at timestamptz,
  ADD COLUMN IF NOT EXISTS inactive_reason text,
  ADD COLUMN IF NOT EXISTS inactive_notes text,
  ADD COLUMN IF NOT EXISTS inactive_at timestamptz,
  ADD COLUMN IF NOT EXISTS login_provider text;

-- Backfill login_provider from auth.users (best effort)
UPDATE public.profiles p
   SET login_provider = COALESCE(u.raw_app_meta_data->>'provider','email')
  FROM auth.users u
 WHERE u.id = p.id AND p.login_provider IS NULL;

-- 2) Admin user events (immutable audit)
CREATE TABLE IF NOT EXISTS public.admin_user_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id uuid,
  target_snapshot jsonb,
  action text NOT NULL,
  reason text,
  notes text,
  field text,
  old_value jsonb,
  new_value jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_user_events TO authenticated;
GRANT ALL ON public.admin_user_events TO service_role;

ALTER TABLE public.admin_user_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin can read admin_user_events" ON public.admin_user_events;
CREATE POLICY "admin can read admin_user_events" ON public.admin_user_events
  FOR SELECT TO authenticated USING (public.is_user_admin(auth.uid()));

-- Immutable
CREATE OR REPLACE FUNCTION public.admin_user_events_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'admin_user_events is immutable'; END $$;

DROP TRIGGER IF EXISTS admin_user_events_no_change ON public.admin_user_events;
CREATE TRIGGER admin_user_events_no_change
  BEFORE UPDATE OR DELETE ON public.admin_user_events
  FOR EACH ROW EXECUTE FUNCTION public.admin_user_events_immutable();

CREATE INDEX IF NOT EXISTS idx_admin_user_events_target ON public.admin_user_events (target_user_id, created_at DESC);

-- Helper: build profile snapshot
CREATE OR REPLACE FUNCTION public.admin_profile_snapshot(_user uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object(
    'profile', to_jsonb(p),
    'is_admin', public.is_user_admin(p.id),
    'motorcycles', (SELECT count(*) FROM public.motorcycles m WHERE m.owner_id = p.id),
    'documents', (SELECT count(*) FROM public.motorcycle_documents d JOIN public.motorcycles m ON m.id=d.motorcycle_id WHERE m.owner_id = p.id),
    'certificates', (SELECT count(*) FROM public.certificates c JOIN public.motorcycles m ON m.id=c.motorcycle_id WHERE m.owner_id = p.id),
    'events', (SELECT count(*) FROM public.events e JOIN public.motorcycles m ON m.id=e.motorcycle_id WHERE m.owner_id = p.id),
    'tickets', (SELECT count(*) FROM public.tickets t WHERE t.user_id = p.id),
    'messages', (SELECT count(*) FROM public.message_recipients r WHERE r.user_id = p.id)
  ) FROM public.profiles p WHERE p.id = _user
$$;

-- Log helper
CREATE OR REPLACE FUNCTION public.admin_log_event(
  _target uuid, _action text, _reason text DEFAULT NULL, _notes text DEFAULT NULL,
  _field text DEFAULT NULL, _old jsonb DEFAULT NULL, _new jsonb DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb, _snapshot jsonb DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.admin_user_events(actor_id,target_user_id,target_snapshot,action,reason,notes,field,old_value,new_value,metadata)
  VALUES (auth.uid(), _target, _snapshot, _action, _reason, _notes, _field, _old, _new, COALESCE(_metadata,'{}'::jsonb));
END $$;

-- Count active admins helper
CREATE OR REPLACE FUNCTION public.count_active_admins()
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT count(*)::int FROM public.user_roles ur
   JOIN public.profiles p ON p.id = ur.user_id
   WHERE ur.role IN ('admin','USER_ADMIN') AND p.status = 'active'
$$;

-- 3) Full profile update (fields editable by admin)
CREATE OR REPLACE FUNCTION public.admin_update_user(
  _user uuid,
  _full_name text DEFAULT NULL,
  _birth_date date DEFAULT NULL,
  _phone text DEFAULT NULL,
  _email text DEFAULT NULL,
  _plan text DEFAULT NULL,
  _status text DEFAULT NULL,
  _is_admin boolean DEFAULT NULL,
  _is_homologation boolean DEFAULT NULL,
  _reason text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_old public.profiles%ROWTYPE;
  v_was_admin boolean;
  v_new_status public.user_status;
  v_new_plan public.plan_tier;
BEGIN
  IF NOT public.is_user_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO v_old FROM public.profiles WHERE id = _user;
  IF NOT FOUND THEN RAISE EXCEPTION 'Usuário não encontrado'; END IF;
  v_was_admin := public.is_user_admin(_user);

  -- Guard: cannot self-demote from admin
  IF _is_admin IS NOT NULL AND _user = auth.uid() AND v_was_admin AND _is_admin = false THEN
    RAISE EXCEPTION 'Você não pode remover o próprio acesso de administrador';
  END IF;

  -- Guard: cannot remove last active admin
  IF _is_admin IS NOT NULL AND v_was_admin AND _is_admin = false THEN
    IF public.count_active_admins() <= 1 THEN
      RAISE EXCEPTION 'Não é possível remover o último administrador ativo';
    END IF;
  END IF;
  IF _status IS NOT NULL AND v_was_admin AND _status <> 'active' THEN
    IF public.count_active_admins() <= 1 THEN
      RAISE EXCEPTION 'Não é possível desativar o último administrador ativo';
    END IF;
  END IF;

  IF _full_name IS NOT NULL AND _full_name <> COALESCE(v_old.full_name,'') THEN
    UPDATE public.profiles SET full_name = _full_name WHERE id = _user;
    PERFORM public.admin_log_event(_user,'profile_updated',_reason,NULL,'full_name',to_jsonb(v_old.full_name),to_jsonb(_full_name));
  END IF;
  IF _birth_date IS NOT NULL AND _birth_date IS DISTINCT FROM v_old.birth_date THEN
    UPDATE public.profiles SET birth_date = _birth_date WHERE id = _user;
    PERFORM public.admin_log_event(_user,'profile_updated',_reason,NULL,'birth_date',to_jsonb(v_old.birth_date),to_jsonb(_birth_date));
  END IF;
  IF _phone IS NOT NULL AND _phone IS DISTINCT FROM v_old.phone THEN
    UPDATE public.profiles SET phone = _phone WHERE id = _user;
    PERFORM public.admin_log_event(_user,'profile_updated',_reason,NULL,'phone',to_jsonb(v_old.phone),to_jsonb(_phone));
  END IF;
  IF _email IS NOT NULL AND lower(_email) IS DISTINCT FROM lower(COALESCE(v_old.email,'')) THEN
    UPDATE public.profiles SET email = lower(_email) WHERE id = _user;
    PERFORM public.admin_log_event(_user,'email_changed',_reason,NULL,'email',to_jsonb(v_old.email),to_jsonb(lower(_email)));
  END IF;
  IF _plan IS NOT NULL THEN
    v_new_plan := _plan::public.plan_tier;
    IF v_new_plan <> v_old.plan THEN
      UPDATE public.profiles SET plan = v_new_plan, plan_since = now() WHERE id = _user;
      PERFORM public.admin_log_event(_user,'plan_changed',_reason,NULL,'plan',to_jsonb(v_old.plan::text),to_jsonb(v_new_plan::text));
    END IF;
  END IF;
  IF _status IS NOT NULL THEN
    v_new_status := _status::public.user_status;
    IF v_new_status <> v_old.status THEN
      UPDATE public.profiles SET status = v_new_status WHERE id = _user;
      PERFORM public.admin_log_event(_user,'status_changed',_reason,NULL,'status',to_jsonb(v_old.status::text),to_jsonb(v_new_status::text));
    END IF;
  END IF;
  IF _is_admin IS NOT NULL AND _is_admin <> v_was_admin THEN
    IF _is_admin THEN
      INSERT INTO public.user_roles(user_id,role) VALUES (_user,'admin') ON CONFLICT DO NOTHING;
    ELSE
      DELETE FROM public.user_roles WHERE user_id = _user AND role IN ('admin','USER_ADMIN');
    END IF;
    PERFORM public.admin_log_event(_user,'role_changed',_reason,NULL,'is_admin',to_jsonb(v_was_admin),to_jsonb(_is_admin));
  END IF;
  IF _is_homologation IS NOT NULL AND _is_homologation <> v_old.is_homologation THEN
    UPDATE public.profiles SET is_homologation = _is_homologation WHERE id = _user;
    PERFORM public.admin_log_event(_user,'homologation_flag_changed',_reason,NULL,'is_homologation',to_jsonb(v_old.is_homologation),to_jsonb(_is_homologation));
  END IF;

  UPDATE public.profiles SET updated_at = now() WHERE id = _user;
END $$;

-- 4) Block / reactivate / deactivate
CREATE OR REPLACE FUNCTION public.admin_block_user(_user uuid, _reason text, _notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_user_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _user = auth.uid() THEN RAISE EXCEPTION 'Você não pode bloquear a si mesmo'; END IF;
  IF _reason IS NULL OR length(btrim(_reason))<2 THEN RAISE EXCEPTION 'Motivo obrigatório'; END IF;
  IF public.is_user_admin(_user) AND public.count_active_admins() <= 1 THEN
    RAISE EXCEPTION 'Não é possível bloquear o último administrador ativo';
  END IF;
  UPDATE public.profiles SET status='blocked', blocked_reason=_reason, blocked_notes=_notes, blocked_at=now(), updated_at=now() WHERE id=_user;
  PERFORM public.admin_log_event(_user,'blocked',_reason,_notes);
END $$;

CREATE OR REPLACE FUNCTION public.admin_reactivate_user(_user uuid, _notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_user_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.profiles SET status='active', blocked_reason=NULL, blocked_notes=NULL, blocked_at=NULL,
         inactive_reason=NULL, inactive_notes=NULL, inactive_at=NULL, updated_at=now() WHERE id=_user;
  PERFORM public.admin_log_event(_user,'reactivated',NULL,_notes);
END $$;

CREATE OR REPLACE FUNCTION public.admin_deactivate_user(_user uuid, _reason text, _notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_user_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _user = auth.uid() THEN RAISE EXCEPTION 'Você não pode desativar a si mesmo'; END IF;
  IF _reason IS NULL OR length(btrim(_reason))<2 THEN RAISE EXCEPTION 'Motivo obrigatório'; END IF;
  IF public.is_user_admin(_user) AND public.count_active_admins() <= 1 THEN
    RAISE EXCEPTION 'Não é possível desativar o último administrador ativo';
  END IF;
  UPDATE public.profiles SET status='inactive', inactive_reason=_reason, inactive_notes=_notes, inactive_at=now(), updated_at=now() WHERE id=_user;
  PERFORM public.admin_log_event(_user,'deactivated',_reason,_notes);
END $$;

-- 5) Homologation deletion pre-flight snapshot + validation
CREATE OR REPLACE FUNCTION public.admin_prepare_homolog_deletion(_user uuid, _reason text, _confirmation text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_profile public.profiles%ROWTYPE; v_snapshot jsonb;
BEGIN
  IF NOT public.is_user_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _user = auth.uid() THEN RAISE EXCEPTION 'Você não pode excluir a si mesmo'; END IF;
  IF btrim(COALESCE(_confirmation,'')) <> 'EXCLUIR' THEN RAISE EXCEPTION 'Confirmação inválida'; END IF;
  IF _reason IS NULL OR length(btrim(_reason))<2 THEN RAISE EXCEPTION 'Motivo obrigatório'; END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id=_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'Usuário não encontrado'; END IF;
  IF NOT v_profile.is_homologation THEN RAISE EXCEPTION 'Apenas usuários de homologação podem ser excluídos'; END IF;
  IF public.is_user_admin(_user) THEN RAISE EXCEPTION 'Administradores não podem ser excluídos'; END IF;

  v_snapshot := public.admin_profile_snapshot(_user);
  -- Redact CPF and phone
  v_snapshot := jsonb_set(v_snapshot, '{profile,cpf}', to_jsonb(
    CASE WHEN v_profile.cpf IS NULL THEN NULL
    ELSE '***' || right(v_profile.cpf,4) END));
  v_snapshot := jsonb_set(v_snapshot, '{profile,phone}', to_jsonb(
    CASE WHEN v_profile.phone IS NULL THEN NULL
    ELSE left(v_profile.phone,4) || '****' || right(v_profile.phone,2) END));

  PERFORM public.admin_log_event(_user,'homolog_delete_snapshot',_reason,NULL,NULL,NULL,NULL,
    jsonb_build_object('confirmation',_confirmation),v_snapshot);
  RETURN v_snapshot;
END $$;

-- Admin list users v2: include is_homologation + login_provider
DROP FUNCTION IF EXISTS public.admin_list_users(text,text,text,boolean,boolean,timestamptz,timestamptz,int);
CREATE OR REPLACE FUNCTION public.admin_list_users(
  _status text DEFAULT NULL, _plan text DEFAULT NULL, _search text DEFAULT NULL,
  _has_moto boolean DEFAULT NULL, _has_ticket boolean DEFAULT NULL,
  _from timestamptz DEFAULT NULL, _to timestamptz DEFAULT NULL,
  _is_homologation boolean DEFAULT NULL, _has_documents boolean DEFAULT NULL,
  _login_provider text DEFAULT NULL, _role text DEFAULT NULL,
  _limit int DEFAULT 200
) RETURNS TABLE(
  id uuid, full_name text, email text, phone text, cpf text,
  status public.user_status, plan public.plan_tier,
  created_at timestamptz, last_seen_at timestamptz,
  motorcycles_count bigint, open_tickets bigint,
  documents_count bigint, certificates_count bigint, tickets_count bigint,
  is_admin boolean, is_homologation boolean, login_provider text
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_user_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
  SELECT p.id, p.full_name, p.email, p.phone, p.cpf, p.status, p.plan, p.created_at, p.last_seen_at,
    (SELECT count(*) FROM public.motorcycles m WHERE m.owner_id=p.id),
    (SELECT count(*) FROM public.tickets t WHERE t.user_id=p.id AND t.status NOT IN ('closed','cancelled','resolved')),
    (SELECT count(*) FROM public.motorcycle_documents d JOIN public.motorcycles m ON m.id=d.motorcycle_id WHERE m.owner_id=p.id),
    (SELECT count(*) FROM public.certificates c JOIN public.motorcycles m ON m.id=c.motorcycle_id WHERE m.owner_id=p.id),
    (SELECT count(*) FROM public.tickets t WHERE t.user_id=p.id),
    public.is_user_admin(p.id), p.is_homologation, p.login_provider
    FROM public.profiles p
   WHERE (_status IS NULL OR p.status::text = _status)
     AND (_plan IS NULL OR p.plan::text = _plan)
     AND (_search IS NULL OR p.full_name ILIKE '%'||_search||'%' OR p.email ILIKE '%'||_search||'%' OR p.phone ILIKE '%'||_search||'%' OR p.cpf ILIKE '%'||_search||'%')
     AND (_from IS NULL OR p.created_at >= _from)
     AND (_to IS NULL OR p.created_at <= _to)
     AND (_has_moto IS NULL OR (_has_moto = EXISTS(SELECT 1 FROM public.motorcycles m WHERE m.owner_id=p.id)))
     AND (_has_ticket IS NULL OR (_has_ticket = EXISTS(SELECT 1 FROM public.tickets t WHERE t.user_id=p.id AND t.status NOT IN ('closed','cancelled','resolved'))))
     AND (_has_documents IS NULL OR (_has_documents = EXISTS(SELECT 1 FROM public.motorcycle_documents d JOIN public.motorcycles m ON m.id=d.motorcycle_id WHERE m.owner_id=p.id)))
     AND (_is_homologation IS NULL OR p.is_homologation = _is_homologation)
     AND (_login_provider IS NULL OR p.login_provider = _login_provider)
     AND (_role IS NULL OR (_role='admin' AND public.is_user_admin(p.id)) OR (_role='user' AND NOT public.is_user_admin(p.id)))
   ORDER BY p.created_at DESC LIMIT _limit;
END $$;

-- Admin fetch user audit
CREATE OR REPLACE FUNCTION public.admin_user_audit(_user uuid, _limit int DEFAULT 100)
RETURNS SETOF public.admin_user_events LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_user_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY SELECT * FROM public.admin_user_events WHERE target_user_id=_user ORDER BY created_at DESC LIMIT _limit;
END $$;

-- Block route access for non-active users (helper for frontend)
CREATE OR REPLACE FUNCTION public.me_access_status()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object('status', p.status::text, 'blocked_reason', p.blocked_reason, 'inactive_reason', p.inactive_reason)
    FROM public.profiles p WHERE p.id = auth.uid()
$$;
