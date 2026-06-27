
-- Certificate status (active/private/expired/revoked) + safer default sections
ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','private','expired','revoked'));

-- Update default allowed sections (sensitive ones off by default)
ALTER TABLE public.certificates
  ALTER COLUMN allowed_sections SET DEFAULT
    '["basic","photo","usage","conservation","health","upcoming","history","workshop","photos"]'::jsonb;

-- Replace public RPC: respect status + expiry
CREATE OR REPLACE FUNCTION public.get_public_certificate(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cert  public.certificates%ROWTYPE;
  v_moto  public.motorcycles%ROWTYPE;
  v_result JSONB;
BEGIN
  SELECT * INTO v_cert FROM public.certificates WHERE public_token = _token;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_cert.status <> 'active' THEN RETURN NULL; END IF;
  IF v_cert.expires_at IS NOT NULL AND v_cert.expires_at < now() THEN RETURN NULL; END IF;

  SELECT * INTO v_moto FROM public.motorcycles WHERE id = v_cert.motorcycle_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  v_result := jsonb_build_object(
    'certificate', jsonb_build_object(
      'public_token', v_cert.public_token,
      'created_at', v_cert.created_at,
      'expires_at', v_cert.expires_at,
      'status', v_cert.status,
      'allowed_sections', v_cert.allowed_sections
    ),
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
        'storage_path', a.storage_path, 'kind', a.kind, 'caption', a.caption
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
$function$;
