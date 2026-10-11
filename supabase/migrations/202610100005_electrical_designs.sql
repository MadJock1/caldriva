-- Electrical design persistence boundary. Owner-only, no admin or engineer permissions implied.
begin;
create table public.electrical_designs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 150),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index electrical_designs_owner_updated_idx on public.electrical_designs(owner_id, updated_at desc);
create table public.electrical_drafts (
  design_id uuid primary key references public.electrical_designs(id) on delete cascade,
  draft jsonb not null check (jsonb_typeof(draft) = 'object' and octet_length(draft::text) <= 262144)
);
alter table public.electrical_designs enable row level security;
alter table public.electrical_drafts enable row level security;
create policy electrical_designs_select on public.electrical_designs for select to authenticated using (owner_id = (select auth.uid()));
create policy electrical_designs_insert on public.electrical_designs for insert to authenticated with check (owner_id = (select auth.uid()));
create policy electrical_designs_update on public.electrical_designs for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy electrical_designs_delete on public.electrical_designs for delete to authenticated using (owner_id = (select auth.uid()));
create policy electrical_drafts_select on public.electrical_drafts for select to authenticated using (exists (select 1 from public.electrical_designs d where d.id = design_id and d.owner_id = (select auth.uid())));
create policy electrical_drafts_insert on public.electrical_drafts for insert to authenticated with check (exists (select 1 from public.electrical_designs d where d.id = design_id and d.owner_id = (select auth.uid())));
create policy electrical_drafts_update on public.electrical_drafts for update to authenticated using (exists (select 1 from public.electrical_designs d where d.id = design_id and d.owner_id = (select auth.uid()))) with check (exists (select 1 from public.electrical_designs d where d.id = design_id and d.owner_id = (select auth.uid())));
create policy electrical_drafts_delete on public.electrical_drafts for delete to authenticated using (exists (select 1 from public.electrical_designs d where d.id = design_id and d.owner_id = (select auth.uid())));
revoke all on public.electrical_designs, public.electrical_drafts from anon;
grant select, insert, update, delete on public.electrical_designs, public.electrical_drafts to authenticated;

-- Atomic parent/draft write with optimistic concurrency, using the caller's RLS.
create function public.save_electrical_design(p_id uuid, p_expected_version integer, p_draft jsonb)
returns table(id uuid, version integer)
language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; v_version integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if jsonb_typeof(p_draft) is distinct from 'object' or p_draft->>'version' is distinct from '1'
    or nullif(btrim(p_draft->>'name'), '') is null or char_length(p_draft->>'name') > 150
    or octet_length(p_draft::text) > 262144 then
    raise exception 'Invalid draft' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.electrical_designs(name) values (p_draft->>'name') returning electrical_designs.id, electrical_designs.version into v_id, v_version;
  else
    select d.id, d.version into v_id, v_version from public.electrical_designs d where d.id = p_id for update;
    if not found then raise exception 'Design unavailable' using errcode = '42501'; end if;
    if p_expected_version is distinct from v_version then raise exception 'Version conflict' using errcode = '40001'; end if;
    update public.electrical_designs d set name = p_draft->>'name', version = d.version + 1, updated_at = now()
      where d.id = v_id returning d.version into v_version;
  end if;
  insert into public.electrical_drafts(design_id, draft) values (v_id, p_draft)
    on conflict (design_id) do update set draft = excluded.draft;
  return query select v_id, v_version;
end;
$$;
revoke all on function public.save_electrical_design(uuid, integer, jsonb) from public, anon;
grant execute on function public.save_electrical_design(uuid, integer, jsonb) to authenticated;
commit;
