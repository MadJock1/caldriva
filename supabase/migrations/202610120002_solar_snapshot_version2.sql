-- Solar snapshot versioning: the snapshot schema moved from version 1 to version 2, adding a panel
-- model record (dimensions, watts, verification status and layout count) alongside the existing
-- layout. This replaces the persistence guard so legacy (v1) and new (v2) snapshots are both
-- accepted, and stores the panel record in simulation_inputs so cloud scenarios can be reconstructed.
-- Table and RLS shape are unchanged.
begin;
create or replace function public.save_solar_simulation(p_building_id uuid, p_building_version integer, p_snapshot jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_version integer; v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select b.version into v_version from public.buildings b where b.id = p_building_id for share;
  if not found then raise exception 'Building unavailable' using errcode = '42501'; end if;
  if v_version is distinct from p_building_version then raise exception 'Version conflict' using errcode = '40001'; end if;
  if coalesce(p_snapshot->>'schemaVersion', '') not in ('1', '2') then raise exception 'Invalid snapshot' using errcode = '22023'; end if;
  insert into public.simulations(building_id, building_version, name, calculation_version, building_snapshot, assumptions)
  values (p_building_id, v_version, p_snapshot->>'name', p_snapshot->'result'->>'engineVersion', p_snapshot->'building', p_snapshot->'assumptions') returning id into v_id;
  insert into public.simulation_inputs values (v_id, jsonb_build_object('solar', p_snapshot->'building'->'solar', 'finance', p_snapshot->'building'->'finance', 'layout', p_snapshot->'layout', 'panel', p_snapshot->'panel'));
  insert into public.simulation_results values (v_id, p_snapshot->'result');
  return v_id;
end;
$$;
revoke all on function public.save_solar_simulation(uuid, integer, jsonb) from public, anon;
grant execute on function public.save_solar_simulation(uuid, integer, jsonb) to authenticated;
commit;
