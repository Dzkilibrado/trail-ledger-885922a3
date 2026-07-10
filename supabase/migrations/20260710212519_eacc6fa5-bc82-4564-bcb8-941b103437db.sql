-- Reduz exposição pública do Recibo Inteligente
-- Motivo: códigos são sequenciais (TB-RCV-YYYY-NNNNNN) e podem ser enumerados.
-- A view pública deixa de expor PII (chassi, nomes, CPFs, valor) e mantém só o essencial de autenticidade.

DROP FUNCTION IF EXISTS public.get_public_receipt(text) CASCADE;
DROP VIEW IF EXISTS public.public_receipt_validation CASCADE;

CREATE VIEW public.public_receipt_validation
WITH (security_invoker = true) AS
SELECT
  code,
  sha256,
  status,
  issued_at,
  signed_at,
  completed_at,
  version,
  previous_receipt_id,
  (motorcycle_snapshot ->> 'brand') AS moto_brand,
  (motorcycle_snapshot ->> 'model') AS moto_model,
  (motorcycle_snapshot ->> 'year_model') AS moto_year_model,
  external_buyer,
  (signed_pdf_path IS NOT NULL) AS has_signed_document
FROM public.smart_receipts
WHERE status IN ('issued','awaiting_acceptance','completed','superseded','revoked');

GRANT SELECT ON public.public_receipt_validation TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_receipt(_code text)
RETURNS SETOF public.public_receipt_validation
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.public_receipt_validation WHERE code = _code LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_receipt(text) TO anon, authenticated;