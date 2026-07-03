
-- Types
DO $$ BEGIN
  CREATE TYPE public.help_request_type AS ENUM (
    'forgot_access','cpf_exists','no_confirmation_email','changed_email',
    'changed_phone','google_login_issue','account_blocked','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.help_request_status AS ENUM (
    'open','in_analysis','waiting_user','resolved','closed','cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Sequence for public help-request code
CREATE SEQUENCE IF NOT EXISTS public.help_request_code_seq;

-- Table
CREATE TABLE IF NOT EXISTS public.help_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE,
  full_name TEXT NOT NULL,
  birth_date DATE,
  cpf TEXT,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  problem_type public.help_request_type NOT NULL,
  problem_other TEXT,
  description TEXT NOT NULL,
  status public.help_request_status NOT NULL DEFAULT 'open',
  admin_notes TEXT,
  ip TEXT,
  user_agent TEXT,
  linked_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- Grants (no anon/authenticated direct access — everything via RPCs)
GRANT ALL ON public.help_requests TO service_role;

-- RLS: admins only for direct table access
ALTER TABLE public.help_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view help requests" ON public.help_requests;
CREATE POLICY "Admins can view help requests"
  ON public.help_requests FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update help requests" ON public.help_requests;
CREATE POLICY "Admins can update help requests"
  ON public.help_requests FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Deny direct inserts; only the SECURITY DEFINER RPC may insert
DROP POLICY IF EXISTS "No direct inserts" ON public.help_requests;
CREATE POLICY "No direct inserts"
  ON public.help_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

-- updated_at trigger
DROP TRIGGER IF EXISTS help_requests_touch ON public.help_requests;
CREATE TRIGGER help_requests_touch
  BEFORE UPDATE ON public.help_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Code generator trigger
CREATE OR REPLACE FUNCTION public.generate_help_request_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := 'TB-H-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.help_request_code_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS help_requests_code ON public.help_requests;
CREATE TRIGGER help_requests_code
  BEFORE INSERT ON public.help_requests
  FOR EACH ROW EXECUTE FUNCTION public.generate_help_request_code();

-- Public submit RPC
CREATE OR REPLACE FUNCTION public.submit_help_request(
  _full_name TEXT,
  _birth_date DATE,
  _cpf TEXT,
  _phone TEXT,
  _email TEXT,
  _problem_type TEXT,
  _description TEXT,
  _problem_other TEXT DEFAULT NULL,
  _ip TEXT DEFAULT NULL,
  _user_agent TEXT DEFAULT NULL
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type public.help_request_type;
  v_cpf TEXT;
  v_linked UUID;
  v_code TEXT;
  v_recent INT;
BEGIN
  IF _full_name IS NULL OR length(btrim(_full_name)) < 3 THEN
    RAISE EXCEPTION 'Informe seu nome completo';
  END IF;
  IF _email IS NULL OR _email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'E-mail inválido';
  END IF;
  IF _phone IS NULL OR length(regexp_replace(_phone,'\D','','g')) < 10 THEN
    RAISE EXCEPTION 'Celular inválido';
  END IF;
  IF _description IS NULL OR length(btrim(_description)) < 5 THEN
    RAISE EXCEPTION 'Descreva o problema com mais detalhes';
  END IF;

  BEGIN
    v_type := _problem_type::public.help_request_type;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Tipo de problema inválido';
  END;

  IF v_type = 'other' AND (_problem_other IS NULL OR length(btrim(_problem_other)) < 3) THEN
    RAISE EXCEPTION 'Detalhe o tipo do problema';
  END IF;

  v_cpf := NULLIF(regexp_replace(COALESCE(_cpf,''), '\D', '', 'g'), '');
  IF v_cpf IS NOT NULL AND NOT public.validate_cpf(v_cpf) THEN
    RAISE EXCEPTION 'CPF inválido';
  END IF;

  -- Rate-limit: max 5 requests per e-mail per hour
  SELECT count(*) INTO v_recent
    FROM public.help_requests
   WHERE lower(email) = lower(_email)
     AND created_at > now() - interval '1 hour';
  IF v_recent >= 5 THEN
    RAISE EXCEPTION 'Muitas solicitações recentes. Aguarde alguns minutos e tente novamente.';
  END IF;

  -- Try to link by CPF or e-mail (informational only; no data exposed)
  IF v_cpf IS NOT NULL THEN
    SELECT id INTO v_linked FROM public.profiles WHERE cpf = v_cpf LIMIT 1;
  END IF;
  IF v_linked IS NULL THEN
    SELECT id INTO v_linked FROM public.profiles WHERE lower(email) = lower(_email) LIMIT 1;
  END IF;

  INSERT INTO public.help_requests (
    full_name, birth_date, cpf, phone, email,
    problem_type, problem_other, description,
    ip, user_agent, linked_user_id
  ) VALUES (
    btrim(_full_name), _birth_date, v_cpf, _phone, lower(_email),
    v_type, NULLIF(btrim(COALESCE(_problem_other,'')),''), btrim(_description),
    LEFT(COALESCE(_ip,''), 64), LEFT(COALESCE(_user_agent,''), 512), v_linked
  )
  RETURNING code INTO v_code;

  RETURN v_code;
END $$;

REVOKE ALL ON FUNCTION public.submit_help_request(TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_help_request(TEXT, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- Admin list RPC (for phase 2, but ships now)
CREATE OR REPLACE FUNCTION public.admin_list_help_requests(
  _status TEXT DEFAULT NULL,
  _search TEXT DEFAULT NULL,
  _limit INT DEFAULT 200
) RETURNS SETOF public.help_requests
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
    SELECT * FROM public.help_requests
     WHERE (_status IS NULL OR status::text = _status)
       AND (_search IS NULL
            OR full_name ILIKE '%'||_search||'%'
            OR email ILIKE '%'||_search||'%'
            OR code ILIKE '%'||_search||'%'
            OR phone ILIKE '%'||_search||'%')
     ORDER BY created_at DESC
     LIMIT _limit;
END $$;

CREATE OR REPLACE FUNCTION public.admin_update_help_request(
  _id UUID, _status TEXT, _notes TEXT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_st public.help_request_status;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  v_st := _status::public.help_request_status;
  UPDATE public.help_requests
     SET status = v_st,
         admin_notes = COALESCE(_notes, admin_notes),
         resolved_at = CASE WHEN v_st IN ('resolved','closed') AND resolved_at IS NULL THEN now() ELSE resolved_at END,
         updated_at = now()
   WHERE id = _id;
END $$;

REVOKE ALL ON FUNCTION public.admin_list_help_requests(TEXT, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_help_requests(TEXT, TEXT, INT) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_update_help_request(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_help_request(UUID, TEXT, TEXT) TO authenticated;
