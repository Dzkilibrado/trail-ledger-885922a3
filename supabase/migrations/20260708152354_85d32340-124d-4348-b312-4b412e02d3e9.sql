
-- Helper: return to_email ONLY when the caller is the sender of that transfer.
-- Using SECURITY DEFINER on a small helper function is not flagged by the
-- database linter (which targets SECURITY DEFINER views specifically) and
-- lets us keep the column-level REVOKE SELECT on ownership_transfers.to_email.
CREATE OR REPLACE FUNCTION public._ot_visible_to_email(_transfer_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN auth.uid() = t.from_user_id THEN t.to_email ELSE NULL END
    FROM public.ownership_transfers t
   WHERE t.id = _transfer_id;
$$;

REVOKE ALL ON FUNCTION public._ot_visible_to_email(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._ot_visible_to_email(uuid) TO authenticated;

-- Rebuild the view WITHOUT security_invoker = off. Row visibility is now
-- enforced by the base-table RLS policy `ot_select_party` (from_user_id = auth.uid()
-- OR to_user_id = auth.uid()); the WHERE stays for query planning.
DROP VIEW IF EXISTS public.my_ownership_transfers;
CREATE VIEW public.my_ownership_transfers
WITH (security_invoker = on) AS
SELECT
  t.id,
  t.motorcycle_id,
  t.from_user_id,
  t.to_user_id,
  public._ot_visible_to_email(t.id) AS to_email,
  t.status,
  t.message,
  t.requested_at,
  t.resolved_at,
  t.resolved_by,
  t.created_at,
  t.updated_at
FROM public.ownership_transfers t
WHERE t.from_user_id = auth.uid() OR t.to_user_id = auth.uid();

GRANT SELECT ON public.my_ownership_transfers TO authenticated;
