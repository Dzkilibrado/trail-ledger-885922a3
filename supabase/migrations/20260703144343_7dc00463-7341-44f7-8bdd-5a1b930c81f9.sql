
-- ============ ENUMS ============
CREATE TYPE public.message_channel AS ENUM ('internal','email','whatsapp','push','sms');
CREATE TYPE public.message_type AS ENUM ('system_notice','support','access','documentation','certificate','maintenance','financial','homologation','security','system_update','other');
CREATE TYPE public.message_subject_key AS ENUM ('signup_confirmation','password_recovery','cpf_duplicate','email_not_confirmed','account_blocked','profile_update','document_pending','certificate','ticket','homologation','important_notice','other');
CREATE TYPE public.message_priority AS ENUM ('low','medium','high','critical');
CREATE TYPE public.message_status AS ENUM ('draft','sent','read','replied','archived','cancelled');
CREATE TYPE public.message_audience AS ENUM ('single_user','by_status','by_role','homologation_users','open_tickets','email_unconfirmed','blocked_users','all_users');
CREATE TYPE public.delivery_status AS ENUM ('pending','sent','simulated','skipped_disabled','failed');
CREATE TYPE public.recipient_status AS ENUM ('sent','read','replied','archived');

-- ============ SEQUENCE ============
CREATE SEQUENCE public.message_code_seq;

-- ============ comm_settings ============
CREATE TABLE public.comm_settings (
  id INT PRIMARY KEY DEFAULT 1,
  email_enabled BOOLEAN NOT NULL DEFAULT false,
  internal_enabled BOOLEAN NOT NULL DEFAULT true,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT false,
  push_enabled BOOLEAN NOT NULL DEFAULT false,
  sms_enabled BOOLEAN NOT NULL DEFAULT false,
  homologation_mode BOOLEAN NOT NULL DEFAULT true,
  email_from TEXT,
  email_provider TEXT,
  email_test_redirect TEXT,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT comm_settings_singleton CHECK (id = 1)
);
GRANT SELECT ON public.comm_settings TO authenticated;
GRANT ALL ON public.comm_settings TO service_role;
ALTER TABLE public.comm_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read comm_settings" ON public.comm_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
INSERT INTO public.comm_settings(id) VALUES (1);

-- ============ messages ============
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type public.message_type NOT NULL DEFAULT 'system_notice',
  subject_key public.message_subject_key NOT NULL DEFAULT 'important_notice',
  subject_other TEXT,
  subject_text TEXT NOT NULL,
  body TEXT NOT NULL,
  priority public.message_priority NOT NULL DEFAULT 'medium',
  status public.message_status NOT NULL DEFAULT 'sent',
  audience public.message_audience NOT NULL DEFAULT 'single_user',
  audience_filter JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_automatic BOOLEAN NOT NULL DEFAULT false,
  allow_reply BOOLEAN NOT NULL DEFAULT true,
  related_ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  parent_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.generate_message_code() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path='public' AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := 'TB-M-'||to_char(now(),'YYYY')||'-'||lpad(nextval('public.message_code_seq')::text,6,'0');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_messages_code BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.generate_message_code();
CREATE TRIGGER trg_messages_updated BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ message_recipients ============
CREATE TABLE public.message_recipients (
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.recipient_status NOT NULL DEFAULT 'sent',
  read_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);
CREATE INDEX idx_message_recipients_user ON public.message_recipients(user_id, status);
GRANT SELECT, UPDATE ON public.message_recipients TO authenticated;
GRANT ALL ON public.message_recipients TO service_role;
ALTER TABLE public.message_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own recipients" ON public.message_recipients FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "user updates own recipients" ON public.message_recipients FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- messages RLS: user reads messages that either they sent or they are a recipient of
CREATE POLICY "user reads messages linked to them" ON public.messages FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR sender_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.message_recipients r WHERE r.message_id = messages.id AND r.user_id = auth.uid())
  );

-- ============ message_deliveries ============
CREATE TABLE public.message_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  channel public.message_channel NOT NULL,
  status public.delivery_status NOT NULL DEFAULT 'pending',
  simulated BOOLEAN NOT NULL DEFAULT false,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_message_deliveries_msg ON public.message_deliveries(message_id);
GRANT SELECT ON public.message_deliveries TO authenticated;
GRANT ALL ON public.message_deliveries TO service_role;
ALTER TABLE public.message_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read deliveries" ON public.message_deliveries FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- ============ comm_audit ============
CREATE TABLE public.comm_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  action TEXT NOT NULL,
  message_id UUID,
  recipient_id UUID,
  channel public.message_channel,
  subject_text TEXT,
  type public.message_type,
  status TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_comm_audit_msg ON public.comm_audit(message_id, created_at DESC);
GRANT SELECT ON public.comm_audit TO authenticated;
GRANT ALL ON public.comm_audit TO service_role;
ALTER TABLE public.comm_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read comm_audit" ON public.comm_audit FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

-- ============ Helpers ============
CREATE OR REPLACE FUNCTION public.comm_subject_default(_key public.message_subject_key, _other TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _key
    WHEN 'signup_confirmation' THEN 'Confirmação de cadastro'
    WHEN 'password_recovery'   THEN 'Recuperação de acesso'
    WHEN 'cpf_duplicate'       THEN 'CPF já cadastrado'
    WHEN 'email_not_confirmed' THEN 'E-mail não confirmado'
    WHEN 'account_blocked'     THEN 'Conta bloqueada'
    WHEN 'profile_update'      THEN 'Atualização cadastral'
    WHEN 'document_pending'    THEN 'Documento pendente'
    WHEN 'certificate'         THEN 'Certificado'
    WHEN 'ticket'              THEN 'Chamado'
    WHEN 'homologation'        THEN 'Homologação'
    WHEN 'important_notice'    THEN 'Aviso importante'
    ELSE COALESCE(NULLIF(btrim(_other),''),'Mensagem')
  END
$$;

-- ============ RPC: settings ============
CREATE OR REPLACE FUNCTION public.admin_get_comm_settings()
RETURNS public.comm_settings LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='public' AS $$
DECLARE r public.comm_settings;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO r FROM public.comm_settings WHERE id=1;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.admin_update_comm_settings(_json JSONB)
RETURNS public.comm_settings LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE r public.comm_settings;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.comm_settings SET
    email_enabled = COALESCE((_json->>'email_enabled')::boolean, email_enabled),
    internal_enabled = COALESCE((_json->>'internal_enabled')::boolean, internal_enabled),
    whatsapp_enabled = COALESCE((_json->>'whatsapp_enabled')::boolean, whatsapp_enabled),
    push_enabled = COALESCE((_json->>'push_enabled')::boolean, push_enabled),
    sms_enabled = COALESCE((_json->>'sms_enabled')::boolean, sms_enabled),
    homologation_mode = COALESCE((_json->>'homologation_mode')::boolean, homologation_mode),
    email_from = COALESCE(_json->>'email_from', email_from),
    email_provider = COALESCE(_json->>'email_provider', email_provider),
    email_test_redirect = COALESCE(_json->>'email_test_redirect', email_test_redirect),
    updated_by = auth.uid(),
    updated_at = now()
  WHERE id=1 RETURNING * INTO r;
  INSERT INTO public.comm_audit(actor_id,action,metadata) VALUES (auth.uid(),'settings_changed',_json);
  RETURN r;
END $$;

-- ============ RPC: expand_audience ============
CREATE OR REPLACE FUNCTION public.comm_expand_audience(_audience public.message_audience, _filter JSONB)
RETURNS TABLE(user_id UUID) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
  SELECT p.id FROM public.profiles p
   WHERE CASE _audience
     WHEN 'single_user' THEN p.id = (_filter->>'user_id')::uuid
     WHEN 'by_status' THEN p.status::text = (_filter->>'status')
     WHEN 'by_role' THEN
       CASE WHEN _filter->>'role' = 'admin'
            THEN public.has_role(p.id,'admin')
            ELSE NOT public.has_role(p.id,'admin') END
     WHEN 'homologation_users' THEN p.status = 'pending'
     WHEN 'open_tickets' THEN EXISTS (SELECT 1 FROM public.tickets t WHERE t.user_id=p.id AND t.status NOT IN ('closed','cancelled','resolved'))
     WHEN 'email_unconfirmed' THEN EXISTS (SELECT 1 FROM auth.users u WHERE u.id=p.id AND u.email_confirmed_at IS NULL)
     WHEN 'blocked_users' THEN p.status = 'blocked'
     WHEN 'all_users' THEN true
   END;
END $$;

-- ============ RPC: admin_send_message ============
CREATE OR REPLACE FUNCTION public.admin_send_message(
  _type public.message_type,
  _subject_key public.message_subject_key,
  _subject_other TEXT,
  _body TEXT,
  _priority public.message_priority,
  _audience public.message_audience,
  _filter JSONB,
  _allow_reply BOOLEAN,
  _related_ticket_id UUID,
  _channels TEXT[]
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE
  v_msg UUID;
  v_subject TEXT;
  v_settings public.comm_settings;
  v_user UUID;
  v_email TEXT;
  v_use_email BOOLEAN;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _body IS NULL OR length(btrim(_body)) < 2 THEN RAISE EXCEPTION 'Mensagem vazia'; END IF;
  IF _subject_key = 'other' AND (_subject_other IS NULL OR length(btrim(_subject_other))<2) THEN
    RAISE EXCEPTION 'Detalhe o assunto';
  END IF;

  SELECT * INTO v_settings FROM public.comm_settings WHERE id=1;
  v_subject := public.comm_subject_default(_subject_key, _subject_other);

  INSERT INTO public.messages(sender_id,type,subject_key,subject_other,subject_text,body,priority,status,audience,audience_filter,allow_reply,related_ticket_id,is_automatic)
  VALUES (auth.uid(),_type,_subject_key,_subject_other,v_subject,_body,_priority,'sent',_audience,COALESCE(_filter,'{}'::jsonb),COALESCE(_allow_reply,true),_related_ticket_id,false)
  RETURNING id INTO v_msg;

  INSERT INTO public.comm_audit(actor_id,action,message_id,subject_text,type,status)
  VALUES (auth.uid(),'message_created',v_msg,v_subject,_type,'sent');

  v_use_email := ('email' = ANY(_channels)) AND v_settings.email_enabled AND NOT v_settings.homologation_mode;

  FOR v_user IN SELECT public.comm_expand_audience(_audience,_filter) LOOP
    INSERT INTO public.message_recipients(message_id,user_id,status)
    VALUES (v_msg,v_user,'sent') ON CONFLICT DO NOTHING;

    IF 'internal' = ANY(_channels) THEN
      INSERT INTO public.message_deliveries(message_id,user_id,channel,status)
      VALUES (v_msg,v_user,'internal','sent');
      INSERT INTO public.notifications(user_id,kind,title,body,link)
      VALUES (v_user,'message',v_subject,left(_body,240),'/messages/'||v_msg::text);
    END IF;

    IF 'email' = ANY(_channels) THEN
      SELECT email INTO v_email FROM public.profiles WHERE id = v_user;
      IF v_use_email THEN
        INSERT INTO public.message_deliveries(message_id,user_id,channel,status,payload)
        VALUES (v_msg,v_user,'email','pending',jsonb_build_object('to',v_email,'subject',v_subject));
      ELSE
        INSERT INTO public.message_deliveries(message_id,user_id,channel,status,simulated,payload)
        VALUES (v_msg,v_user,'email',
          CASE WHEN v_settings.email_enabled THEN 'simulated' ELSE 'skipped_disabled' END,
          true,
          jsonb_build_object('to',v_email,'from',v_settings.email_from,'subject',v_subject,'body',_body));
        INSERT INTO public.comm_audit(actor_id,action,message_id,recipient_id,channel,subject_text,type,status)
        VALUES (auth.uid(),'email_simulated',v_msg,v_user,'email',v_subject,_type,'simulated');
      END IF;
    END IF;
  END LOOP;

  RETURN v_msg;
END $$;

-- ============ RPC: emit_system_message (internal helper) ============
CREATE OR REPLACE FUNCTION public.emit_system_message(
  _user UUID, _type public.message_type, _subject_key public.message_subject_key,
  _subject_other TEXT, _body TEXT, _priority public.message_priority DEFAULT 'medium',
  _related_ticket UUID DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE v_msg UUID; v_subject TEXT; v_settings public.comm_settings; v_email TEXT;
BEGIN
  IF _user IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO v_settings FROM public.comm_settings WHERE id=1;
  v_subject := public.comm_subject_default(_subject_key,_subject_other);
  INSERT INTO public.messages(sender_id,type,subject_key,subject_other,subject_text,body,priority,status,audience,audience_filter,is_automatic,allow_reply,related_ticket_id)
  VALUES (NULL,_type,_subject_key,_subject_other,v_subject,_body,_priority,'sent','single_user',jsonb_build_object('user_id',_user),true,false,_related_ticket)
  RETURNING id INTO v_msg;
  INSERT INTO public.message_recipients(message_id,user_id,status) VALUES (v_msg,_user,'sent');
  INSERT INTO public.message_deliveries(message_id,user_id,channel,status) VALUES (v_msg,_user,'internal','sent');
  INSERT INTO public.notifications(user_id,kind,title,body,link) VALUES (_user,'message',v_subject,left(_body,240),'/messages/'||v_msg::text);
  INSERT INTO public.comm_audit(actor_id,action,message_id,recipient_id,subject_text,type,status,metadata)
  VALUES (NULL,'system_message',v_msg,_user,v_subject,_type,'sent',jsonb_build_object('automatic',true));
  SELECT email INTO v_email FROM public.profiles WHERE id=_user;
  INSERT INTO public.message_deliveries(message_id,user_id,channel,status,simulated,payload)
  VALUES (v_msg,_user,'email',
    CASE WHEN v_settings.email_enabled AND NOT v_settings.homologation_mode THEN 'pending'
         WHEN v_settings.email_enabled THEN 'simulated' ELSE 'skipped_disabled' END,
    NOT (v_settings.email_enabled AND NOT v_settings.homologation_mode),
    jsonb_build_object('to',v_email,'from',v_settings.email_from,'subject',v_subject,'body',_body));
  RETURN v_msg;
END $$;

-- ============ RPC: user actions ============
CREATE OR REPLACE FUNCTION public.user_mark_message(_id UUID, _action TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _action = 'read' THEN
    UPDATE public.message_recipients SET status='read', read_at=COALESCE(read_at,now())
      WHERE message_id=_id AND user_id=auth.uid() AND status='sent';
    INSERT INTO public.comm_audit(actor_id,action,message_id,recipient_id) VALUES (auth.uid(),'message_read',_id,auth.uid());
  ELSIF _action = 'archived' THEN
    UPDATE public.message_recipients SET status='archived', archived_at=now()
      WHERE message_id=_id AND user_id=auth.uid();
    INSERT INTO public.comm_audit(actor_id,action,message_id,recipient_id) VALUES (auth.uid(),'message_archived',_id,auth.uid());
  ELSE RAISE EXCEPTION 'Invalid action'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.user_reply_message(_parent UUID, _body TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE v_msg UUID; v_parent public.messages%ROWTYPE; v_target UUID; v_subject TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _body IS NULL OR length(btrim(_body))<2 THEN RAISE EXCEPTION 'Resposta vazia'; END IF;
  SELECT * INTO v_parent FROM public.messages WHERE id=_parent;
  IF NOT FOUND THEN RAISE EXCEPTION 'Mensagem não encontrada'; END IF;
  IF NOT v_parent.allow_reply THEN RAISE EXCEPTION 'Esta mensagem não permite resposta'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.message_recipients WHERE message_id=_parent AND user_id=auth.uid()) THEN
    RAISE EXCEPTION 'Sem acesso a esta mensagem';
  END IF;
  v_target := v_parent.sender_id;
  v_subject := 'Re: '||v_parent.subject_text;

  INSERT INTO public.messages(sender_id,type,subject_key,subject_text,body,priority,status,audience,audience_filter,allow_reply,parent_message_id,related_ticket_id)
  VALUES (auth.uid(),v_parent.type,v_parent.subject_key,v_subject,_body,v_parent.priority,'sent','single_user',
          jsonb_build_object('user_id',v_target), true, _parent, v_parent.related_ticket_id)
  RETURNING id INTO v_msg;

  IF v_target IS NOT NULL THEN
    INSERT INTO public.message_recipients(message_id,user_id,status) VALUES (v_msg,v_target,'sent');
    INSERT INTO public.message_deliveries(message_id,user_id,channel,status) VALUES (v_msg,v_target,'internal','sent');
    INSERT INTO public.notifications(user_id,kind,title,body,link) VALUES (v_target,'message',v_subject,left(_body,240),'/admin/messages');
  ELSE
    -- broadcast to admins
    INSERT INTO public.message_recipients(message_id,user_id,status)
      SELECT v_msg, ur.user_id, 'sent' FROM public.user_roles ur WHERE ur.role='admin';
  END IF;

  UPDATE public.message_recipients SET status='replied', replied_at=now()
    WHERE message_id=_parent AND user_id=auth.uid();
  INSERT INTO public.comm_audit(actor_id,action,message_id,recipient_id) VALUES (auth.uid(),'message_replied',_parent,v_target);
  RETURN v_msg;
END $$;

CREATE OR REPLACE FUNCTION public.admin_reply_message(_parent UUID, _body TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE v_msg UUID; v_parent public.messages%ROWTYPE; v_target UUID; v_subject TEXT; v_email TEXT; v_settings public.comm_settings;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _body IS NULL OR length(btrim(_body))<2 THEN RAISE EXCEPTION 'Resposta vazia'; END IF;
  SELECT * INTO v_parent FROM public.messages WHERE id=_parent;
  IF NOT FOUND THEN RAISE EXCEPTION 'Mensagem não encontrada'; END IF;
  SELECT * INTO v_settings FROM public.comm_settings WHERE id=1;
  -- reply back to original sender OR to first recipient
  v_target := COALESCE(v_parent.sender_id, (SELECT user_id FROM public.message_recipients WHERE message_id=_parent LIMIT 1));
  v_subject := 'Re: '||v_parent.subject_text;

  INSERT INTO public.messages(sender_id,type,subject_key,subject_text,body,priority,status,audience,audience_filter,allow_reply,parent_message_id,related_ticket_id)
  VALUES (auth.uid(),v_parent.type,v_parent.subject_key,v_subject,_body,v_parent.priority,'sent','single_user',
          jsonb_build_object('user_id',v_target), true, _parent, v_parent.related_ticket_id)
  RETURNING id INTO v_msg;

  INSERT INTO public.message_recipients(message_id,user_id,status) VALUES (v_msg,v_target,'sent');
  INSERT INTO public.message_deliveries(message_id,user_id,channel,status) VALUES (v_msg,v_target,'internal','sent');
  INSERT INTO public.notifications(user_id,kind,title,body,link) VALUES (v_target,'message',v_subject,left(_body,240),'/messages/'||v_msg::text);

  SELECT email INTO v_email FROM public.profiles WHERE id=v_target;
  INSERT INTO public.message_deliveries(message_id,user_id,channel,status,simulated,payload)
  VALUES (v_msg,v_target,'email',
    CASE WHEN v_settings.email_enabled AND NOT v_settings.homologation_mode THEN 'pending'
         WHEN v_settings.email_enabled THEN 'simulated' ELSE 'skipped_disabled' END,
    NOT (v_settings.email_enabled AND NOT v_settings.homologation_mode),
    jsonb_build_object('to',v_email,'from',v_settings.email_from,'subject',v_subject,'body',_body));

  INSERT INTO public.comm_audit(actor_id,action,message_id,recipient_id) VALUES (auth.uid(),'admin_replied',_parent,v_target);
  RETURN v_msg;
END $$;

CREATE OR REPLACE FUNCTION public.user_open_ticket_from_message(_id UUID, _subject TEXT, _body TEXT, _priority TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE v_ticket UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.message_recipients WHERE message_id=_id AND user_id=auth.uid()) THEN
    RAISE EXCEPTION 'Sem acesso a esta mensagem';
  END IF;
  INSERT INTO public.tickets(user_id,subject,description,priority,status,module,type)
  VALUES (auth.uid(), COALESCE(_subject,'Chamado a partir de mensagem'), _body, COALESCE(_priority::public.ticket_priority,'medium'::public.ticket_priority), 'open','account','question')
  RETURNING id INTO v_ticket;
  UPDATE public.messages SET related_ticket_id = v_ticket WHERE id = _id AND related_ticket_id IS NULL;
  INSERT INTO public.comm_audit(actor_id,action,message_id,metadata) VALUES (auth.uid(),'ticket_from_message',_id,jsonb_build_object('ticket_id',v_ticket));
  RETURN v_ticket;
END $$;

-- ============ Admin listing RPCs ============
CREATE OR REPLACE FUNCTION public.user_list_messages(_filter TEXT DEFAULT NULL)
RETURNS TABLE(
  message_id UUID, code TEXT, subject_text TEXT, body TEXT, type public.message_type,
  priority public.message_priority, is_automatic BOOLEAN, allow_reply BOOLEAN,
  sender_id UUID, sender_name TEXT, related_ticket_id UUID,
  created_at TIMESTAMPTZ, status public.recipient_status, read_at TIMESTAMPTZ
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='public' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  RETURN QUERY
  SELECT m.id, m.code, m.subject_text, m.body, m.type, m.priority, m.is_automatic, m.allow_reply,
         m.sender_id, (SELECT full_name FROM public.profiles WHERE id=m.sender_id), m.related_ticket_id,
         m.created_at, r.status, r.read_at
    FROM public.message_recipients r
    JOIN public.messages m ON m.id = r.message_id
   WHERE r.user_id = auth.uid()
     AND (_filter IS NULL
          OR (_filter='unread' AND r.status='sent')
          OR (_filter='archived' AND r.status='archived')
          OR (_filter='inbox' AND r.status IN ('sent','read','replied')))
   ORDER BY m.created_at DESC LIMIT 500;
END $$;

CREATE OR REPLACE FUNCTION public.user_unread_count()
RETURNS BIGINT LANGUAGE sql STABLE SECURITY DEFINER SET search_path='public' AS $$
  SELECT count(*) FROM public.message_recipients WHERE user_id = auth.uid() AND status='sent'
$$;

CREATE OR REPLACE FUNCTION public.admin_list_messages(
  _search TEXT DEFAULT NULL, _type TEXT DEFAULT NULL, _priority TEXT DEFAULT NULL,
  _automatic TEXT DEFAULT NULL, _from TIMESTAMPTZ DEFAULT NULL, _to TIMESTAMPTZ DEFAULT NULL,
  _limit INT DEFAULT 200
) RETURNS TABLE(
  id UUID, code TEXT, subject_text TEXT, body TEXT, type public.message_type,
  priority public.message_priority, status public.message_status, is_automatic BOOLEAN,
  sender_id UUID, sender_name TEXT, audience public.message_audience,
  recipients_count BIGINT, read_count BIGINT, created_at TIMESTAMPTZ, related_ticket_id UUID
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
  SELECT m.id, m.code, m.subject_text, m.body, m.type, m.priority, m.status, m.is_automatic,
         m.sender_id, (SELECT full_name FROM public.profiles WHERE id=m.sender_id), m.audience,
         (SELECT count(*) FROM public.message_recipients r WHERE r.message_id=m.id),
         (SELECT count(*) FROM public.message_recipients r WHERE r.message_id=m.id AND r.status IN ('read','replied','archived')),
         m.created_at, m.related_ticket_id
    FROM public.messages m
   WHERE (_search IS NULL OR m.subject_text ILIKE '%'||_search||'%' OR m.body ILIKE '%'||_search||'%' OR m.code ILIKE '%'||_search||'%')
     AND (_type IS NULL OR m.type::text = _type)
     AND (_priority IS NULL OR m.priority::text = _priority)
     AND (_automatic IS NULL OR (_automatic='auto' AND m.is_automatic) OR (_automatic='manual' AND NOT m.is_automatic))
     AND (_from IS NULL OR m.created_at >= _from)
     AND (_to IS NULL OR m.created_at <= _to)
   ORDER BY m.created_at DESC LIMIT _limit;
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_deliveries(_only_simulated BOOLEAN DEFAULT true, _limit INT DEFAULT 200)
RETURNS TABLE(
  id UUID, message_id UUID, code TEXT, subject_text TEXT, user_id UUID, user_name TEXT, user_email TEXT,
  channel public.message_channel, status public.delivery_status, simulated BOOLEAN, payload JSONB, created_at TIMESTAMPTZ
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
  SELECT d.id, d.message_id, m.code, m.subject_text, d.user_id,
         (SELECT full_name FROM public.profiles WHERE id=d.user_id),
         (SELECT email FROM public.profiles WHERE id=d.user_id),
         d.channel, d.status, d.simulated, d.payload, d.created_at
    FROM public.message_deliveries d JOIN public.messages m ON m.id=d.message_id
   WHERE (NOT _only_simulated OR d.simulated = true)
   ORDER BY d.created_at DESC LIMIT _limit;
END $$;

CREATE OR REPLACE FUNCTION public.admin_message_thread(_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='public' AS $$
DECLARE r JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT jsonb_build_object(
    'message',(SELECT to_jsonb(m) FROM public.messages m WHERE m.id=_id),
    'recipients',COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'user_id',r.user_id,'status',r.status,'read_at',r.read_at,'replied_at',r.replied_at,
        'name',(SELECT full_name FROM public.profiles WHERE id=r.user_id),
        'email',(SELECT email FROM public.profiles WHERE id=r.user_id)))
      FROM public.message_recipients r WHERE r.message_id=_id),'[]'::jsonb),
    'deliveries',COALESCE((SELECT jsonb_agg(to_jsonb(d)) FROM public.message_deliveries d WHERE d.message_id=_id),'[]'::jsonb),
    'thread',COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id',mm.id,'created_at',mm.created_at,'body',mm.body,'subject_text',mm.subject_text,
        'sender_id',mm.sender_id,'sender_name',(SELECT full_name FROM public.profiles WHERE id=mm.sender_id))
        ORDER BY mm.created_at)
      FROM public.messages mm WHERE mm.parent_message_id=_id OR mm.id=_id),'[]'::jsonb)
  ) INTO r;
  RETURN r;
END $$;
