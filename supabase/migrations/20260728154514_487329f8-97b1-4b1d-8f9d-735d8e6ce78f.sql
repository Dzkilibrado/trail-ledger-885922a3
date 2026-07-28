
-- Add UPDATE policy for certificates (owner) — previously missing, causing "Cannot coerce ... single JSON object" on save.
CREATE POLICY cert_update_owner ON public.certificates
  FOR UPDATE TO authenticated
  USING (public.is_moto_owner(motorcycle_id))
  WITH CHECK (public.is_moto_owner(motorcycle_id));

-- Add revocation audit fields (no rename/removal of existing columns).
ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS revoked_reason_code text,
  ADD COLUMN IF NOT EXISTS revoked_reason_notes text,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
