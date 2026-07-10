-- Fase A: colunas de perfil ampliadas
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS whatsapp_same_as_phone boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS uf char(2),
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS ibge_code text,
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS logradouro text,
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS complemento text,
  ADD COLUMN IF NOT EXISTS profile_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS cpf_locked_at timestamptz;

-- Trigger: grava cpf_locked_at quando o CPF é preenchido; bloqueia alteração posterior
-- exceto para service_role (fluxo de suporte com auditoria).
CREATE OR REPLACE FUNCTION public.profiles_lock_cpf()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.cpf IS NOT NULL AND NEW.cpf_locked_at IS NULL THEN
      NEW.cpf_locked_at := now();
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF OLD.cpf IS DISTINCT FROM NEW.cpf THEN
    IF OLD.cpf IS NULL AND NEW.cpf IS NOT NULL THEN
      NEW.cpf_locked_at := now();
    ELSIF OLD.cpf IS NOT NULL THEN
      -- Só service_role pode alterar CPF já travado (fluxo de suporte auditado)
      IF current_setting('request.jwt.claims', true)::jsonb ->> 'role' <> 'service_role' THEN
        RAISE EXCEPTION 'CPF já validado — alteração somente via suporte'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_lock_cpf ON public.profiles;
CREATE TRIGGER trg_profiles_lock_cpf
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_lock_cpf();

-- Backfill: perfis existentes com CPF preenchido são considerados travados desde já.
UPDATE public.profiles
SET cpf_locked_at = COALESCE(cpf_locked_at, updated_at, created_at, now())
WHERE cpf IS NOT NULL AND cpf_locked_at IS NULL;

-- Função de completude: retorna percentual e lista de pendências
CREATE OR REPLACE FUNCTION public.profile_completeness(_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.profiles%ROWTYPE;
  missing text[] := ARRAY[]::text[];
  required_count int := 8; -- full_name, cpf, birth_date, email, phone, whatsapp, uf, city
  filled int := 0;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = _user;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('pct', 0, 'missing', to_jsonb(ARRAY['full_name','cpf','birth_date','email','phone','whatsapp','uf','city']));
  END IF;

  IF COALESCE(btrim(p.full_name), '') <> '' THEN filled := filled + 1; ELSE missing := array_append(missing, 'full_name'); END IF;
  IF COALESCE(btrim(p.cpf), '') <> '' THEN filled := filled + 1; ELSE missing := array_append(missing, 'cpf'); END IF;
  IF p.birth_date IS NOT NULL THEN filled := filled + 1; ELSE missing := array_append(missing, 'birth_date'); END IF;
  IF COALESCE(btrim(p.email), '') <> '' THEN filled := filled + 1; ELSE missing := array_append(missing, 'email'); END IF;
  IF COALESCE(btrim(p.phone), '') <> '' THEN filled := filled + 1; ELSE missing := array_append(missing, 'phone'); END IF;
  IF COALESCE(btrim(p.whatsapp), '') <> '' OR p.whatsapp_same_as_phone THEN filled := filled + 1; ELSE missing := array_append(missing, 'whatsapp'); END IF;
  IF COALESCE(btrim(p.uf), '') <> '' THEN filled := filled + 1; ELSE missing := array_append(missing, 'uf'); END IF;
  IF COALESCE(btrim(p.city), '') <> '' THEN filled := filled + 1; ELSE missing := array_append(missing, 'city'); END IF;

  RETURN jsonb_build_object(
    'pct', (filled * 100) / required_count,
    'missing', to_jsonb(missing),
    'completed', (array_length(missing, 1) IS NULL)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.profile_completeness(uuid) TO authenticated, service_role;