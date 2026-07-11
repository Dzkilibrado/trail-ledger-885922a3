
-- Fix mutable search_path on hash_cpf and mask_cpf
CREATE OR REPLACE FUNCTION public.mask_cpf(_cpf text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _cpf IS NULL OR length(_cpf) < 4 THEN NULL
    ELSE '***.***.***-' || right(_cpf, 2)
  END;
$function$;

CREATE OR REPLACE FUNCTION public.hash_cpf(_cpf text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'extensions'
AS $function$
  SELECT encode(digest(regexp_replace(coalesce(_cpf,''),'\D','','g'), 'sha256'), 'hex');
$function$;

-- Revoke column-level SELECT on workshops sensitive fields from authenticated.
-- Owners continue reading these via the SECURITY DEFINER RPC my_workshop_private().
REVOKE SELECT (cnpj, phone) ON public.workshops FROM authenticated;
