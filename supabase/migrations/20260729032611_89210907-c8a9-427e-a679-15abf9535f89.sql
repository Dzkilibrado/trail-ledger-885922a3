
CREATE POLICY "motorcycle_photos_public_via_certificate"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'motorcycle-photos'
  AND EXISTS (
    SELECT 1
    FROM public.certificates c
    JOIN public.motorcycles m ON m.id = c.motorcycle_id
    WHERE m.main_photo_url = storage.objects.name
      AND c.status = 'active'
      AND (c.expires_at IS NULL OR c.expires_at > now())
      AND c.allowed_sections ? 'photo'
  )
);
