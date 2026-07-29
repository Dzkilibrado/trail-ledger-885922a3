create or replace function public.is_public_certificate_motorcycle_photo(_object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, storage
as $$
  select exists (
    select 1
    from public.certificates c
    join public.motorcycles m on m.id = c.motorcycle_id
    where m.main_photo_url = _object_name
      and c.status = 'active'
      and (c.expires_at is null or c.expires_at > now())
      and c.allowed_sections ? 'photo'
  );
$$;

revoke all on function public.is_public_certificate_motorcycle_photo(text) from public;
grant execute on function public.is_public_certificate_motorcycle_photo(text) to anon, authenticated, service_role;

drop policy if exists motorcycle_photos_public_via_certificate on storage.objects;

create policy motorcycle_photos_public_via_certificate
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'motorcycle-photos'
  and public.is_public_certificate_motorcycle_photo(name)
);