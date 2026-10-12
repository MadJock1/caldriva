-- Phase 8: qualified reviewer workflow and immutable audit trail.
-- Reviewer decisions are an authenticated person's stated decision recorded
-- against a frozen revision. The software attests an administrator's qualification
-- entry but does not independently verify a credential, and a decision is still not
-- certification, a CE declaration or approval for construction.
--
-- Every table is deny-by-default with SELECT-only client grants. All writes go
-- through security-definer functions so state transitions, ownership, role and
-- qualification rules live in one place. Revisions, decisions and audit rows are
-- append-only: no UPDATE/DELETE grants exist, so clients cannot rewrite history.
begin;

-- Administrator-attested reviewer qualification registry.
create table public.compliance_reviewers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  qualification text not null check (char_length(qualification) between 1 and 200),
  qualification_ref text check (qualification_ref is null or char_length(qualification_ref) <= 300),
  valid_until date,
  status text not null default 'active' check (status in ('active', 'suspended')),
  attested_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.compliance_reviewers enable row level security;
create policy compliance_reviewers_select on public.compliance_reviewers for select to authenticated
  using (user_id = (select auth.uid()) or public.current_user_role() = 'admin');
revoke all on public.compliance_reviewers from anon;
grant select on public.compliance_reviewers to authenticated;

-- Durable, immutable compliance revisions. The frozen snapshot is the client-side
-- ComplianceRevision; the fingerprint binds it to the project inputs that produced it.
create table public.compliance_revisions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  design_id uuid not null references public.electrical_designs(id) on delete cascade,
  revision_number integer not null check (revision_number > 0),
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{8,64}$'),
  registry_version text not null check (char_length(registry_version) <= 80),
  engine_version text not null check (char_length(engine_version) <= 40),
  category text check (category is null or char_length(category) <= 40),
  jurisdiction text check (jurisdiction is null or char_length(jurisdiction) <= 40),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object' and octet_length(snapshot::text) <= 131072),
  created_at timestamptz not null default now(),
  unique (design_id, revision_number)
);
create index compliance_revisions_owner_idx on public.compliance_revisions(owner_id, created_at desc);
alter table public.compliance_revisions enable row level security;

-- A qualified reviewer assigned to one revision. One reviewer may not be the owner.
create table public.compliance_review_assignments (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.compliance_revisions(id) on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  assigned_by uuid not null default auth.uid() references auth.users(id) on delete set null,
  status text not null default 'assigned' check (status in ('assigned', 'declined', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (revision_id, reviewer_id)
);
create index compliance_review_assignments_reviewer_idx on public.compliance_review_assignments(reviewer_id, status);
alter table public.compliance_review_assignments enable row level security;

-- The assigned reviewer's immutable decision. At most one decision per revision.
create table public.compliance_review_decisions (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references public.compliance_revisions(id) on delete cascade,
  assignment_id uuid references public.compliance_review_assignments(id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  decision text not null check (decision in ('APPROVED', 'APPROVED_WITH_COMMENTS', 'CHANGES_REQUIRED', 'REJECTED', 'RETURNED')),
  statement text check (statement is null or char_length(statement) <= 5000),
  decided_at timestamptz not null default now(),
  unique (revision_id)
);
alter table public.compliance_review_decisions enable row level security;

-- Append-only audit trail. Written only by the definer functions above.
create table public.compliance_audit_log (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  revision_id uuid references public.compliance_revisions(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (char_length(action) between 1 and 60),
  detail jsonb not null default '{}'::jsonb check (jsonb_typeof(detail) = 'object' and octet_length(detail::text) <= 8192),
  created_at timestamptz not null default now()
);
create index compliance_audit_log_owner_idx on public.compliance_audit_log(owner_id, created_at desc);
create index compliance_audit_log_revision_idx on public.compliance_audit_log(revision_id);
alter table public.compliance_audit_log enable row level security;

create policy compliance_revisions_select on public.compliance_revisions for select to authenticated
  using (owner_id = (select auth.uid())
    or exists (select 1 from public.compliance_review_assignments a where a.revision_id = public.compliance_revisions.id and a.reviewer_id = (select auth.uid()))
    or public.current_user_role() = 'admin');
create policy compliance_review_assignments_select on public.compliance_review_assignments for select to authenticated
  using (owner_id = (select auth.uid()) or reviewer_id = (select auth.uid()) or public.current_user_role() = 'admin');
create policy compliance_review_decisions_select on public.compliance_review_decisions for select to authenticated
  using (owner_id = (select auth.uid()) or reviewer_id = (select auth.uid()) or public.current_user_role() = 'admin');
create policy compliance_audit_log_select on public.compliance_audit_log for select to authenticated
  using (owner_id = (select auth.uid())
    or exists (select 1 from public.compliance_review_assignments a where a.revision_id = public.compliance_audit_log.revision_id and a.reviewer_id = (select auth.uid()))
    or public.current_user_role() = 'admin');

revoke all on public.compliance_revisions, public.compliance_review_assignments, public.compliance_review_decisions, public.compliance_audit_log from anon;
grant select on public.compliance_revisions, public.compliance_review_assignments, public.compliance_review_decisions, public.compliance_audit_log to authenticated;

create trigger compliance_reviewers_updated before update on public.compliance_reviewers for each row execute function public.touch_updated_at();
create trigger compliance_review_assignments_updated before update on public.compliance_review_assignments for each row execute function public.touch_updated_at();

-- Admins attest a reviewer's qualification (in-system record, not an external check).
create function public.set_reviewer_qualification(p_user_id uuid, p_qualification text, p_qualification_ref text default null, p_valid_until date default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_caller uuid := (select auth.uid());
begin
  if v_caller is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if public.current_user_role() is distinct from 'admin' then raise exception 'Administrator required' using errcode = '42501'; end if;
  if p_user_id is null or not exists (select 1 from auth.users u where u.id = p_user_id) then raise exception 'Reviewer account not found' using errcode = '22023'; end if;
  if nullif(btrim(p_qualification), '') is null or char_length(p_qualification) > 200 then raise exception 'Invalid qualification' using errcode = '22023'; end if;
  if p_qualification_ref is not null and char_length(p_qualification_ref) > 300 then raise exception 'Invalid qualification reference' using errcode = '22023'; end if;
  insert into public.compliance_reviewers(user_id, qualification, qualification_ref, valid_until, status, attested_by)
  values (p_user_id, btrim(p_qualification), nullif(btrim(p_qualification_ref), ''), p_valid_until, 'active', v_caller)
  on conflict (user_id) do update set qualification = excluded.qualification, qualification_ref = excluded.qualification_ref,
    valid_until = excluded.valid_until, status = 'active', attested_by = excluded.attested_by, updated_at = now();
  insert into public.compliance_audit_log(owner_id, revision_id, actor_id, action, detail)
  values (p_user_id, null, v_caller, 'reviewer_qualification_set', jsonb_build_object('qualification', btrim(p_qualification), 'validUntil', p_valid_until));
end;
$$;

create function public.suspend_reviewer_qualification(p_user_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_caller uuid := (select auth.uid());
begin
  if v_caller is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if public.current_user_role() is distinct from 'admin' then raise exception 'Administrator required' using errcode = '42501'; end if;
  update public.compliance_reviewers set status = 'suspended', updated_at = now() where user_id = p_user_id and status = 'active';
  if not found then raise exception 'Active reviewer unavailable' using errcode = '42501'; end if;
  insert into public.compliance_audit_log(owner_id, revision_id, actor_id, action, detail)
  values (p_user_id, null, v_caller, 'reviewer_qualification_suspended', '{}'::jsonb);
end;
$$;

-- Owners register a frozen revision against one of their own saved designs. The
-- server assigns the revision number and rewrites it into the stored snapshot.
create function public.register_compliance_revision(p_design_id uuid, p_snapshot jsonb)
returns table(id uuid, revision_number integer)
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_owner uuid; v_number integer; v_fp text; v_id uuid;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select d.owner_id into v_owner from public.electrical_designs d where d.id = p_design_id;
  if not found or v_owner is distinct from v_user then raise exception 'Design unavailable' using errcode = '42501'; end if;
  if jsonb_typeof(p_snapshot) is distinct from 'object'
     or p_snapshot->>'schemaVersion' is distinct from '1'
     or p_snapshot->>'revisionNumber' is null
     or nullif(p_snapshot->>'fingerprint', '') is null
     or (p_snapshot->>'fingerprint') !~ '^[0-9a-f]{8,64}$'
     or nullif(p_snapshot->>'registryVersion', '') is null or char_length(p_snapshot->>'registryVersion') > 80
     or nullif(p_snapshot->>'engineVersion', '') is null or char_length(p_snapshot->>'engineVersion') > 40
     or octet_length(p_snapshot::text) > 131072 then
    raise exception 'Invalid revision snapshot' using errcode = '22023';
  end if;
  select coalesce(max(r.revision_number), 0) + 1 into v_number from public.compliance_revisions r where r.design_id = p_design_id;
  v_fp := p_snapshot->>'fingerprint';
  insert into public.compliance_revisions(owner_id, design_id, revision_number, fingerprint, registry_version, engine_version, category, jurisdiction, snapshot)
  values (v_user, p_design_id, v_number, v_fp, p_snapshot->>'registryVersion', p_snapshot->>'engineVersion',
          nullif(p_snapshot->>'category', ''), nullif(p_snapshot->>'jurisdiction', ''), jsonb_set(p_snapshot, '{revisionNumber}', to_jsonb(v_number)))
  returning public.compliance_revisions.id into v_id;
  insert into public.compliance_audit_log(owner_id, revision_id, actor_id, action, detail)
  values (v_user, v_id, v_user, 'revision_registered', jsonb_build_object('revisionNumber', v_number, 'fingerprint', v_fp));
  return query select v_id, v_number;
end;
$$;

-- Owners (or admins) assign an actively qualified reviewer who is not the owner.
create function public.assign_compliance_reviewer(p_revision_id uuid, p_reviewer_id uuid)
returns table(assignment_id uuid)
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_owner uuid; v_status text; v_valid date; v_id uuid;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select r.owner_id into v_owner from public.compliance_revisions r where r.id = p_revision_id;
  if not found or (v_owner is distinct from v_user and public.current_user_role() is distinct from 'admin') then
    raise exception 'Revision unavailable' using errcode = '42501';
  end if;
  if p_reviewer_id is null or p_reviewer_id = v_owner then
    raise exception 'A revision owner cannot review their own revision' using errcode = '22023';
  end if;
  select status, valid_until into v_status, v_valid from public.compliance_reviewers where user_id = p_reviewer_id;
  if not found or v_status is distinct from 'active' then raise exception 'Reviewer is not qualified' using errcode = '22023'; end if;
  if v_valid is not null and v_valid < current_date then raise exception 'Reviewer qualification has expired' using errcode = '22023'; end if;
  insert into public.compliance_review_assignments(revision_id, owner_id, reviewer_id, assigned_by, status)
  values (p_revision_id, v_owner, p_reviewer_id, v_user, 'assigned')
  on conflict (revision_id, reviewer_id) do update set status = 'assigned', assigned_by = excluded.assigned_by, updated_at = now()
  returning id into v_id;
  insert into public.compliance_audit_log(owner_id, revision_id, actor_id, action, detail)
  values (v_owner, p_revision_id, v_user, 'reviewer_assigned', jsonb_build_object('reviewerId', p_reviewer_id));
  return query select v_id;
end;
$$;

-- The assigned reviewer records one immutable decision.
create function public.submit_review_decision(p_assignment_id uuid, p_decision text, p_statement text default null)
returns table(decision_id uuid)
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_asg public.compliance_review_assignments; v_status text; v_valid date; v_id uuid;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v_asg from public.compliance_review_assignments a where a.id = p_assignment_id for update;
  if not found then raise exception 'Assignment unavailable' using errcode = '42501'; end if;
  if v_asg.reviewer_id is distinct from v_user then raise exception 'Not the assigned reviewer' using errcode = '42501'; end if;
  if v_asg.status = 'declined' then raise exception 'Assignment was declined' using errcode = '22023'; end if;
  if p_decision not in ('APPROVED', 'APPROVED_WITH_COMMENTS', 'CHANGES_REQUIRED', 'REJECTED', 'RETURNED') then
    raise exception 'Invalid decision' using errcode = '22023';
  end if;
  if p_statement is not null and char_length(p_statement) > 5000 then raise exception 'Invalid statement' using errcode = '22023'; end if;
  select status, valid_until into v_status, v_valid from public.compliance_reviewers where user_id = v_user;
  if not found or v_status is distinct from 'active' then raise exception 'Reviewer is not qualified' using errcode = '42501'; end if;
  if v_valid is not null and v_valid < current_date then raise exception 'Reviewer qualification has expired' using errcode = '42501'; end if;
  if exists (select 1 from public.compliance_review_decisions d where d.revision_id = v_asg.revision_id) then
    raise exception 'A decision already exists for this revision' using errcode = '40001';
  end if;
  insert into public.compliance_review_decisions(revision_id, assignment_id, owner_id, reviewer_id, decision, statement)
  values (v_asg.revision_id, v_asg.id, v_asg.owner_id, v_user, p_decision, nullif(btrim(p_statement), ''))
  returning id into v_id;
  update public.compliance_review_assignments set status = 'completed', updated_at = now() where id = v_asg.id;
  insert into public.compliance_audit_log(owner_id, revision_id, actor_id, action, detail)
  values (v_asg.owner_id, v_asg.revision_id, v_user, 'decision_submitted', jsonb_build_object('decision', p_decision));
  return query select v_id;
end;
$$;

create function public.decline_review_assignment(p_assignment_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_asg public.compliance_review_assignments;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v_asg from public.compliance_review_assignments a where a.id = p_assignment_id for update;
  if not found or v_asg.reviewer_id is distinct from v_user or v_asg.status is distinct from 'assigned' then
    raise exception 'Assignment unavailable' using errcode = '42501';
  end if;
  update public.compliance_review_assignments set status = 'declined', updated_at = now() where id = p_assignment_id;
  insert into public.compliance_audit_log(owner_id, revision_id, actor_id, action, detail)
  values (v_asg.owner_id, v_asg.revision_id, v_user, 'assignment_declined', '{}'::jsonb);
end;
$$;

revoke all on function
  public.set_reviewer_qualification(uuid, text, text, date), public.suspend_reviewer_qualification(uuid),
  public.register_compliance_revision(uuid, jsonb), public.assign_compliance_reviewer(uuid, uuid),
  public.submit_review_decision(uuid, text, text), public.decline_review_assignment(uuid)
from public, anon;
grant execute on function
  public.set_reviewer_qualification(uuid, text, text, date), public.suspend_reviewer_qualification(uuid),
  public.register_compliance_revision(uuid, jsonb), public.assign_compliance_reviewer(uuid, uuid),
  public.submit_review_decision(uuid, text, text), public.decline_review_assignment(uuid)
to authenticated;
commit;
