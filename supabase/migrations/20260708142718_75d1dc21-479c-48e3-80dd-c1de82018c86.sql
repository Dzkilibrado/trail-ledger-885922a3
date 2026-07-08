
-- =============================================================
-- Fix: workshops_phone_cnpj_public_read
-- Remove column-level SELECT on cnpj/phone for authenticated users.
-- Owners still write via INSERT/UPDATE and can read their own private
-- fields through the SECURITY DEFINER function below.
-- =============================================================
REVOKE SELECT (cnpj, phone) ON public.workshops FROM authenticated;
REVOKE SELECT (cnpj, phone) ON public.workshops FROM anon;

-- Owner-only read of private workshop fields
CREATE OR REPLACE FUNCTION public.my_workshop_private(_workshop uuid)
RETURNS TABLE (id uuid, cnpj text, phone text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT w.id, w.cnpj, w.phone
    FROM public.workshops w
   WHERE w.id = _workshop
     AND w.owner_user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.my_workshop_private(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_workshop_private(uuid) TO authenticated;

-- =============================================================
-- Fix: ownership_transfers_to_email_recipient_read
-- Recreate my_ownership_transfers so to_email is ALWAYS null unless
-- the caller is the sender (from_user_id). Combined with the existing
-- trigger that clears to_email as soon as to_user_id is populated and
-- the column-level REVOKE on the base table, the recipient can never
-- read the invite email.
-- =============================================================
DROP VIEW IF EXISTS public.my_ownership_transfers;
CREATE VIEW public.my_ownership_transfers
WITH (security_invoker = off) AS
SELECT
  id,
  motorcycle_id,
  from_user_id,
  to_user_id,
  CASE WHEN auth.uid() = from_user_id THEN to_email ELSE NULL END AS to_email,
  status,
  message,
  requested_at,
  resolved_at,
  resolved_by,
  created_at,
  updated_at
FROM public.ownership_transfers
WHERE from_user_id = auth.uid() OR to_user_id = auth.uid();

GRANT SELECT ON public.my_ownership_transfers TO authenticated;
