-- Electrical draft versioning: the root draft schema moved from version 1 to version 2 with an
-- optional distribution domain. This replaces the persistence guard so legacy (v1) drafts and new
-- (v2) drafts are both accepted; unknown/future versions remain rejected. Table and RLS shape are
-- unchanged because the draft stays a validated JSONB object.
begin;
create or replace function public.save_electrical_design(p_id uuid, p_expected_version integer, p_draft jsonb)
returns table(id uuid, version integer)
language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; v_version integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if jsonb_typeof(p_draft) is distinct from 'object'
    or coalesce(p_draft->>'version', '') not in ('1', '2')
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
