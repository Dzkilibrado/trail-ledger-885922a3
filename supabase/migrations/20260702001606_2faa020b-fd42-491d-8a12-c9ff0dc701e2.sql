
-- Admin role management: promote/demote with self-demotion protection
CREATE OR REPLACE FUNCTION public.admin_set_user_role(_user uuid, _is_admin boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _user = auth.uid() AND NOT _is_admin THEN
    RAISE EXCEPTION 'Você não pode remover o próprio acesso de administrador';
  END IF;
  IF _is_admin THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (_user, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = _user AND role = 'admin';
  END IF;
END $$;

-- Audit user_roles changes
DROP TRIGGER IF EXISTS trg_user_roles_admin_audit ON public.user_roles;
CREATE TRIGGER trg_user_roles_admin_audit
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.write_admin_audit();

-- Detailed user view for admin
CREATE OR REPLACE FUNCTION public.admin_user_details(_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE r JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT jsonb_build_object(
    'profile', (SELECT to_jsonb(p) FROM public.profiles p WHERE p.id = _user),
    'is_admin', public.has_role(_user,'admin'),
    'motorcycles', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', m.id, 'trailbook_id', m.trailbook_id, 'brand', m.brand,
        'model', m.model, 'year', m.year, 'created_at', m.created_at
      ) ORDER BY m.created_at DESC) FROM public.motorcycles m WHERE m.owner_id = _user), '[]'::jsonb),
    'documents', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', d.id, 'motorcycle_id', d.motorcycle_id, 'doc_type', d.doc_type,
        'file_name', d.file_name, 'created_at', d.created_at, 'deleted_at', d.deleted_at
      ) ORDER BY d.created_at DESC)
      FROM public.motorcycle_documents d
      JOIN public.motorcycles m ON m.id = d.motorcycle_id
      WHERE m.owner_id = _user), '[]'::jsonb),
    'certificates', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'motorcycle_id', c.motorcycle_id, 'public_token', c.public_token,
        'status', c.status, 'created_at', c.created_at, 'expires_at', c.expires_at
      ) ORDER BY c.created_at DESC)
      FROM public.certificates c
      JOIN public.motorcycles m ON m.id = c.motorcycle_id
      WHERE m.owner_id = _user), '[]'::jsonb),
    'tickets', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', t.id, 'code', t.code, 'subject', t.subject, 'status', t.status,
        'priority', t.priority, 'created_at', t.created_at
      ) ORDER BY t.created_at DESC)
      FROM public.tickets t WHERE t.user_id = _user), '[]'::jsonb)
  ) INTO r;
  RETURN r;
END $$;
