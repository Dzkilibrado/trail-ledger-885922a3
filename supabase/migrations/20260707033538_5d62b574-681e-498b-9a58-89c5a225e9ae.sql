-- Fix 1: Catalog tables should require exact 'admin' role, not legacy USER_ADMIN
DROP POLICY IF EXISTS brands_admin_write ON public.motorcycle_brands;
CREATE POLICY brands_admin_write ON public.motorcycle_brands
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS models_admin_write ON public.motorcycle_models;
CREATE POLICY models_admin_write ON public.motorcycle_models
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS engines_admin_write ON public.motorcycle_model_engines;
CREATE POLICY engines_admin_write ON public.motorcycle_model_engines
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS years_admin_write ON public.motorcycle_model_years;
CREATE POLICY years_admin_write ON public.motorcycle_model_years
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS defaults_admin_write ON public.motorcycle_model_defaults;
CREATE POLICY defaults_admin_write ON public.motorcycle_model_defaults
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS types_admin_write ON public.motorcycle_types_ref;
CREATE POLICY types_admin_write ON public.motorcycle_types_ref
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Fix 2: Prevent recipients from reading to_email on ownership_transfers.
-- Approach: clear to_email as soon as to_user_id is populated (recipient
-- identified). The sender already knows the email they typed; the recipient
-- never needs to see it. This eliminates the exposure surface entirely.
CREATE OR REPLACE FUNCTION public.clear_transfer_to_email()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.to_user_id IS NOT NULL THEN
    NEW.to_email := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_clear_transfer_to_email ON public.ownership_transfers;
CREATE TRIGGER trg_clear_transfer_to_email
  BEFORE INSERT OR UPDATE ON public.ownership_transfers
  FOR EACH ROW EXECUTE FUNCTION public.clear_transfer_to_email();

-- Backfill: clear to_email on existing rows where the recipient is known
UPDATE public.ownership_transfers
   SET to_email = NULL
 WHERE to_user_id IS NOT NULL AND to_email IS NOT NULL;

-- Additionally, restrict column-level SELECT on to_email so it is never
-- returned to any authenticated user via the Data API. Sender-side reads
-- of pending invites (where to_user_id is still null) must go through an
-- RPC in the future if needed.
REVOKE SELECT (to_email) ON public.ownership_transfers FROM authenticated;