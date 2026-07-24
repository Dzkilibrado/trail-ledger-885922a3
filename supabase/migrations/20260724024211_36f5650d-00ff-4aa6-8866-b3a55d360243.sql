
-- Auditoria de buscas de comprador (não guarda o valor pesquisado em claro; usa hash)
CREATE TABLE IF NOT EXISTS public.buyer_search_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  searcher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  searched_at timestamptz NOT NULL DEFAULT now(),
  search_type text NOT NULL CHECK (search_type IN ('cpf','email')),
  query_hash text NOT NULL,
  found boolean NOT NULL,
  error_code text
);

GRANT SELECT ON public.buyer_search_audit TO authenticated;
GRANT ALL ON public.buyer_search_audit TO service_role;

ALTER TABLE public.buyer_search_audit ENABLE ROW LEVEL SECURITY;

-- Usuário vê apenas suas próprias buscas; admins veem todas
CREATE POLICY "audit_select_own"
  ON public.buyer_search_audit FOR SELECT
  TO authenticated
  USING (auth.uid() = searcher_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_buyer_search_audit_searcher_time
  ON public.buyer_search_audit (searcher_id, searched_at DESC);

-- Máscara de CPF: 000.000.000-00 -> ***.***.***-00
CREATE OR REPLACE FUNCTION public.mask_cpf(_cpf text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _cpf IS NULL OR length(regexp_replace(_cpf, '\D', '', 'g')) < 11 THEN NULL
    ELSE '***.***.***-' || right(regexp_replace(_cpf, '\D', '', 'g'), 2)
  END
$$;

-- RPC principal: busca por CPF OU e-mail, nunca ambos ao mesmo tempo
CREATE OR REPLACE FUNCTION public.find_trailbook_buyer(_query text)
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  cpf_masked text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_norm text;
  v_digits text;
  v_type text;
  v_hash text;
  v_recent_count int;
  v_match_count int;
  r RECORD;
BEGIN
  -- 1) exige autenticação
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  -- 2) normalização e detecção de tipo
  v_norm := btrim(coalesce(_query, ''));
  IF v_norm = '' THEN
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  v_digits := regexp_replace(v_norm, '\D', '', 'g');

  IF v_digits = v_norm AND length(v_digits) = 11 THEN
    v_type := 'cpf';
  ELSIF length(v_digits) >= 11 AND regexp_replace(v_norm, '[\d\.\-\s]', '', 'g') = '' THEN
    -- entrada aparenta ser CPF mascarado (só dígitos + . - espaço)
    v_type := 'cpf';
  ELSIF position('@' in v_norm) > 0 THEN
    v_type := 'email';
    v_norm := lower(v_norm);
  ELSE
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  -- 3) rate limit básico: máx 20 buscas / minuto por usuário
  SELECT count(*) INTO v_recent_count
  FROM public.buyer_search_audit
  WHERE searcher_id = v_uid
    AND searched_at > now() - interval '1 minute';

  IF v_recent_count >= 20 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = '54000';
  END IF;

  -- 4) hash da consulta (não guarda valor em claro)
  v_hash := encode(digest(v_type || ':' || coalesce(v_digits, v_norm), 'sha256'), 'hex');

  -- 5) executa consulta (nunca por nome) — SECURITY DEFINER bypassa RLS mas
  --    o SELECT está restrito às colunas mínimas retornadas abaixo.
  IF v_type = 'cpf' THEN
    SELECT count(*) INTO v_match_count
    FROM public.profiles p
    WHERE regexp_replace(coalesce(p.cpf,''), '\D', '', 'g') = v_digits
      AND p.status = 'active';
  ELSE
    SELECT count(*) INTO v_match_count
    FROM public.profiles p
    WHERE lower(p.email) = v_norm
      AND p.status = 'active';
  END IF;

  -- 6) unicidade — inconsistência retorna erro controlado
  IF v_match_count > 1 THEN
    INSERT INTO public.buyer_search_audit (searcher_id, search_type, query_hash, found, error_code)
    VALUES (v_uid, v_type, v_hash, false, 'duplicate_match');
    RAISE EXCEPTION 'duplicate_match' USING ERRCODE = 'P0001';
  END IF;

  -- 7) sem match: registra e retorna vazio
  IF v_match_count = 0 THEN
    INSERT INTO public.buyer_search_audit (searcher_id, search_type, query_hash, found, error_code)
    VALUES (v_uid, v_type, v_hash, false, null);
    RETURN;
  END IF;

  -- 8) match único: registra sucesso e devolve linha mínima (sem CPF cru)
  INSERT INTO public.buyer_search_audit (searcher_id, search_type, query_hash, found, error_code)
  VALUES (v_uid, v_type, v_hash, true, null);

  IF v_type = 'cpf' THEN
    RETURN QUERY
      SELECT p.id, p.full_name, p.email, public.mask_cpf(p.cpf)
      FROM public.profiles p
      WHERE regexp_replace(coalesce(p.cpf,''), '\D', '', 'g') = v_digits
        AND p.status = 'active';
  ELSE
    RETURN QUERY
      SELECT p.id, p.full_name, p.email, public.mask_cpf(p.cpf)
      FROM public.profiles p
      WHERE lower(p.email) = v_norm
        AND p.status = 'active';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.find_trailbook_buyer(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_trailbook_buyer(text) TO authenticated;

REVOKE ALL ON FUNCTION public.mask_cpf(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mask_cpf(text) TO authenticated, service_role;
