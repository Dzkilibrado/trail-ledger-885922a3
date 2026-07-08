
-- Drop the helper view (no longer needed).
DROP VIEW IF EXISTS public.workshops_public;

-- Restore listing access for all authenticated users, but only for non-sensitive columns
-- via column-level GRANTs below.
DROP POLICY IF EXISTS workshops_select_own ON public.workshops;

CREATE POLICY workshops_select_all_auth
  ON public.workshops
  FOR SELECT
  TO authenticated
  USING (true);

-- Column-level privileges: revoke blanket SELECT, grant only non-sensitive columns.
REVOKE SELECT ON public.workshops FROM authenticated;
REVOKE SELECT ON public.workshops FROM anon;

GRANT SELECT
  (id, name, city, state, owner_user_id, verified, verified_at, verified_label, created_at, updated_at)
  ON public.workshops
  TO authenticated;

-- cnpj and phone are intentionally NOT granted to authenticated.
-- Owners access them via public.my_workshop_private(uuid) (SECURITY DEFINER).
-- service_role retains full access via GRANT ALL (unchanged).
GRANT ALL ON public.workshops TO service_role;
