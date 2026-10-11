-- Supabase Storage provisioning for building files.
--
-- Apply with the Supabase CLI (`supabase db execute --file ...`) or paste into the
-- SQL editor after migrations 0001-0004. Kept out of supabase/migrations because
-- PGlite unit tests do not emulate the storage schema, and the storage schema is
-- created by Supabase, not by this project. The bucket is private: bytes are only
-- reachable through short-lived signed URLs issued to the owner.
--
-- Path convention: "<owner_id>/<building_id>/<file_id>" (see register_building_file).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'building-files', 'building-files', false, 10485760,
  array[
    'application/pdf', 'image/png', 'image/jpeg', 'image/webp',
    'image/vnd.dwg', 'image/vnd.dxf', 'application/dxf', 'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Only the first path segment (the owner id) is enforced here; per-building and
-- per-file authorization is enforced by public.building_files RLS + the definer RPC.
drop policy if exists building_files_objects_select on storage.objects;
create policy building_files_objects_select on storage.objects for select to authenticated
  using (bucket_id = 'building-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists building_files_objects_insert on storage.objects;
create policy building_files_objects_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'building-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists building_files_objects_update on storage.objects;
create policy building_files_objects_update on storage.objects for update to authenticated
  using (bucket_id = 'building-files' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists building_files_objects_delete on storage.objects;
create policy building_files_objects_delete on storage.objects for delete to authenticated
  using (bucket_id = 'building-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
