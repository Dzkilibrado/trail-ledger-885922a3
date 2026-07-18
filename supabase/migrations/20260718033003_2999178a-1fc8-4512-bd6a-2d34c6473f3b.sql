DROP POLICY IF EXISTS smart_receipts_upload_signed ON storage.objects;

CREATE POLICY smart_receipts_upload_signed ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'smart-receipts'
  AND name ~~ 'motorcycles/%/signed/%'
  AND EXISTS (
    SELECT 1 FROM public.smart_receipts r
    WHERE r.motorcycle_id::text = split_part(objects.name, '/', 2)
      AND (r.seller_id = auth.uid() OR r.buyer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
  )
);