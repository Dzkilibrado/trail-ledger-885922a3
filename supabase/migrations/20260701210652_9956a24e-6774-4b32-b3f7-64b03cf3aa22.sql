
CREATE OR REPLACE FUNCTION public.get_public_certificate(_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cert public.certificates%ROWTYPE;
  v_moto public.motorcycles%ROWTYPE;
  v_result JSONB;
  v_has_invoice BOOLEAN;
BEGIN
  SELECT * INTO v_cert FROM public.certificates WHERE public_token = _token;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_cert.status <> 'active' THEN RETURN NULL; END IF;
  IF v_cert.expires_at IS NOT NULL AND v_cert.expires_at < now() THEN RETURN NULL; END IF;
  SELECT * INTO v_moto FROM public.motorcycles WHERE id = v_cert.motorcycle_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.motorcycle_documents
    WHERE motorcycle_id = v_moto.id
      AND doc_type = 'invoice'
      AND is_current
      AND deleted_at IS NULL
  ) INTO v_has_invoice;

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
    'events', COALESCE((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.occurred_at DESC)
              FROM public.events e WHERE e.motorcycle_id = v_moto.id), '[]'::jsonb),
    'schedules', COALESCE((SELECT jsonb_agg(to_jsonb(s))
              FROM public.maintenance_schedules s WHERE s.motorcycle_id = v_moto.id AND s.active), '[]'::jsonb),
    'attachments', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'id', a.id, 'event_id', a.event_id, 'bucket', a.bucket,
                'storage_path', a.storage_path, 'kind', a.kind, 'caption', a.caption))
              FROM public.event_attachments a JOIN public.events e ON e.id = a.event_id
              WHERE e.motorcycle_id = v_moto.id), '[]'::jsonb),
    'workshops', COALESCE((SELECT jsonb_agg(DISTINCT jsonb_build_object(
                'id', w.id, 'name', w.name, 'city', w.city,
                'verified', w.verified, 'verified_label', w.verified_label))
              FROM public.workshops w JOIN public.events e ON e.workshop_id = w.id
              WHERE e.motorcycle_id = v_moto.id), '[]'::jsonb),
    'ownership', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                'id', h.id, 'started_at', h.started_at, 'ended_at', h.ended_at,
                'method', h.method,
                'owner_name', (SELECT full_name FROM public.profiles WHERE id = h.owner_id)
              ) ORDER BY h.started_at)
              FROM public.ownership_history h WHERE h.motorcycle_id = v_moto.id), '[]'::jsonb),
    'documents_presence', jsonb_build_object(
      'invoice', v_has_invoice
    )
  );

  RETURN v_result;
END;
$function$;
