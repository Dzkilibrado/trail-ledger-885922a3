-- Remove SECURITY DEFINER behavior from workshops_public view.
-- Instead, rely on column-level grants + broad SELECT policy so non-sensitive
-- columns (id, name, city, state, verified flags) are readable by authenticated
-- users, while phone/cnpj remain protected (no grant).

ALTER VIEW public.workshops_public SET (security_invoker = true);

-- Broad, safe-column SELECT policy on the base table. RLS is row-level;
-- column-level GRANTs enforce the field restriction.
DROP POLICY IF EXISTS workshops_select_safe_cols ON public.workshops;
CREATE POLICY workshops_select_safe_cols
  ON public.workshops FOR SELECT
  TO authenticated
  USING (true);

-- Column-level grants: only non-PII columns are readable by authenticated.
-- phone and cnpj are intentionally excluded — access those via
-- get_workshop_private / my_workshop_private (SECURITY DEFINER RPCs).
GRANT SELECT (
  id, name, city, state, verified, verified_at, verified_label,
  owner_user_id, created_at, updated_at
) ON public.workshops TO authenticated;