
-- Fix 1: workshops — remove permissive SELECT that exposed all columns to authenticated users.
-- The workshops_public view (safe columns only) becomes the sole public read surface.
DROP POLICY IF EXISTS workshops_select_safe_cols ON public.workshops;

-- Recreate view as SECURITY DEFINER so authenticated users can list safe columns
-- for all workshops without triggering RLS on the underlying table.
DROP VIEW IF EXISTS public.workshops_public;
CREATE VIEW public.workshops_public
WITH (security_invoker = false) AS
SELECT id, name, city, state, verified, verified_at, verified_label,
       owner_user_id, created_at, updated_at
FROM public.workshops;

GRANT SELECT ON public.workshops_public TO authenticated, anon;

-- Fix 2: ownership_transfers — remove the permissive UPDATE policy.
-- All legitimate state transitions go through SECURITY DEFINER RPCs
-- (respond_ownership_transfer, cancel_ownership_transfer, etc.),
-- so no authenticated party needs direct UPDATE access.
DROP POLICY IF EXISTS ot_update_party ON public.ownership_transfers;
