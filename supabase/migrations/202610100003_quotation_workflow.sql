-- Quotation workflow and staff roles. All request/quotation mutations go through
-- security-definer functions so state transitions, ownership and role rules are
-- enforced in one place. Tables stay deny-by-default: clients get SELECT only.
begin;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 100),
  role text not null default 'customer' check (role in ('customer', 'engineer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- Security-definer role lookup; admin cannot be self-assigned (see set_user_role).
create function public.current_user_role() returns text
language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p where p.user_id = (select auth.uid())
$$;

create policy profiles_select on public.profiles for select to authenticated
  using (user_id = (select auth.uid()) or public.current_user_role() = 'admin');
create policy profiles_insert on public.profiles for insert to authenticated
  with check (user_id = (select auth.uid()) and role = 'customer');
revoke all on public.profiles from anon;
grant select, insert on public.profiles to authenticated;

create table public.quotation_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references auth.users(id) on delete cascade,
  building_id uuid references public.buildings(id) on delete set null,
  discipline text not null check (discipline in ('solar','electrical','mechanical','structural','plumbing','fire','acoustic','hvac')),
  subject text not null check (char_length(subject) between 1 and 150),
  message text not null check (char_length(message) between 1 and 20000),
  status text not null default 'new' check (status in ('new','assigned','quoted','accepted','completed','rejected','withdrawn')),
  engineer_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index quotation_requests_queue_idx on public.quotation_requests(status, created_at);
create index quotation_requests_customer_idx on public.quotation_requests(customer_id, created_at desc);
alter table public.quotation_requests enable row level security;
create policy quotation_requests_select on public.quotation_requests for select to authenticated
  using (customer_id = (select auth.uid()) or public.current_user_role() in ('engineer', 'admin'));
revoke all on public.quotation_requests from anon;
grant select on public.quotation_requests to authenticated;

create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.quotation_requests(id) on delete cascade,
  engineer_id uuid not null references auth.users(id) on delete restrict,
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft','sent','accepted','declined','superseded')),
  currency char(3) not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  tax_rate numeric(5, 4) not null default 0.2300 check (tax_rate between 0 and 1),
  tax numeric(12, 2) not null check (tax >= 0),
  total numeric(12, 2) not null check (total >= 0),
  notes text check (notes is null or char_length(notes) <= 10000),
  valid_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index quotations_request_idx on public.quotations(request_id, version desc);
alter table public.quotations enable row level security;
create policy quotations_select on public.quotations for select to authenticated
  using (exists (select 1 from public.quotation_requests r where r.id = request_id
                 and (r.customer_id = (select auth.uid()) or r.engineer_id = (select auth.uid()) or public.current_user_role() = 'admin')));
revoke all on public.quotations from anon;
grant select on public.quotations to authenticated;

create table public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  position integer not null check (position > 0),
  description text not null check (char_length(description) between 1 and 2000),
  quantity numeric(10, 2) not null check (quantity > 0),
  unit text not null check (char_length(unit) between 1 and 20),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  amount numeric(12, 2) not null check (amount >= 0)
);
alter table public.quotation_items enable row level security;
create policy quotation_items_select on public.quotation_items for select to authenticated
  using (exists (select 1 from public.quotations q where q.id = quotation_id));
revoke all on public.quotation_items from anon;
grant select on public.quotation_items to authenticated;

create function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end; $$;
create trigger profiles_updated before update on public.profiles for each row execute function public.touch_updated_at();
create trigger requests_updated before update on public.quotation_requests for each row execute function public.touch_updated_at();
create trigger quotations_updated before update on public.quotations for each row execute function public.touch_updated_at();

-- Lazily registers a customer profile (role default) or returns an existing one.
create function public.ensure_profile() returns public.profiles
language plpgsql security invoker set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_row public.profiles;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  insert into public.profiles(user_id, display_name) values (v_user, 'Customer')
    on conflict (user_id) do nothing;
  select * into v_row from public.profiles p where p.user_id = v_user;
  return v_row;
end;
$$;

-- First administrator bootstrap. Runs in the database editor (as superuser/owner only).
create function public.bootstrap_admin(p_user_id uuid, p_display_name text)
returns table(out_user_id uuid, out_display_name text, out_role text)
language plpgsql security definer set search_path = '' as $$
declare v_row public.profiles;
begin
  if not (coalesce((select r.rolsuper from pg_catalog.pg_roles r where r.rolname = current_user), false) or current_user = 'postgres')
    or p_user_id is null or nullif(btrim(p_display_name), '') is null then
    raise exception 'Bootstrap requires database owner privileges' using errcode = '42501';
  end if;
  insert into public.profiles(user_id, display_name, role) values (p_user_id, p_display_name, 'admin')
    on conflict (user_id) do update set role = 'admin', display_name = excluded.display_name
    returning * into v_row;
  return query select v_row.user_id, v_row.display_name, v_row.role;
end;
$$;

-- Role management: only admins change roles, never their own, at least one admin remains.
create function public.set_user_role(p_user_id uuid, p_role text)
returns table(out_user_id uuid, out_display_name text, out_role text)
language plpgsql security definer set search_path = '' as $$
declare v_caller uuid := (select auth.uid()); v_me text; v_row public.profiles; v_admins bigint;
begin
  if v_caller is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_role not in ('customer', 'engineer', 'admin') then raise exception 'Invalid role' using errcode = '22023'; end if;
  select role into v_me from public.profiles where user_id = v_caller;
  if v_me is distinct from 'admin' then raise exception 'Administrator required' using errcode = '42501'; end if;
  if p_user_id = v_caller then raise exception 'Administrators cannot change their own role' using errcode = '42501'; end if;
  if p_role is distinct from 'admin' and exists (select 1 from public.profiles where user_id = p_user_id and role = 'admin') then
    select count(*) into v_admins from public.profiles where role = 'admin';
    if v_admins <= 1 then raise exception 'At least one administrator must remain' using errcode = '40001'; end if;
  end if;
  insert into public.profiles(user_id, display_name, role) values (p_user_id, 'Engineer', p_role)
    on conflict (user_id) do update set role = excluded.role
    returning * into v_row;
  return query select v_row.user_id, v_row.display_name, v_row.role;
end;
$$;

-- Customers submit their own request, linked to one of their own buildings when provided.
create function public.submit_quotation_request(p_discipline text, p_subject text, p_message text, p_building_id uuid default null)
returns table(sid uuid)
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_id uuid;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_discipline not in ('solar','electrical','mechanical','structural','plumbing','fire','acoustic','hvac')
    or nullif(btrim(p_subject), '') is null or char_length(p_subject) > 150
    or nullif(btrim(p_message), '') is null or char_length(p_message) > 20000 then
    raise exception 'Invalid request' using errcode = '22023';
  end if;
  if p_building_id is not null and not exists (select 1 from public.buildings b where b.id = p_building_id and b.owner_id = v_user) then
    raise exception 'Building unavailable' using errcode = '42501';
  end if;
  insert into public.quotation_requests(customer_id, building_id, discipline, subject, message, status)
  values (v_user, p_building_id, p_discipline, p_subject, p_message, 'new') returning id into v_id;
  return query select v_id;
end;
$$;

-- Customers withdraw their own open request.
create function public.cancel_quotation_request(p_request_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  update public.quotation_requests r set status = 'withdrawn'
  where r.id = p_request_id and r.customer_id = v_user and r.status in ('new', 'assigned');
  if not found then raise exception 'Request unavailable or cannot be withdrawn' using errcode = '42501'; end if;
end;
$$;

-- Staff claim the next open request (only unassigned new requests).
create function public.claim_quotation_request(p_request_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_role text := public.current_user_role();
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if v_role is null or v_role not in ('engineer', 'admin') then raise exception 'Staff only' using errcode = '42501'; end if;
  update public.quotation_requests r set status = 'assigned', engineer_id = v_user
  where r.id = p_request_id and r.status = 'new';
  if not found then raise exception 'Request is already assigned or unavailable' using errcode = '40001'; end if;
end;
$$;

-- Admins assign any request to a staff member.
create function public.assign_quotation_request(p_request_id uuid, p_engineer_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_role text := public.current_user_role(); v_target text;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if v_role is distinct from 'admin' then raise exception 'Administrator required' using errcode = '42501'; end if;
  select role into v_target from public.profiles where user_id = p_engineer_id;
  if v_target not in ('engineer', 'admin') then raise exception 'Target is not staff' using errcode = '22023'; end if;
  update public.quotation_requests r set status = 'assigned', engineer_id = p_engineer_id
  where r.id = p_request_id and r.status in ('new', 'assigned');
  if not found then raise exception 'Request unavailable' using errcode = '42501'; end if;
end;
$$;

-- Staff transition a request they are assigned to, or admins any request.
-- Generic transitions: accepted -> completed (handover), any open/openish -> rejected (admin).
create function public.transition_quotation_request(p_request_id uuid, p_new_status text, p_notes text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_role text := public.current_user_role();
        v_request public.quotation_requests;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_new_status not in ('rejected', 'completed') then raise exception 'Use the dedicated flow' using errcode = '22023'; end if;
  select * into v_request from public.quotation_requests r where r.id = p_request_id for share;
  if not found then raise exception 'Request unavailable' using errcode = '42501'; end if;
  if p_new_status = 'rejected' and v_role is distinct from 'admin' then raise exception 'Administrator required' using errcode = '42501'; end if;
  if p_new_status = 'completed' and v_request.status is distinct from 'accepted' then raise exception 'Only accepted requests can be completed' using errcode = '22023'; end if;
  if p_new_status = 'completed' and v_role = 'engineer' and v_request.engineer_id is distinct from v_user then raise exception 'Not the assigned engineer' using errcode = '42501'; end if;
  update public.quotation_requests set status = p_new_status, updated_at = now() where id = p_request_id;
end;
$$;

-- Engineers (assigned or admin) save a quotation. Each save appends a new immutable
-- version and supersedes earlier open ones; sending moves the request to "quoted".
create function public.save_quotation(
  p_request_id uuid, p_items jsonb, p_currency text default 'EUR',
  p_tax_rate numeric default 0.2300, p_notes text default null,
  p_valid_until date default null, p_expected_version integer default null, p_send boolean default false)
returns table(qid uuid, qversion integer, request_status text)
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_role text := public.current_user_role();
        v_req public.quotation_requests; v_active integer; v_next integer;
        v_subtotal numeric := 0; v_tax numeric; v_total numeric; v_qid uuid; v_pos integer := 0; v_item record;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if v_role is null or v_role not in ('engineer', 'admin') then raise exception 'Staff only' using errcode = '42501'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 100 then
    raise exception 'Items must be an array of 1-100 rows' using errcode = '22023';
  end if;
  if p_currency is null or p_currency !~ '^[A-Z]{3}$' or p_tax_rate is null or p_tax_rate < 0 or p_tax_rate > 1 then
    raise exception 'Invalid currency or tax rate' using errcode = '22023';
  end if;
  select * into v_req from public.quotation_requests r where r.id = p_request_id for share;
  if not found then raise exception 'Request unavailable' using errcode = '42501'; end if;
  if v_req.status not in ('assigned', 'quoted') then raise exception 'Request is not quotable' using errcode = '22023'; end if;
  if v_role = 'engineer' and v_req.engineer_id is distinct from v_user then raise exception 'Not the assigned engineer' using errcode = '42501'; end if;
  select coalesce(max(q.version), 0) into v_active from public.quotations q where q.request_id = p_request_id;
  if p_expected_version is not null and p_expected_version is distinct from v_active then raise exception 'Version conflict' using errcode = '40001'; end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    if v_item.value->>'description' is null or nullif(btrim(v_item.value->>'description'), '') is null
       or char_length(v_item.value->>'description') > 2000
       or (v_item.value->>'quantity')::numeric is null or (v_item.value->>'quantity')::numeric <= 0 or (v_item.value->>'quantity')::numeric > 1000000
       or nullif(btrim(v_item.value->>'unit'), '') is null or char_length(v_item.value->>'unit') > 20
       or (v_item.value->>'unit_price')::numeric is null or (v_item.value->>'unit_price')::numeric < 0 or (v_item.value->>'unit_price')::numeric > 1000000000 then
      raise exception 'Invalid line item' using errcode = '22023';
    end if;
    v_subtotal := v_subtotal + round(((v_item.value->>'quantity')::numeric) * ((v_item.value->>'unit_price')::numeric), 2);
  end loop;
  v_tax := round(v_subtotal * p_tax_rate, 2);
  v_total := round((v_subtotal + v_tax), 2);
  update public.quotations set status = 'superseded', updated_at = now()
    where request_id = p_request_id and status in ('draft', 'sent');
  v_next := v_active + 1;
  insert into public.quotations(request_id, engineer_id, version, status, currency, subtotal, tax_rate, tax, total, notes, valid_until)
  values (p_request_id, v_user, v_next, case when p_send then 'sent' else 'draft' end, p_currency, v_subtotal, p_tax_rate, v_tax, v_total, p_notes, p_valid_until)
  returning id into v_qid;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_pos := v_pos + 1;
    insert into public.quotation_items(quotation_id, position, description, quantity, unit, unit_price, amount)
    values (v_qid, v_pos,
            v_item.value->>'description', (v_item.value->>'quantity')::numeric,
            v_item.value->>'unit', (v_item.value->>'unit_price')::numeric,
            round(((v_item.value->>'quantity')::numeric) * ((v_item.value->>'unit_price')::numeric), 2));
  end loop;
  if p_send then update public.quotation_requests set status = 'quoted' where id = p_request_id; end if;
  return query select v_qid, v_next, (select status from public.quotation_requests where id = p_request_id);
end;
$$;

-- Customers accept or decline the latest sent quotation belonging to their request.
create function public.respond_to_quotation(p_quotation_id uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_quotation public.quotations; v_request public.quotation_requests;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v_quotation from public.quotations q where q.id = p_quotation_id for share;
  if not found then raise exception 'Quotation unavailable' using errcode = '42501'; end if;
  select * into v_request from public.quotation_requests r where r.id = v_quotation.request_id for update;
  if v_request.customer_id is distinct from v_user then raise exception 'Not your quotation' using errcode = '42501'; end if;
  if v_quotation.status is distinct from 'sent' or v_request.status is distinct from 'quoted' then
    raise exception 'Quotation is not awaiting a response' using errcode = '22023';
  end if;
  if p_accept then
    update public.quotations set status = 'accepted' where id = p_quotation_id;
    update public.quotation_requests set status = 'accepted' where id = v_request.id;
  else
    update public.quotations set status = 'declined' where id = p_quotation_id;
    update public.quotation_requests set status = 'assigned' where id = v_request.id;
  end if;
end;
$$;

revoke all on function
  public.ensure_profile(), public.bootstrap_admin(uuid, text), public.set_user_role(uuid, text),
  public.submit_quotation_request(text, text, text, uuid), public.cancel_quotation_request(uuid),
  public.claim_quotation_request(uuid), public.assign_quotation_request(uuid, uuid),
  public.transition_quotation_request(uuid, text, text), public.save_quotation(uuid, jsonb, text, numeric, text, date, integer, boolean),
  public.respond_to_quotation(uuid, boolean), public.current_user_role()
from public, anon;
grant execute on function
  public.ensure_profile(), public.current_user_role() to authenticated;
grant execute on function
  public.bootstrap_admin(uuid, text), public.set_user_role(uuid, text),
  public.submit_quotation_request(text, text, text, uuid), public.cancel_quotation_request(uuid),
  public.claim_quotation_request(uuid), public.assign_quotation_request(uuid, uuid),
  public.transition_quotation_request(uuid, text, text), public.save_quotation(uuid, jsonb, text, numeric, text, date, integer, boolean),
  public.respond_to_quotation(uuid, boolean) to authenticated;
commit;
