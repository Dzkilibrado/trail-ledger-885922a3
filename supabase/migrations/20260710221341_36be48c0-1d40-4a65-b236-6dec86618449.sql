
-- 1) Enum de status próprio da request
DO $$ BEGIN
  CREATE TYPE public.cpf_change_status AS ENUM ('open','in_review','awaiting_info','approved','rejected','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Novo tipo de chamado
ALTER TYPE public.ticket_type ADD VALUE IF NOT EXISTS 'cpf_change';

-- 3) Tabela
CREATE TABLE IF NOT EXISTS public.cpf_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL UNIQUE REFERENCES public.tickets(id) ON DELETE CASCADE,
  current_cpf_hash text NOT NULL,
  new_cpf text,                 -- apagado após aprovação
  new_cpf_hash text NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
  document_path text NOT NULL,
  status public.cpf_change_status NOT NULL DEFAULT 'open',
  decided_by uuid REFERENCES auth.users(id),
  decided_at timestamptz,
  decision_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.cpf_change_requests TO authenticated;
GRANT ALL ON public.cpf_change_requests TO service_role;
-- Revoga leitura direta do CPF em claro para authenticated
REVOKE SELECT (new_cpf) ON public.cpf_change_requests FROM authenticated;

ALTER TABLE public.cpf_change_requests ENABLE ROW LEVEL SECURITY;

-- Dono lê próprias requests (sem coluna new_cpf, já revogada)
CREATE POLICY "cpf_req_own_select" ON public.cpf_change_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Dono insere sua request
CREATE POLICY "cpf_req_own_insert" ON public.cpf_change_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Dono só atualiza se ainda aberta/aguardando info (para cancelar/reenviar)
CREATE POLICY "cpf_req_own_update" ON public.cpf_change_requests
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status IN ('open','awaiting_info'))
  WITH CHECK (user_id = auth.uid());

-- Admin lê tudo
CREATE POLICY "cpf_req_admin_select" ON public.cpf_change_requests
  FOR SELECT TO authenticated
  USING (public.is_user_admin(auth.uid()));

-- Trigger updated_at
CREATE TRIGGER cpf_change_requests_touch BEFORE UPDATE ON public.cpf_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auditoria
CREATE TRIGGER cpf_change_requests_audit AFTER INSERT OR UPDATE OR DELETE ON public.cpf_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.write_admin_audit();

CREATE INDEX IF NOT EXISTS cpf_change_requests_user_idx ON public.cpf_change_requests(user_id);
CREATE INDEX IF NOT EXISTS cpf_change_requests_status_idx ON public.cpf_change_requests(status);
CREATE INDEX IF NOT EXISTS cpf_change_requests_new_hash_idx ON public.cpf_change_requests(new_cpf_hash);

-- 4) Storage policies (bucket privado cpf-change-docs)
-- Estrutura de path: {user_id}/{request_id}/{arquivo}
CREATE POLICY "cpf_docs_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cpf-change-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "cpf_docs_owner_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'cpf-change-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "cpf_docs_admin_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'cpf-change-docs' AND public.is_user_admin(auth.uid()));

-- 5) Helpers
CREATE OR REPLACE FUNCTION public.mask_cpf(_cpf text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _cpf IS NULL OR length(_cpf) < 4 THEN NULL
    ELSE '***.***.***-' || right(_cpf, 2)
  END;
$$;

CREATE OR REPLACE FUNCTION public.hash_cpf(_cpf text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT encode(digest(regexp_replace(coalesce(_cpf,''),'\D','','g'), 'sha256'), 'hex');
$$;

-- pgcrypto para digest
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- 6) Submissão pelo usuário
CREATE OR REPLACE FUNCTION public.submit_cpf_change_request(
  _ticket_id uuid,
  _new_cpf text,
  _reason text,
  _document_path text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_current text;
  v_new text;
  v_open_count int;
  v_req_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 10 THEN RAISE EXCEPTION 'Motivo insuficiente'; END IF;
  IF _document_path IS NULL OR _document_path = '' THEN RAISE EXCEPTION 'Documento comprobatório obrigatório'; END IF;

  v_new := regexp_replace(coalesce(_new_cpf,''),'\D','','g');
  IF NOT public.validate_cpf(v_new) THEN RAISE EXCEPTION 'Novo CPF inválido'; END IF;

  SELECT cpf INTO v_current FROM public.profiles WHERE id = v_uid;
  IF v_current IS NOT NULL AND v_current = v_new THEN
    RAISE EXCEPTION 'O novo CPF é igual ao atual';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE cpf = v_new AND id <> v_uid) THEN
    RAISE EXCEPTION 'Novo CPF já cadastrado por outro usuário';
  END IF;

  -- Rate-limit: no máximo 3 abertas por usuário
  SELECT count(*) INTO v_open_count
    FROM public.cpf_change_requests
   WHERE user_id = v_uid AND status IN ('open','in_review','awaiting_info');
  IF v_open_count >= 3 THEN
    RAISE EXCEPTION 'Você já possui solicitações em aberto. Aguarde a análise.';
  END IF;

  -- Chamado precisa existir, ser do usuário e ser cpf_change
  IF NOT EXISTS (
    SELECT 1 FROM public.tickets
     WHERE id = _ticket_id AND user_id = v_uid AND type = 'cpf_change'
  ) THEN
    RAISE EXCEPTION 'Chamado inválido para esta operação';
  END IF;

  INSERT INTO public.cpf_change_requests
    (user_id, ticket_id, current_cpf_hash, new_cpf, new_cpf_hash, reason, document_path, status)
  VALUES
    (v_uid, _ticket_id, public.hash_cpf(v_current), v_new, public.hash_cpf(v_new), btrim(_reason), _document_path, 'open')
  RETURNING id INTO v_req_id;

  -- Auditoria com CPFs mascarados
  INSERT INTO public.admin_user_events(actor_id, target_user_id, action, metadata)
  VALUES (v_uid, v_uid, 'cpf_change_requested', jsonb_build_object(
    'request_id', v_req_id,
    'ticket_id', _ticket_id,
    'current_cpf_masked', public.mask_cpf(v_current),
    'new_cpf_masked', public.mask_cpf(v_new)
  ));

  RETURN v_req_id;
END $$;

REVOKE ALL ON FUNCTION public.submit_cpf_change_request(uuid,text,text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_cpf_change_request(uuid,text,text,text) TO authenticated;

-- 7) Admin: listar e detalhe (sempre mascarados)
CREATE OR REPLACE FUNCTION public.admin_list_cpf_requests(_status text DEFAULT NULL, _limit int DEFAULT 100)
RETURNS TABLE(
  id uuid, user_id uuid, user_name text, user_email text,
  ticket_id uuid, ticket_code text,
  current_cpf_masked text, new_cpf_masked text,
  reason text, status public.cpf_change_status,
  created_at timestamptz, decided_at timestamptz
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_user_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
  SELECT r.id, r.user_id,
         (SELECT full_name FROM public.profiles WHERE id = r.user_id),
         (SELECT email     FROM public.profiles WHERE id = r.user_id),
         r.ticket_id,
         (SELECT code FROM public.tickets WHERE id = r.ticket_id),
         public.mask_cpf((SELECT cpf FROM public.profiles WHERE id = r.user_id)),
         public.mask_cpf(r.new_cpf),
         r.reason, r.status, r.created_at, r.decided_at
    FROM public.cpf_change_requests r
   WHERE (_status IS NULL OR r.status::text = _status)
   ORDER BY r.created_at DESC LIMIT _limit;
END $$;

REVOKE ALL ON FUNCTION public.admin_list_cpf_requests(text,int) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_list_cpf_requests(text,int) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_cpf_request_detail(_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE r public.cpf_change_requests; p public.profiles; t public.tickets;
BEGIN
  IF NOT public.is_user_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO r FROM public.cpf_change_requests WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  SELECT * INTO p FROM public.profiles WHERE id = r.user_id;
  SELECT * INTO t FROM public.tickets   WHERE id = r.ticket_id;
  RETURN jsonb_build_object(
    'id', r.id,
    'status', r.status,
    'reason', r.reason,
    'document_path', r.document_path,
    'created_at', r.created_at,
    'decided_at', r.decided_at,
    'decided_by', r.decided_by,
    'decision_notes', r.decision_notes,
    'ticket', jsonb_build_object('id', t.id, 'code', t.code, 'status', t.status),
    'user',   jsonb_build_object('id', p.id, 'full_name', p.full_name, 'email', p.email),
    'current_cpf_masked', public.mask_cpf(p.cpf),
    'new_cpf_masked',     public.mask_cpf(r.new_cpf)
  );
END $$;

REVOKE ALL ON FUNCTION public.admin_cpf_request_detail(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_cpf_request_detail(uuid) TO authenticated;

-- 8) Admin: solicitar informação
CREATE OR REPLACE FUNCTION public.admin_request_more_info_cpf(_id uuid, _notes text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r public.cpf_change_requests;
BEGIN
  IF NOT public.is_user_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _notes IS NULL OR length(btrim(_notes)) < 5 THEN RAISE EXCEPTION 'Descreva o que precisa'; END IF;
  SELECT * INTO r FROM public.cpf_change_requests WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  IF r.status NOT IN ('open','in_review') THEN RAISE EXCEPTION 'Status inválido'; END IF;

  UPDATE public.cpf_change_requests
     SET status='awaiting_info', decision_notes = _notes, updated_at = now()
   WHERE id = _id;

  UPDATE public.tickets SET status='awaiting_user', last_activity_at = now() WHERE id = r.ticket_id;

  PERFORM public.emit_system_message(
    r.user_id, 'notice'::message_type, 'other'::message_subject_key,
    'Solicitação de alteração de CPF',
    'Precisamos de mais informações sobre sua solicitação de alteração de CPF: ' || _notes,
    'medium'::message_priority, r.ticket_id
  );
END $$;

REVOKE ALL ON FUNCTION public.admin_request_more_info_cpf(uuid,text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_request_more_info_cpf(uuid,text) TO authenticated;

-- 9) Admin: rejeitar
CREATE OR REPLACE FUNCTION public.admin_reject_cpf_change(_id uuid, _notes text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r public.cpf_change_requests;
BEGIN
  IF NOT public.is_user_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _notes IS NULL OR length(btrim(_notes)) < 5 THEN RAISE EXCEPTION 'Motivo obrigatório'; END IF;
  SELECT * INTO r FROM public.cpf_change_requests WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  IF r.status IN ('approved','rejected','cancelled') THEN RAISE EXCEPTION 'Já decidida'; END IF;

  UPDATE public.cpf_change_requests
     SET status='rejected', decided_by=auth.uid(), decided_at=now(),
         decision_notes=_notes, new_cpf=NULL, updated_at=now()
   WHERE id = _id;

  UPDATE public.tickets SET status='closed', closed_at = now(), last_activity_at = now()
    WHERE id = r.ticket_id;

  INSERT INTO public.admin_user_events(actor_id,target_user_id,action,reason,metadata)
  VALUES (auth.uid(), r.user_id, 'cpf_change_rejected', _notes,
          jsonb_build_object('request_id', r.id));

  PERFORM public.emit_system_message(
    r.user_id, 'notice'::message_type, 'other'::message_subject_key,
    'Solicitação de alteração de CPF',
    'Sua solicitação de alteração de CPF foi recusada: ' || _notes,
    'medium'::message_priority, r.ticket_id
  );
END $$;

REVOKE ALL ON FUNCTION public.admin_reject_cpf_change(uuid,text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_reject_cpf_change(uuid,text) TO authenticated;

-- 10) Admin: aprovar (única forma legítima de trocar CPF já validado)
CREATE OR REPLACE FUNCTION public.admin_approve_cpf_change(_id uuid, _notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r public.cpf_change_requests;
  v_old_cpf text;
BEGIN
  IF NOT public.is_user_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO r FROM public.cpf_change_requests WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  IF r.status IN ('approved','rejected','cancelled') THEN RAISE EXCEPTION 'Já decidida'; END IF;
  IF r.new_cpf IS NULL THEN RAISE EXCEPTION 'CPF novo indisponível — reenvie a solicitação'; END IF;
  IF NOT public.validate_cpf(r.new_cpf) THEN RAISE EXCEPTION 'CPF novo inválido'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE cpf = r.new_cpf AND id <> r.user_id) THEN
    RAISE EXCEPTION 'Novo CPF já cadastrado por outro usuário';
  END IF;

  SELECT cpf INTO v_old_cpf FROM public.profiles WHERE id = r.user_id;

  -- Bypass do trigger profiles_lock_cpf (só service_role pode)
  SET LOCAL role TO service_role;
  UPDATE public.profiles
     SET cpf = r.new_cpf, cpf_locked_at = now(), updated_at = now()
   WHERE id = r.user_id;
  RESET role;

  UPDATE public.cpf_change_requests
     SET status='approved', decided_by=auth.uid(), decided_at=now(),
         decision_notes=_notes, new_cpf=NULL, updated_at=now()
   WHERE id = _id;

  UPDATE public.tickets SET status='resolved', resolved_at=now(), last_activity_at = now()
    WHERE id = r.ticket_id;

  INSERT INTO public.admin_user_events(actor_id,target_user_id,action,reason,field,old_value,new_value,metadata)
  VALUES (auth.uid(), r.user_id, 'cpf_change_approved', _notes, 'cpf',
          to_jsonb(public.mask_cpf(v_old_cpf)),
          to_jsonb(public.mask_cpf((SELECT cpf FROM public.profiles WHERE id = r.user_id))),
          jsonb_build_object('request_id', r.id));

  PERFORM public.emit_system_message(
    r.user_id, 'notice'::message_type, 'other'::message_subject_key,
    'CPF atualizado',
    'Sua solicitação de alteração de CPF foi aprovada. O novo CPF já está ativo no TrailBook.',
    'high'::message_priority, r.ticket_id
  );
END $$;

REVOKE ALL ON FUNCTION public.admin_approve_cpf_change(uuid,text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_approve_cpf_change(uuid,text) TO authenticated;
