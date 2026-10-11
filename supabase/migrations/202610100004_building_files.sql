-- Private, owner-scoped building files. Metadata lives here; the bytes live in
-- the private Supabase Storage bucket "building-files" (see supabase/storage/
-- building_files.sql). Registration goes through a security-definer function so
-- the storage path prefix and building ownership are fixed in one place.
begin;

create table public.building_files (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) between 1 and 512),
  file_name text not null check (char_length(file_name) between 1 and 255),
  mime_type text not null check (mime_type in (
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/vnd.dwg',
    'image/vnd.dxf',
    'application/dxf',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 10485760),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);
create index building_files_building_idx on public.building_files(building_id, created_at desc);
create index building_files_owner_idx on public.building_files(owner_id, created_at desc);

alter table public.building_files enable row level security;
-- Reads and deletes are owner-scoped; inserts only come through the definer RPC.
create policy building_files_select on public.building_files for select to authenticated
  using (owner_id = (select auth.uid()));
create policy building_files_delete on public.building_files for delete to authenticated
  using (owner_id = (select auth.uid()));
revoke all on public.building_files from anon;
grant select, delete on public.building_files to authenticated;

-- Validates ownership and content rules, then fixes the storage path prefix to
-- "<owner>/<building>/<file>". Returns the generated path for the upload step.
create function public.register_building_file(
  p_building_id uuid, p_file_id uuid, p_file_name text, p_mime_type text,
  p_byte_size bigint, p_sha256 text)
returns table(out_id uuid, out_storage_path text)
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_path text;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_building_id is null or p_file_id is null then
    raise exception 'Invalid file reference' using errcode = '22023';
  end if;
  if not exists (select 1 from public.buildings b where b.id = p_building_id and b.owner_id = v_user) then
    raise exception 'Building unavailable' using errcode = '42501';
  end if;
  if nullif(btrim(p_file_name), '') is null or char_length(p_file_name) > 255 then
    raise exception 'Invalid file name' using errcode = '22023';
  end if;
  if p_mime_type not in (
    'application/pdf', 'image/png', 'image/jpeg', 'image/webp',
    'image/vnd.dwg', 'image/vnd.dxf', 'application/dxf', 'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') then
    raise exception 'Unsupported file type' using errcode = '22023';
  end if;
  if p_byte_size is null or p_byte_size <= 0 or p_byte_size > 10485760 then
    raise exception 'File too large' using errcode = '22023';
  end if;
  if p_sha256 is null or p_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid checksum' using errcode = '22023';
  end if;
  v_path := v_user::text || '/' || p_building_id::text || '/' || p_file_id::text;
  insert into public.building_files(id, building_id, owner_id, storage_path, file_name, mime_type, byte_size, sha256)
  values (p_file_id, p_building_id, v_user, v_path, p_file_name, p_mime_type, p_byte_size, p_sha256);
  return query select p_file_id, v_path;
end;
$$;
revoke all on function public.register_building_file(uuid, uuid, text, text, bigint, text) from public, anon;
grant execute on function public.register_building_file(uuid, uuid, text, text, bigint, text) to authenticated;
commit;
