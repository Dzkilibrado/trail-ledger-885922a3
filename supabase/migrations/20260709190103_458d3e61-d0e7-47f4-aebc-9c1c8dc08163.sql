
-- 1. Enum extension for bill_of_sale
ALTER TYPE public.motorcycle_document_type ADD VALUE IF NOT EXISTS 'bill_of_sale';

-- 2. Origin type enum
DO $$ BEGIN
  CREATE TYPE public.motorcycle_origin_type AS ENUM (
    'zero_km','private','dealer','trailbook_transfer','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Motorcycles: origin columns
ALTER TABLE public.motorcycles
  ADD COLUMN IF NOT EXISTS origin_type public.motorcycle_origin_type,
  ADD COLUMN IF NOT EXISTS origin_set_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS origin_notes TEXT;

-- 4. Motorcycle documents: origin flag
ALTER TABLE public.motorcycle_documents
  ADD COLUMN IF NOT EXISTS is_origin_document BOOLEAN NOT NULL DEFAULT false;

-- Exactly one origin doc per moto (only current + not deleted)
CREATE UNIQUE INDEX IF NOT EXISTS ux_moto_origin_doc
  ON public.motorcycle_documents (motorcycle_id)
  WHERE is_origin_document = true AND is_current = true AND deleted_at IS NULL;

-- 5. Smart Receipts
CREATE TABLE IF NOT EXISTS public.smart_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  motorcycle_id UUID NOT NULL REFERENCES public.motorcycles(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  sha256 TEXT,
  bucket TEXT,
  pdf_path TEXT,
  qr_path TEXT,
  seller_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  buyer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  seller_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  buyer_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  motorcycle_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  negotiation JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','issued','signed','cancelled')),
  version INTEGER NOT NULL DEFAULT 1,
  previous_receipt_id UUID REFERENCES public.smart_receipts(id) ON DELETE SET NULL,
  issued_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  created_by UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.smart_receipts TO authenticated;
GRANT ALL ON public.smart_receipts TO service_role;

ALTER TABLE public.smart_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parties can view their receipts"
  ON public.smart_receipts FOR SELECT TO authenticated
  USING (
    auth.uid() = seller_id
    OR auth.uid() = buyer_id
    OR auth.uid() = created_by
    OR public.is_moto_owner(motorcycle_id)
    OR public.is_user_admin(auth.uid())
  );

CREATE POLICY "Seller/owner can create receipts"
  ON public.smart_receipts FOR INSERT TO authenticated
  WITH CHECK (
    (auth.uid() = seller_id OR public.is_moto_owner(motorcycle_id))
    AND auth.uid() = created_by
  );

CREATE POLICY "Seller can update draft receipts"
  ON public.smart_receipts FOR UPDATE TO authenticated
  USING (auth.uid() = seller_id AND status IN ('draft','issued'))
  WITH CHECK (auth.uid() = seller_id);

CREATE INDEX IF NOT EXISTS idx_smart_receipts_moto ON public.smart_receipts(motorcycle_id);
CREATE INDEX IF NOT EXISTS idx_smart_receipts_seller ON public.smart_receipts(seller_id);
CREATE INDEX IF NOT EXISTS idx_smart_receipts_buyer ON public.smart_receipts(buyer_id);

CREATE TRIGGER smart_receipts_touch_updated_at
  BEFORE UPDATE ON public.smart_receipts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 6. Receipt code generation
CREATE SEQUENCE IF NOT EXISTS public.smart_receipt_code_seq;

CREATE OR REPLACE FUNCTION public.generate_smart_receipt_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'TB-RCV-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.smart_receipt_code_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER smart_receipts_generate_code
  BEFORE INSERT ON public.smart_receipts
  FOR EACH ROW EXECUTE FUNCTION public.generate_smart_receipt_code();

-- 7. Public validation view (no PII beyond mask)
CREATE OR REPLACE VIEW public.public_receipt_validation AS
SELECT
  r.code,
  r.sha256,
  r.status,
  r.issued_at,
  r.signed_at,
  r.version,
  (r.motorcycle_snapshot->>'brand') AS moto_brand,
  (r.motorcycle_snapshot->>'model') AS moto_model,
  (r.motorcycle_snapshot->>'year_model') AS moto_year_model,
  (r.motorcycle_snapshot->>'chassis') AS moto_chassis,
  (r.seller_snapshot->>'full_name') AS seller_name,
  CASE WHEN (r.seller_snapshot->>'cpf') IS NULL THEN NULL
       ELSE '***.***.***-' || right(regexp_replace(r.seller_snapshot->>'cpf','\D','','g'),2)
  END AS seller_cpf_masked,
  (r.buyer_snapshot->>'full_name') AS buyer_name,
  CASE WHEN (r.buyer_snapshot->>'cpf') IS NULL THEN NULL
       ELSE '***.***.***-' || right(regexp_replace(r.buyer_snapshot->>'cpf','\D','','g'),2)
  END AS buyer_cpf_masked,
  (r.negotiation->>'amount') AS amount,
  (r.negotiation->>'date') AS negotiation_date,
  (r.negotiation->>'location') AS negotiation_location
FROM public.smart_receipts r
WHERE r.status IN ('issued','signed');

GRANT SELECT ON public.public_receipt_validation TO anon, authenticated;

-- 8. Document pendencies view (per moto)
CREATE OR REPLACE VIEW public.document_pendencies_view
WITH (security_invoker = true)
AS
SELECT
  m.id AS motorcycle_id,
  m.owner_id,
  m.nickname,
  m.brand,
  m.model,
  m.year_model,
  m.origin_type,
  CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM public.motorcycle_documents d
       WHERE d.motorcycle_id = m.id
         AND d.is_origin_document = true
         AND d.is_current = true
         AND d.deleted_at IS NULL
    ) THEN true ELSE false
  END AS has_origin_pendency,
  CASE m.origin_type
    WHEN 'zero_km' THEN 'invoice'
    WHEN 'private' THEN 'invoice_or_bill_of_sale'
    WHEN 'dealer' THEN 'invoice_or_bill_of_sale'
    WHEN 'trailbook_transfer' THEN 'bill_of_sale'
    WHEN 'other' THEN 'any'
    ELSE 'origin_undefined'
  END AS expected_kind
FROM public.motorcycles m
WHERE m.status = 'active';

GRANT SELECT ON public.document_pendencies_view TO authenticated;
