-- Forward-only compatibility correction: production allowed_sections is jsonb.
-- No data changes; preserve the public allowlist and fiscal authorization.
BEGIN;
CREATE OR REPLACE FUNCTION public.health_public_sections(value jsonb)
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = pg_catalog, public AS $$
  SELECT coalesce(array_agg(element #>> '{}'), ARRAY[]::text[])
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(value) = 'array' THEN value ELSE '[]'::jsonb END) element
  WHERE jsonb_typeof(element) = 'string';
$$;
REVOKE ALL ON FUNCTION public.health_public_sections(jsonb) FROM PUBLIC, anon, authenticated;
DO $patch$
DECLARE definition text;
BEGIN
  definition := pg_get_functiondef('public.get_public_health_report(text)'::regprocedure);
  IF strpos(definition, 'unnest(s.allowed_sections)') = 0 THEN
    RAISE EXCEPTION 'Unexpected public report definition; refusing compatibility patch';
  END IF;
  EXECUTE replace(definition, 'unnest(s.allowed_sections)', 'unnest(public.health_public_sections(s.allowed_sections))');
  definition := pg_get_functiondef('public.get_fiscal_document_url(text,uuid)'::regprocedure);
  IF strpos(definition, 'ANY(s.allowed_sections)') = 0 THEN
    RAISE EXCEPTION 'Unexpected fiscal definition; refusing compatibility patch';
  END IF;
  EXECUTE replace(definition, 'ANY(s.allowed_sections)', 'ANY(public.health_public_sections(s.allowed_sections))');
END $patch$;
COMMIT;
