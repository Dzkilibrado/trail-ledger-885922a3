CREATE OR REPLACE FUNCTION public.find_trailbook_buyer(_query text)
 RETURNS TABLE(id uuid, full_name text, email_masked text, cpf_masked text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
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
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

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

  SELECT count(*) INTO v_recent_count
  FROM public.buyer_search_audit bsa
  WHERE bsa.searcher_id = v_uid
    AND bsa.searched_at > now() - interval '1 minute';

  IF v_recent_count >= 20 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = '54000';
  END IF;

  SELECT bss.pepper INTO v_pepper
  FROM public.buyer_search_secret bss
  WHERE bss.id = true;

  IF v_pepper IS NULL THEN
    RAISE EXCEPTION 'buyer_search_secret_missing' USING ERRCODE = 'P0001';
  END IF;

  v_hash := encode(
    extensions.hmac(
      (v_type || ':' || coalesce(v_digits, v_norm))::text,
      v_pepper::text,
      'sha256'::text
    ),
    'hex'
  );

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

  IF v_match_count > 1 THEN
    INSERT INTO public.buyer_search_audit (searcher_id, search_type, query_hash, found, error_code)
    VALUES (v_uid, v_type, v_hash, false, 'duplicate_match');
    RAISE EXCEPTION 'duplicate_match' USING ERRCODE = 'P0001';
  END IF;

  IF v_match_count = 0 THEN
    INSERT INTO public.buyer_search_audit (searcher_id, search_type, query_hash, found, error_code)
    VALUES (v_uid, v_type, v_hash, false, null);
    RETURN;
  END IF;

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

REVOKE ALL ON FUNCTION public.find_trailbook_buyer(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.find_trailbook_buyer(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.find_trailbook_buyer(text) TO authenticated;