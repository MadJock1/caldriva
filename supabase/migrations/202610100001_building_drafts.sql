-- Initial customer persistence boundary. No admin or engineer permissions implied.
begin;
create table public.buildings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 150),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index buildings_owner_updated_idx on public.buildings(owner_id, updated_at desc);
create table public.building_drafts (
  building_id uuid primary key references public.buildings(id) on delete cascade,
  draft jsonb not null check (jsonb_typeof(draft) = 'object' and octet_length(draft::text) <= 65536)
);
alter table public.buildings enable row level security;
alter table public.building_drafts enable row level security;
create policy buildings_select on public.buildings for select to authenticated using (owner_id = (select auth.uid()));
create policy buildings_insert on public.buildings for insert to authenticated with check (owner_id = (select auth.uid()));
create policy buildings_update on public.buildings for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy buildings_delete on public.buildings for delete to authenticated using (owner_id = (select auth.uid()));
create policy drafts_select on public.building_drafts for select to authenticated using (exists (select 1 from public.buildings b where b.id = building_id and b.owner_id = (select auth.uid())));
create policy drafts_insert on public.building_drafts for insert to authenticated with check (exists (select 1 from public.buildings b where b.id = building_id and b.owner_id = (select auth.uid())));
create policy drafts_update on public.building_drafts for update to authenticated using (exists (select 1 from public.buildings b where b.id = building_id and b.owner_id = (select auth.uid()))) with check (exists (select 1 from public.buildings b where b.id = building_id and b.owner_id = (select auth.uid())));
create policy drafts_delete on public.building_drafts for delete to authenticated using (exists (select 1 from public.buildings b where b.id = building_id and b.owner_id = (select auth.uid())));
revoke all on public.buildings, public.building_drafts from anon;
grant select, insert, update, delete on public.buildings, public.building_drafts to authenticated;

-- Atomic parent/draft write with optimistic concurrency, using the caller's RLS.
create function public.save_building(p_id uuid, p_expected_version integer, p_draft jsonb)
returns table(id uuid, version integer)
language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; v_version integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if jsonb_typeof(p_draft) is distinct from 'object' or p_draft->>'version' is distinct from '1'
    or nullif(btrim(p_draft->>'name'), '') is null or char_length(p_draft->>'name') > 150
    or octet_length(p_draft::text) > 65536 then
    raise exception 'Invalid draft' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.buildings(name) values (p_draft->>'name') returning buildings.id, buildings.version into v_id, v_version;
  else
    select b.id, b.version into v_id, v_version from public.buildings b where b.id = p_id for update;
    if not found then raise exception 'Building unavailable' using errcode = '42501'; end if;
    if p_expected_version is distinct from v_version then raise exception 'Version conflict' using errcode = '40001'; end if;
    update public.buildings b set name = p_draft->>'name', version = b.version + 1, updated_at = now()
      where b.id = v_id returning b.version into v_version;
  end if;
  insert into public.building_drafts(building_id, draft) values (v_id, p_draft)
    on conflict (building_id) do update set draft = excluded.draft;
  return query select v_id, v_version;
end;
$$;
revoke all on function public.save_building(uuid, integer, jsonb) from public, anon;
grant execute on function public.save_building(uuid, integer, jsonb) to authenticated;
commit;
