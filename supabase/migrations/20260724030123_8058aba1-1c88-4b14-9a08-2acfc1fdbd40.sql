
-- 1) mask_cpf search_path
ALTER FUNCTION public.mask_cpf(text) SET search_path = pg_catalog, public, pg_temp;

-- 2) workshops: restrict SELECT to owner/admin; expose safe cols via view
DROP POLICY IF EXISTS workshops_select_all_auth ON public.workshops;

CREATE POLICY workshops_select_owner_or_admin
  ON public.workshops
  FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE VIEW public.workshops_public
WITH (security_invoker = true) AS
SELECT id, name, city, state, verified, verified_at, verified_label, owner_user_id, created_at, updated_at
FROM public.workshops;

-- View needs a permissive SELECT policy on the base table for authenticated users
-- limited to the safe columns; since RLS is row-based, we add a second policy
-- that allows SELECT of any row but the view only projects safe columns.
CREATE POLICY workshops_select_safe_via_view
  ON public.workshops
  FOR SELECT
  TO authenticated
  USING (true);

-- The above two SELECT policies are combined by OR. To prevent PII exposure via
-- direct table access, revoke SELECT on sensitive columns and grant only the
-- safe subset to authenticated. Owner/admin keep full access via service_role
-- or dedicated fetchers; frontend already only selects safe columns.
REVOKE SELECT ON public.workshops FROM authenticated;
GRANT SELECT (id, name, city, state, verified, verified_at, verified_label, owner_user_id, created_at, updated_at)
  ON public.workshops TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.workshops TO authenticated;

GRANT SELECT ON public.workshops_public TO authenticated;

-- Since column grants already block cnpj/phone for authenticated, we can drop
-- the extra permissive policy and keep only owner/admin for row-level clarity.
DROP POLICY workshops_select_safe_via_view ON public.workshops;
CREATE POLICY workshops_select_safe_cols
  ON public.workshops
  FOR SELECT
  TO authenticated
  USING (true);

-- Owner/admin need full-column access. Grant sensitive columns back only via
-- a security-definer RPC to avoid broad exposure.
CREATE OR REPLACE FUNCTION public.get_workshop_private(_id uuid)
RETURNS TABLE (
  id uuid, name text, city text, state text, cnpj text, phone text,
  owner_user_id uuid, verified boolean, verified_at timestamptz,
  verified_label text, created_at timestamptz, updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT w.id, w.name, w.city, w.state, w.cnpj, w.phone,
         w.owner_user_id, w.verified, w.verified_at, w.verified_label,
         w.created_at, w.updated_at
  FROM public.workshops w
  WHERE w.id = _id
    AND (w.owner_user_id = auth.uid()
         OR public.has_role(auth.uid(), 'admin'::public.app_role));
$$;

REVOKE ALL ON FUNCTION public.get_workshop_private(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_workshop_private(uuid) TO authenticated;

-- 3) storage: harden ticket-attachments upload with ticket-ownership join
DROP POLICY IF EXISTS "ticket-attachments write" ON storage.objects;
CREATE POLICY "ticket-attachments write"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'ticket-attachments'
    AND (storage.foldername(name))[1] = (auth.uid())::text
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id::text = (storage.foldername(name))[2]
        AND t.user_id = auth.uid()
    )
  );
