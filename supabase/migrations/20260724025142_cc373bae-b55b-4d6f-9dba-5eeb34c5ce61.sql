-- 1) Segredo interno (pepper) para HMAC do hash de auditoria.
--    Sem policies e sem grants — apenas o proprietário (postgres) e funções
--    SECURITY DEFINER conseguem ler. Cliente jamais acessa.
CREATE TABLE IF NOT EXISTS public.buyer_search_secret (
  id boolean PRIMARY KEY DEFAULT true,
  pepper text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT buyer_search_secret_singleton CHECK (id = true)
);
ALTER TABLE public.buyer_search_secret ENABLE ROW LEVEL SECURITY;
-- Nenhuma policy: bloqueia qualquer acesso via PostgREST/roles regulares.
REVOKE ALL ON public.buyer_search_secret FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.buyer_search_secret TO service_role;

INSERT INTO public.buyer_search_secret (id, pepper)
VALUES (true, encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (id) DO NOTHING;

-- 2) E-mail mascarado — mesma filosofia do mask_cpf.
CREATE OR REPLACE FUNCTION public.mask_email(_email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT CASE
    WHEN _email IS NULL OR position('@' in _email) = 0 THEN NULL
    ELSE
      left(split_part(_email, '@', 1), 1)
      || '***@'
      || split_part(_email, '@', 2)
  END
$$;

-- 3) RPC atualizada: devolve email_masked (nunca o e-mail cru) e usa
--    HMAC-SHA256 com pepper interno para o hash de auditoria.
DROP FUNCTION IF EXISTS public.find_trailbook_buyer(text);

CREATE OR REPLACE FUNCTION public.find_trailbook_buyer(_query text)
RETURNS TABLE(id uuid, full_name text, email_masked text, cpf_masked text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_norm text;
  v_digits text;
  v_type text;
  v_hash text;
  v_pepper text;
  v_recent_count int;
  v_match_count int;
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
    v_type := 'cpf';
  ELSIF position('@' in v_norm) > 0 THEN
    v_type := 'email';
    v_norm := lower(v_norm);
  ELSE
    RAISE EXCEPTION 'invalid_input' USING ERRCODE = '22023';
  END IF;

  -- 3) rate limit best-effort: máx 20 buscas / minuto por usuário.
  --    A verificação e o registro não são atômicos — em rajadas simultâneas
  --    pode haver leve estouro; é uma barreira de mitigação, não garantia.
  SELECT count(*) INTO v_recent_count
  FROM public.buyer_search_audit
  WHERE searcher_id = v_uid
    AND searched_at > now() - interval '1 minute';

  IF v_recent_count >= 20 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = '54000';
  END IF;

  -- 4) HMAC-SHA256 com pepper interno — impede reversão do CPF por
  --    tentativa sistemática a partir do query_hash na tabela de auditoria.
  SELECT pepper INTO v_pepper FROM public.buyer_search_secret WHERE id = true;
  v_hash := encode(
    public.hmac(
      v_type || ':' || coalesce(v_digits, v_norm),
      v_pepper,
      'sha256'
    ),
    'hex'
  );

  -- 5) contagem preliminar (apenas ativos)
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

  -- 6) unicidade — inconsistência retorna erro neutro
  IF v_match_count > 1 THEN
    INSERT INTO public.buyer_search_audit (searcher_id, search_type, query_hash, found, error_code)
    VALUES (v_uid, v_type, v_hash, false, 'duplicate_match');
    RAISE EXCEPTION 'duplicate_match' USING ERRCODE = 'P0001';
  END IF;

  -- 7) sem match: registra e devolve vazio
  IF v_match_count = 0 THEN
    INSERT INTO public.buyer_search_audit (searcher_id, search_type, query_hash, found, error_code)
    VALUES (v_uid, v_type, v_hash, false, null);
    RETURN;
  END IF;

  -- 8) match único: registra e devolve linha mínima (e-mail mascarado)
  INSERT INTO public.buyer_search_audit (searcher_id, search_type, query_hash, found, error_code)
  VALUES (v_uid, v_type, v_hash, true, null);

  IF v_type = 'cpf' THEN
    RETURN QUERY
      SELECT p.id, p.full_name,
             public.mask_email(p.email),
             public.mask_cpf(p.cpf)
      FROM public.profiles p
      WHERE regexp_replace(coalesce(p.cpf,''), '\D', '', 'g') = v_digits
        AND p.status = 'active';
  ELSE
    RETURN QUERY
      SELECT p.id, p.full_name,
             public.mask_email(p.email),
             public.mask_cpf(p.cpf)
      FROM public.profiles p
      WHERE lower(p.email) = v_norm
        AND p.status = 'active';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.find_trailbook_buyer(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_trailbook_buyer(text) TO authenticated;

-- 4) Política de retenção documentada da auditoria de buscas.
COMMENT ON TABLE public.buyer_search_audit IS
  'Auditoria de buscas de comprador do Recibo Inteligente. '
  'Política recomendada de retenção: 180 dias. '
  'Acesso: próprio usuário e administradores (policy audit_select_own). '
  'query_hash é HMAC-SHA256 com pepper interno em public.buyer_search_secret.';
