CREATE OR REPLACE FUNCTION public.admin_user_details(_user uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r JSONB;
BEGIN
  IF NOT public.is_user_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;

  SELECT jsonb_build_object(
    'profile', (SELECT to_jsonb(p) FROM public.profiles p WHERE p.id = _user),
    'is_admin', public.is_user_admin(_user),
    'motorcycles', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', m.id,
        'trailbook_id', m.trailbook_id,
        'nickname', m.nickname,
        'brand', m.brand,
        'model', m.model,
        'year_make', m.year_make,
        'year_model', m.year_model,
        'displacement', m.displacement,
        'control_type', m.control_type,
        'plate', m.plate,
        'main_photo_url', m.main_photo_url,
        'km_total', m.km_total,
        'hours_total', m.hours_total,
        'created_at', m.created_at
      ) ORDER BY m.created_at DESC)
      FROM public.motorcycles m
      WHERE m.owner_id = _user
    ), '[]'::jsonb),
    'documents', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', d.id,
        'motorcycle_id', d.motorcycle_id,
        'motorcycle_label', btrim(concat_ws(' ', m.brand, m.model)),
        'doc_type', d.doc_type,
        'file_name', d.file_name,
        'doc_date', d.doc_date,
        'issuer', d.issuer,
        'is_current', d.is_current,
        'created_at', d.created_at,
        'deleted_at', d.deleted_at
      ) ORDER BY d.created_at DESC)
      FROM public.motorcycle_documents d
      JOIN public.motorcycles m ON m.id = d.motorcycle_id
      WHERE m.owner_id = _user
    ), '[]'::jsonb),
    'certificates', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id,
        'motorcycle_id', c.motorcycle_id,
        'motorcycle_label', btrim(concat_ws(' ', m.brand, m.model)),
        'public_token', c.public_token,
        'status', c.status,
        'audience', c.audience,
        'created_at', c.created_at,
        'expires_at', c.expires_at
      ) ORDER BY c.created_at DESC)
      FROM public.certificates c
      JOIN public.motorcycles m ON m.id = c.motorcycle_id
      WHERE m.owner_id = _user
    ), '[]'::jsonb),
    'tickets', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', t.id,
        'code', t.code,
        'title', t.title,
        'subject', COALESCE(t.title, t.description),
        'status', t.status,
        'priority', t.priority,
        'module', t.module,
        'type', t.type,
        'motorcycle_id', t.motorcycle_id,
        'created_at', t.created_at,
        'last_activity_at', t.last_activity_at
      ) ORDER BY t.created_at DESC)
      FROM public.tickets t
      WHERE t.user_id = _user
    ), '[]'::jsonb)
  ) INTO r;

  RETURN r;
END
$function$;