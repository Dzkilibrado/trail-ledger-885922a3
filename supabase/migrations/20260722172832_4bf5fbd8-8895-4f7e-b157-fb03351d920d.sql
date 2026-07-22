-- Restrict PII columns (cnpj, phone) on workshops via column-level privileges.
-- Row-level SELECT policy remains permissive (public directory), but authenticated
-- users can no longer read phone/cnpj through the Data API. Owners keep access
-- to their own private fields through the existing my_workshop_private() RPC;
-- admins access via service_role.

REVOKE SELECT ON public.workshops FROM authenticated;
REVOKE SELECT ON public.workshops FROM anon;

GRANT SELECT (
  id, name, city, state, owner_user_id,
  verified, verified_at, verified_label,
  created_at, updated_at
) ON public.workshops TO authenticated;

-- Writes still allowed at the row level; RLS policies enforce ownership.
GRANT INSERT, UPDATE, DELETE ON public.workshops TO authenticated;
GRANT ALL ON public.workshops TO service_role;