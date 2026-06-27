
-- Public read for motorcycle photos (signed URLs not required for public certificate)
CREATE POLICY "motorcycle_photos_public_read"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'motorcycle-photos');

-- Public read for event-media so evidence thumbnails appear on the public certificate page.
-- Paths are uuids; only owners can upload.
CREATE POLICY "event_media_public_read"
  ON storage.objects FOR SELECT TO anon
  USING (bucket_id = 'event-media');

-- SECURITY DEFINER aggregator: returns motorcycle + history when token is valid
CREATE OR REPLACE FUNCTION public.get_public_certificate(_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cert  public.certificates%ROWTYPE;
  v_moto  public.motorcycles%ROWTYPE;
  v_result JSONB;
BEGIN
  SELECT * INTO v_cert FROM public.certificates WHERE public_token = _token;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_cert.expires_at IS NOT NULL AND v_cert.expires_at < now() THEN RETURN NULL; END IF;

  SELECT * INTO v_moto FROM public.motorcycles WHERE id = v_cert.motorcycle_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_result := jsonb_build_object(
    'certificate', to_jsonb(v_cert),
    'motorcycle', to_jsonb(v_moto),
    'owner', (SELECT jsonb_build_object('full_name', full_name, 'avatar_url', avatar_url)
              FROM public.profiles WHERE id = v_moto.owner_id),
    'events', COALESCE((
      SELECT jsonb_agg(to_jsonb(e) ORDER BY e.occurred_at DESC)
      FROM public.events e WHERE e.motorcycle_id = v_moto.id
    ), '[]'::jsonb),
    'schedules', COALESCE((
      SELECT jsonb_agg(to_jsonb(s))
      FROM public.maintenance_schedules s WHERE s.motorcycle_id = v_moto.id AND s.active
    ), '[]'::jsonb),
    'attachments', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'event_id', a.event_id, 'bucket', a.bucket,
        'path', a.path, 'kind', a.kind, 'caption', a.caption
      ))
      FROM public.event_attachments a
      JOIN public.events e ON e.id = a.event_id
      WHERE e.motorcycle_id = v_moto.id
    ), '[]'::jsonb),
    'workshops', COALESCE((
      SELECT jsonb_agg(DISTINCT jsonb_build_object('id', w.id, 'name', w.name, 'city', w.city, 'verified', w.verified))
      FROM public.workshops w
      JOIN public.events e ON e.workshop_id = w.id
      WHERE e.motorcycle_id = v_moto.id
    ), '[]'::jsonb)
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_certificate(TEXT) TO anon, authenticated;
