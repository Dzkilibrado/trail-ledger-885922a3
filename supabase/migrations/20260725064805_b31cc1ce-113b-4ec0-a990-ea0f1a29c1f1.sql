
-- 1) Remove política que expunha colunas sensíveis a qualquer autenticado
DROP POLICY IF EXISTS workshops_select_safe_cols ON public.workshops;

-- 2) Substitui a view por uma função SECURITY DEFINER com projeção fixa e segura
DROP VIEW IF EXISTS public.workshops_public;

CREATE OR REPLACE FUNCTION public.list_workshops_public()
RETURNS TABLE (
  id uuid,
  name text,
  city text,
  state text,
  verified boolean,
  verified_at timestamptz,
  verified_label text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT w.id, w.name, w.city, w.state, w.verified, w.verified_at, w.verified_label, w.created_at, w.updated_at
  FROM public.workshops w
  ORDER BY w.name;
$$;

REVOKE ALL ON FUNCTION public.list_workshops_public() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_workshops_public() TO authenticated;

-- 3) Recria a view apontando para a função (mantém compatibilidade dos consumidores atuais)
CREATE VIEW public.workshops_public
WITH (security_invoker = on) AS
SELECT * FROM public.list_workshops_public();

GRANT SELECT ON public.workshops_public TO authenticated;
