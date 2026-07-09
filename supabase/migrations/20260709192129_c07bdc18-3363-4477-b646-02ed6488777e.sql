
CREATE POLICY "smart_receipts_read_owner" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'smart-receipts' AND EXISTS (
    SELECT 1 FROM public.smart_receipts r
    WHERE r.pdf_path = storage.objects.name
      AND (r.seller_id = auth.uid() OR r.buyer_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  )
);

CREATE POLICY "smart_receipts_service_all" ON storage.objects FOR ALL TO service_role
USING (bucket_id = 'smart-receipts') WITH CHECK (bucket_id = 'smart-receipts');

DROP VIEW IF EXISTS public.public_receipt_validation;
CREATE VIEW public.public_receipt_validation
WITH (security_invoker = true) AS
SELECT code, sha256, status, issued_at, signed_at, version, previous_receipt_id,
  (motorcycle_snapshot ->> 'brand') AS moto_brand,
  (motorcycle_snapshot ->> 'model') AS moto_model,
  (motorcycle_snapshot ->> 'year_model') AS moto_year_model,
  (motorcycle_snapshot ->> 'chassis') AS moto_chassis,
  (seller_snapshot ->> 'full_name') AS seller_name,
  CASE WHEN (seller_snapshot ->> 'cpf') IS NULL THEN NULL
       ELSE '***.***.***-' || right(regexp_replace(seller_snapshot ->> 'cpf','\D','','g'),2) END AS seller_cpf_masked,
  (buyer_snapshot ->> 'full_name') AS buyer_name,
  CASE WHEN (buyer_snapshot ->> 'cpf') IS NULL THEN NULL
       ELSE '***.***.***-' || right(regexp_replace(buyer_snapshot ->> 'cpf','\D','','g'),2) END AS buyer_cpf_masked,
  (negotiation ->> 'amount') AS amount,
  (negotiation ->> 'payment_method') AS payment_method,
  (negotiation ->> 'date') AS negotiation_date,
  (negotiation ->> 'location') AS negotiation_location
FROM public.smart_receipts r
WHERE status IN ('issued','signed','superseded','revoked');

GRANT SELECT ON public.public_receipt_validation TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_receipt(_code text)
RETURNS SETOF public.public_receipt_validation
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.public_receipt_validation WHERE code = _code LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_receipt(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.smart_receipts_supersede_previous()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.previous_receipt_id IS NOT NULL AND NEW.status = 'issued' THEN
    UPDATE public.smart_receipts
       SET status = 'superseded', updated_at = now()
     WHERE id = NEW.previous_receipt_id
       AND status IN ('issued','signed');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_smart_receipts_supersede ON public.smart_receipts;
CREATE TRIGGER trg_smart_receipts_supersede
AFTER INSERT ON public.smart_receipts
FOR EACH ROW EXECUTE FUNCTION public.smart_receipts_supersede_previous();

CREATE OR REPLACE FUNCTION public.get_receipt_pdf_path(_code text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_path text; v_seller uuid; v_buyer uuid;
BEGIN
  SELECT pdf_path, seller_id, buyer_id INTO v_path, v_seller, v_buyer
  FROM public.smart_receipts WHERE code = _code LIMIT 1;
  IF v_path IS NULL THEN RETURN NULL; END IF;
  IF auth.uid() = v_seller OR auth.uid() = v_buyer OR public.has_role(auth.uid(),'admin') THEN
    RETURN v_path;
  END IF;
  RETURN NULL;
END; $$;
GRANT EXECUTE ON FUNCTION public.get_receipt_pdf_path(text) TO authenticated;
