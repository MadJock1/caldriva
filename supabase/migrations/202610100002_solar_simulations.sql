begin;
create table public.calculation_versions (
  id text primary key, discipline text not null, methodology text not null
);
insert into public.calculation_versions values ('solar-0.1.0', 'solar', 'PVGIS 5.3 crystalline silicon; annual self-use scenario; simple payback; preliminary horizontal layout v1.');
alter table public.calculation_versions enable row level security;
create policy versions_read on public.calculation_versions for select to authenticated using (true);
revoke all on public.calculation_versions from anon, authenticated;
grant select on public.calculation_versions to authenticated;

create table public.simulations (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  building_version integer not null check (building_version > 0),
  name text not null check (char_length(name) between 1 and 100),
  calculation_version text not null references public.calculation_versions(id),
  building_snapshot jsonb not null check (jsonb_typeof(building_snapshot) = 'object' and octet_length(building_snapshot::text) <= 65536),
  assumptions jsonb not null check (jsonb_typeof(assumptions) = 'array' and octet_length(assumptions::text) <= 20000),
  review_status text not null default 'preliminary' check (review_status = 'preliminary'),
  created_at timestamptz not null default now()
);
create index simulations_building_created_idx on public.simulations(building_id, created_at desc);
create index simulations_calculation_idx on public.simulations(calculation_version);
create table public.simulation_inputs (
  simulation_id uuid primary key references public.simulations(id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 65536)
);
create table public.simulation_results (
  simulation_id uuid primary key references public.simulations(id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 65536)
);
alter table public.simulations enable row level security;
alter table public.simulation_inputs enable row level security;
alter table public.simulation_results enable row level security;
create policy simulations_read on public.simulations for select to authenticated using (exists (select 1 from public.buildings b where b.id = building_id and b.owner_id = (select auth.uid())));
create policy simulations_insert on public.simulations for insert to authenticated with check (exists (select 1 from public.buildings b where b.id = building_id and b.owner_id = (select auth.uid())));
create policy simulations_delete on public.simulations for delete to authenticated using (exists (select 1 from public.buildings b where b.id = building_id and b.owner_id = (select auth.uid())));
create policy inputs_read on public.simulation_inputs for select to authenticated using (exists (select 1 from public.simulations s where s.id = simulation_id));
create policy inputs_insert on public.simulation_inputs for insert to authenticated with check (exists (select 1 from public.simulations s where s.id = simulation_id));
create policy results_read on public.simulation_results for select to authenticated using (exists (select 1 from public.simulations s where s.id = simulation_id));
create policy results_insert on public.simulation_results for insert to authenticated with check (exists (select 1 from public.simulations s where s.id = simulation_id));
revoke all on public.simulations, public.simulation_inputs, public.simulation_results from anon, authenticated;
grant select, insert, delete on public.simulations to authenticated;
grant select, insert on public.simulation_inputs, public.simulation_results to authenticated;

create function public.save_solar_simulation(p_building_id uuid, p_building_version integer, p_snapshot jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_version integer; v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select b.version into v_version from public.buildings b where b.id = p_building_id for share;
  if not found then raise exception 'Building unavailable' using errcode = '42501'; end if;
  if v_version is distinct from p_building_version then raise exception 'Version conflict' using errcode = '40001'; end if;
  if p_snapshot->>'schemaVersion' is distinct from '1' then raise exception 'Invalid snapshot' using errcode = '22023'; end if;
  insert into public.simulations(building_id, building_version, name, calculation_version, building_snapshot, assumptions)
  values (p_building_id, v_version, p_snapshot->>'name', p_snapshot->'result'->>'engineVersion', p_snapshot->'building', p_snapshot->'assumptions') returning id into v_id;
  insert into public.simulation_inputs values (v_id, jsonb_build_object('solar', p_snapshot->'building'->'solar', 'finance', p_snapshot->'building'->'finance', 'layout', p_snapshot->'layout'));
  insert into public.simulation_results values (v_id, p_snapshot->'result');
  return v_id;
end;
$$;
revoke all on function public.save_solar_simulation(uuid, integer, jsonb) from public, anon;
grant execute on function public.save_solar_simulation(uuid, integer, jsonb) to authenticated;
commit;
