
-- Undo the permissive policy added in the previous migration
DROP POLICY IF EXISTS workshops_select_public_via_view ON public.workshops;

-- Recreate the public view WITHOUT security_invoker so it bypasses RLS
-- and exposes only non-sensitive columns to authenticated users.
DROP VIEW IF EXISTS public.workshops_public;

CREATE VIEW public.workshops_public AS
SELECT
  id,
  name,
  city,
  state,
  owner_user_id,
  verified,
  verified_at,
  verified_label,
  created_at,
  updated_at
FROM public.workshops;

ALTER VIEW public.workshops_public OWNER TO postgres;

GRANT SELECT ON public.workshops_public TO authenticated;

-- Base table now: only the owner can SELECT full row (including cnpj/phone).
-- (workshops_select_own policy from previous migration remains in place.)
