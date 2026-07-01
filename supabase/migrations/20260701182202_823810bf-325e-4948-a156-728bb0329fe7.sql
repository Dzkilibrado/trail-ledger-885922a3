
DO $$ BEGIN CREATE TYPE public.user_status AS ENUM ('active','pending','blocked','inactive'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status public.user_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

UPDATE public.profiles p SET email = u.email
  FROM auth.users u WHERE p.id = u.id AND p.email IS NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, email)
  VALUES (NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $fn$;

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
CREATE POLICY "Admins can update profiles" ON public.profiles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view all motorcycles" ON public.motorcycles;
CREATE POLICY "Admins can view all motorcycles" ON public.motorcycles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage user_roles" ON public.user_roles;
CREATE POLICY "Admins manage user_roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins view audit" ON public.audit_log;
CREATE POLICY "Admins view audit" ON public.audit_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DO $$ BEGIN CREATE TYPE public.ticket_type AS ENUM ('bug','question','moto','certificate','billing','suggestion','admin_request','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.ticket_priority AS ENUM ('low','medium','high','critical'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.ticket_status AS ENUM ('open','in_analysis','awaiting_user','in_progress','resolved','closed','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.ticket_module AS ENUM ('dashboard','motorcycle','agenda','maintenance','financial','certificate','transfer','documentation','workshop','account','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  motorcycle_id UUID REFERENCES public.motorcycles(id) ON DELETE SET NULL,
  type public.ticket_type NOT NULL DEFAULT 'other',
  module public.ticket_module NOT NULL DEFAULT 'other',
  priority public.ticket_priority NOT NULL DEFAULT 'medium',
  status public.ticket_status NOT NULL DEFAULT 'open',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own tickets" ON public.tickets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users create own tickets" ON public.tickets
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own tickets" ON public.tickets
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS idx_tickets_user ON public.tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON public.tickets(assigned_to);
CREATE TRIGGER trg_tickets_touch BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE SEQUENCE IF NOT EXISTS public.ticket_code_seq;
CREATE OR REPLACE FUNCTION public.generate_ticket_code()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $fn$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := 'TB-T-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.ticket_code_seq')::text,6,'0');
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER trg_tickets_code BEFORE INSERT ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.generate_ticket_code();

CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ticket_messages TO authenticated;
GRANT ALL ON public.ticket_messages TO service_role;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See ticket messages" ON public.ticket_messages
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid() AND is_internal = false)
  );
CREATE POLICY "Create ticket messages" ON public.ticket_messages
  FOR INSERT TO authenticated WITH CHECK (
    author_id = auth.uid()
    AND (public.has_role(auth.uid(),'admin')
         OR (is_internal = false AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())))
  );
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON public.ticket_messages(ticket_id);

CREATE TABLE IF NOT EXISTS public.ticket_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.ticket_messages(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket TEXT NOT NULL DEFAULT 'ticket-attachments',
  storage_path TEXT NOT NULL,
  file_name TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.ticket_attachments TO authenticated;
GRANT ALL ON public.ticket_attachments TO service_role;
ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "See ticket attachments" ON public.ticket_attachments
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())
  );
CREATE POLICY "Create ticket attachments" ON public.ticket_attachments
  FOR INSERT TO authenticated WITH CHECK (
    uploaded_by = auth.uid()
    AND (public.has_role(auth.uid(),'admin')
         OR EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid()))
  );
CREATE POLICY "Delete ticket attachments" ON public.ticket_attachments
  FOR DELETE TO authenticated USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, read_at);

CREATE OR REPLACE FUNCTION public.tickets_workflow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO public.notifications(user_id,kind,title,body,link)
    VALUES (NEW.user_id,'ticket_created','Chamado recebido',
            'Seu chamado ' || COALESCE(NEW.code,'') || ' foi recebido e está em análise.',
            '/tickets/'||NEW.id::text);
    RETURN NEW;
  END IF;
  IF NEW.status <> OLD.status THEN
    NEW.last_activity_at := now();
    IF NEW.status='resolved' AND NEW.resolved_at IS NULL THEN NEW.resolved_at := now(); END IF;
    IF NEW.status='closed'   AND NEW.closed_at   IS NULL THEN NEW.closed_at   := now(); END IF;
    INSERT INTO public.notifications(user_id,kind,title,body,link)
    VALUES (NEW.user_id,'ticket_status','Chamado '||COALESCE(NEW.code,''),
            'Novo status: '||NEW.status::text,'/tickets/'||NEW.id::text);
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER trg_tickets_workflow_ins AFTER INSERT ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.tickets_workflow();
CREATE TRIGGER trg_tickets_workflow_upd BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.tickets_workflow();

CREATE OR REPLACE FUNCTION public.ticket_message_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_t public.tickets%ROWTYPE;
BEGIN
  SELECT * INTO v_t FROM public.tickets WHERE id = NEW.ticket_id;
  UPDATE public.tickets SET last_activity_at = now() WHERE id = NEW.ticket_id;
  IF NEW.is_internal THEN RETURN NEW; END IF;
  IF NEW.author_id = v_t.user_id THEN
    IF v_t.assigned_to IS NOT NULL THEN
      INSERT INTO public.notifications(user_id,kind,title,body,link)
      VALUES (v_t.assigned_to,'ticket_reply','Nova resposta do usuário',
              'Chamado '||COALESCE(v_t.code,''),'/admin/tickets/'||v_t.id::text);
    END IF;
  ELSE
    INSERT INTO public.notifications(user_id,kind,title,body,link)
    VALUES (v_t.user_id,'ticket_reply','Nova resposta no seu chamado',
            'Chamado '||COALESCE(v_t.code,''),'/tickets/'||v_t.id::text);
  END IF;
  RETURN NEW;
END $fn$;
CREATE TRIGGER trg_ticket_message_notify AFTER INSERT ON public.ticket_messages FOR EACH ROW EXECUTE FUNCTION public.ticket_message_notify();

CREATE OR REPLACE FUNCTION public.admin_set_user_status(_user UUID, _status public.user_status)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _user = auth.uid() AND _status IN ('blocked','inactive') THEN
    RAISE EXCEPTION 'Você não pode bloquear ou desativar a própria conta';
  END IF;
  UPDATE public.profiles SET status = _status, updated_at = now() WHERE id = _user;
END $fn$;

CREATE OR REPLACE FUNCTION public.admin_set_user_plan(_user UUID, _plan public.plan_tier)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.profiles SET plan = _plan, plan_since = now(), updated_at = now() WHERE id = _user;
END $fn$;

CREATE OR REPLACE FUNCTION public.admin_update_profile(_user UUID, _full_name TEXT, _phone TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.profiles SET full_name = COALESCE(_full_name, full_name),
                              phone = COALESCE(_phone, phone),
                              updated_at = now()
   WHERE id = _user;
END $fn$;

CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE r JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
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
END $fn$;

CREATE OR REPLACE FUNCTION public.admin_list_users(
  _status TEXT DEFAULT NULL, _plan TEXT DEFAULT NULL, _search TEXT DEFAULT NULL,
  _has_moto BOOLEAN DEFAULT NULL, _has_ticket BOOLEAN DEFAULT NULL,
  _from TIMESTAMPTZ DEFAULT NULL, _to TIMESTAMPTZ DEFAULT NULL, _limit INT DEFAULT 200
) RETURNS TABLE(
  id UUID, full_name TEXT, email TEXT, phone TEXT,
  status public.user_status, plan public.plan_tier,
  created_at TIMESTAMPTZ, last_seen_at TIMESTAMPTZ,
  motorcycles_count BIGINT, open_tickets BIGINT, is_admin BOOLEAN
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $fn$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
  SELECT p.id, p.full_name, p.email, p.phone, p.status, p.plan, p.created_at, p.last_seen_at,
         (SELECT count(*) FROM public.motorcycles m WHERE m.owner_id = p.id),
         (SELECT count(*) FROM public.tickets t WHERE t.user_id = p.id AND t.status NOT IN ('closed','cancelled','resolved')),
         public.has_role(p.id,'admin')
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
END $fn$;

CREATE OR REPLACE FUNCTION public.write_admin_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_old JSONB; v_new JSONB; v_id UUID;
BEGIN
  IF TG_OP='DELETE' THEN v_old:=to_jsonb(OLD); v_id:=OLD.id;
  ELSIF TG_OP='INSERT' THEN v_new:=to_jsonb(NEW); v_id:=NEW.id;
  ELSE v_old:=to_jsonb(OLD); v_new:=to_jsonb(NEW); v_id:=NEW.id; END IF;
  INSERT INTO public.audit_log(table_name, record_id, motorcycle_id, actor_id, action, old_values, new_values)
  VALUES (TG_TABLE_NAME, v_id, NULL, auth.uid(), lower(TG_OP)::public.audit_action, v_old, v_new);
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $fn$;

CREATE TRIGGER trg_profiles_admin_audit AFTER UPDATE ON public.profiles
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.plan IS DISTINCT FROM NEW.plan OR OLD.full_name IS DISTINCT FROM NEW.full_name OR OLD.phone IS DISTINCT FROM NEW.phone)
  EXECUTE FUNCTION public.write_admin_audit();

CREATE TRIGGER trg_tickets_admin_audit AFTER UPDATE ON public.tickets
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.priority IS DISTINCT FROM NEW.priority OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to)
  EXECUTE FUNCTION public.write_admin_audit();

CREATE POLICY "ticket-attachments read" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'ticket-attachments' AND (
      public.has_role(auth.uid(),'admin')
      OR EXISTS (
        SELECT 1 FROM public.ticket_attachments a
        JOIN public.tickets t ON t.id = a.ticket_id
        WHERE a.storage_path = storage.objects.name AND t.user_id = auth.uid()
      )
    )
  );
CREATE POLICY "ticket-attachments write" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'ticket-attachments' AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "ticket-attachments delete" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'ticket-attachments'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin'))
  );
