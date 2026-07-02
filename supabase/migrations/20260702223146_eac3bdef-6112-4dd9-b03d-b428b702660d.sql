
-- 1. Add columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS birth_date DATE;

-- 2. Uniqueness (case-insensitive email; strict CPF)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique_ci ON public.profiles (lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_cpf_unique ON public.profiles (cpf) WHERE cpf IS NOT NULL;

-- 3. CPF validator (format + digits)
CREATE OR REPLACE FUNCTION public.validate_cpf(_cpf text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  digits TEXT;
  s INT;
  d1 INT;
  d2 INT;
  i INT;
BEGIN
  IF _cpf IS NULL THEN RETURN false; END IF;
  digits := regexp_replace(_cpf, '\D', '', 'g');
  IF length(digits) <> 11 THEN RETURN false; END IF;
  IF digits ~ '^(\d)\1{10}$' THEN RETURN false; END IF;
  s := 0;
  FOR i IN 1..9 LOOP
    s := s + substring(digits, i, 1)::int * (11 - i);
  END LOOP;
  d1 := 11 - (s % 11);
  IF d1 >= 10 THEN d1 := 0; END IF;
  IF d1 <> substring(digits, 10, 1)::int THEN RETURN false; END IF;
  s := 0;
  FOR i IN 1..10 LOOP
    s := s + substring(digits, i, 1)::int * (12 - i);
  END LOOP;
  d2 := 11 - (s % 11);
  IF d2 >= 10 THEN d2 := 0; END IF;
  RETURN d2 = substring(digits, 11, 1)::int;
END;
$$;

-- 4. CHECK via trigger (imutable rule is fine as CHECK, but use trigger for clean error)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_cpf_valid;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_cpf_valid CHECK (cpf IS NULL OR public.validate_cpf(cpf));

-- 5. Update handle_new_user to persist extra signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cpf_raw TEXT := NEW.raw_user_meta_data->>'cpf';
  v_cpf TEXT := CASE WHEN v_cpf_raw IS NULL OR v_cpf_raw = '' THEN NULL
                     ELSE regexp_replace(v_cpf_raw, '\D', '', 'g') END;
  v_birth TEXT := NEW.raw_user_meta_data->>'birth_date';
BEGIN
  IF v_cpf IS NOT NULL AND NOT public.validate_cpf(v_cpf) THEN
    RAISE EXCEPTION 'CPF inválido';
  END IF;
  IF v_cpf IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE cpf = v_cpf) THEN
    RAISE EXCEPTION 'CPF já cadastrado';
  END IF;
  INSERT INTO public.profiles (id, full_name, avatar_url, email, cpf, birth_date, phone)
  VALUES (NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email,
    v_cpf,
    NULLIF(v_birth,'')::date,
    NULLIF(NEW.raw_user_meta_data->>'phone',''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 6. Public RPC: resolve email by CPF for login. Returns email (or null).
CREATE OR REPLACE FUNCTION public.get_email_by_cpf(_cpf text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_email TEXT; v_digits TEXT;
BEGIN
  v_digits := regexp_replace(COALESCE(_cpf,''), '\D', '', 'g');
  IF length(v_digits) <> 11 THEN RETURN NULL; END IF;
  SELECT email INTO v_email FROM public.profiles WHERE cpf = v_digits LIMIT 1;
  RETURN v_email;
END;
$$;

REVOKE ALL ON FUNCTION public.get_email_by_cpf(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_email_by_cpf(text) TO anon, authenticated;

-- 7. Authenticated RPC to finish Google signup by adding CPF/birth/phone
CREATE OR REPLACE FUNCTION public.complete_signup_cpf(
  _cpf text, _birth_date date, _phone text, _full_name text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid UUID := auth.uid(); v_digits TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_digits := regexp_replace(COALESCE(_cpf,''), '\D', '', 'g');
  IF NOT public.validate_cpf(v_digits) THEN RAISE EXCEPTION 'CPF inválido'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE cpf = v_digits AND id <> v_uid) THEN
    RAISE EXCEPTION 'CPF já cadastrado';
  END IF;
  IF _birth_date IS NULL THEN RAISE EXCEPTION 'Data de nascimento obrigatória'; END IF;
  IF _phone IS NULL OR length(regexp_replace(_phone,'\D','','g')) < 10 THEN
    RAISE EXCEPTION 'Celular inválido';
  END IF;
  UPDATE public.profiles
     SET cpf = v_digits,
         birth_date = _birth_date,
         phone = _phone,
         full_name = COALESCE(NULLIF(_full_name,''), full_name),
         updated_at = now()
   WHERE id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_signup_cpf(text, date, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_signup_cpf(text, date, text, text) TO authenticated;
