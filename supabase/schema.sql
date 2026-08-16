create extension if not exists pgcrypto;

create sequence if not exists public.order_number_seq start with 1201;

create or replace function public.next_order_number()
returns text
language sql
as $$
  select 'ORDER' || nextval('public.order_number_seq')::text;
$$;

create table if not exists public.technicians (
  id text primary key,
  name text not null,
  branch text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('Admin', 'Technician', 'Manager')),
  technician_id text references public.technicians(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint technician_role_requires_technician
    check (
      (role = 'Technician' and technician_id is not null)
      or (role in ('Admin', 'Manager') and technician_id is null)
    )
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default public.next_order_number(),
  customer_name text not null,
  phone text not null,
  address text not null,
  service_type text not null check (
    service_type in (
      'Aircond cleaning',
      'Repair',
      'Gas refill',
      'Installation',
      'Inspection'
    )
  ),
  problem text not null,
  quoted_price numeric(10, 2) not null check (quoted_price > 0),
  final_amount numeric(10, 2) check (final_amount is null or final_amount >= 0),
  completion_work_done text,
  completion_extra_charges numeric(10, 2) not null default 0 check (completion_extra_charges >= 0),
  completion_remarks text,
  evidence jsonb not null default '[]'::jsonb,
  payment_received boolean not null default false,
  payment_amount numeric(10, 2) check (payment_amount is null or payment_amount >= 0),
  payment_method text,
  receipt_file_name text,
  assigned_technician_id text not null references public.technicians(id),
  admin_notes text not null default '',
  status text not null default 'Assigned' check (
    status in ('New', 'Assigned', 'In Progress', 'Job Done', 'Reviewed', 'Closed')
  ),
  completed_at timestamptz,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  reviewed_by uuid references auth.users(id),
  closed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  actor_user_id uuid references auth.users(id),
  actor_label text not null,
  action text not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where user_id = auth.uid();
$$;

create or replace function public.current_technician_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select technician_id from public.profiles where user_id = auth.uid();
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.enforce_order_update_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  app_role text := public.current_app_role();
  technician_id text := public.current_technician_id();
begin
  if app_role = 'Admin' then
    if old.status not in ('New', 'Assigned', 'In Progress')
       or new.status not in ('New', 'Assigned', 'In Progress')
       or new.final_amount is distinct from old.final_amount
       or new.completion_work_done is distinct from old.completion_work_done
       or new.completion_extra_charges is distinct from old.completion_extra_charges
       or new.completion_remarks is distinct from old.completion_remarks
       or new.evidence is distinct from old.evidence
       or new.payment_received is distinct from old.payment_received
       or new.payment_amount is distinct from old.payment_amount
       or new.payment_method is distinct from old.payment_method
       or new.receipt_file_name is distinct from old.receipt_file_name
       or new.completed_at is distinct from old.completed_at
       or new.reviewed_by is distinct from old.reviewed_by
       or new.closed_by is distinct from old.closed_by then
      raise exception 'Admins can only update order intake details';
    end if;

    return new;
  end if;

  if app_role = 'Technician' then
    if old.assigned_technician_id is distinct from technician_id
       or new.assigned_technician_id is distinct from old.assigned_technician_id
       or old.status not in ('Assigned', 'In Progress')
       or new.status <> 'Job Done'
       or new.order_number is distinct from old.order_number
       or new.customer_name is distinct from old.customer_name
       or new.phone is distinct from old.phone
       or new.address is distinct from old.address
       or new.service_type is distinct from old.service_type
       or new.problem is distinct from old.problem
       or new.quoted_price is distinct from old.quoted_price
       or new.admin_notes is distinct from old.admin_notes
       or new.reviewed_by is distinct from old.reviewed_by
       or new.closed_by is distinct from old.closed_by then
      raise exception 'Technicians can only complete their assigned orders';
    end if;

    return new;
  end if;

  if app_role = 'Manager' then
    if old.status not in ('Job Done', 'Reviewed')
       or new.status not in ('Reviewed', 'Closed')
       or new.order_number is distinct from old.order_number
       or new.customer_name is distinct from old.customer_name
       or new.phone is distinct from old.phone
       or new.address is distinct from old.address
       or new.service_type is distinct from old.service_type
       or new.problem is distinct from old.problem
       or new.quoted_price is distinct from old.quoted_price
       or new.final_amount is distinct from old.final_amount
       or new.completion_work_done is distinct from old.completion_work_done
       or new.completion_extra_charges is distinct from old.completion_extra_charges
       or new.completion_remarks is distinct from old.completion_remarks
       or new.evidence is distinct from old.evidence
       or new.payment_received is distinct from old.payment_received
       or new.payment_amount is distinct from old.payment_amount
       or new.payment_method is distinct from old.payment_method
       or new.receipt_file_name is distinct from old.receipt_file_name
       or new.assigned_technician_id is distinct from old.assigned_technician_id
       or new.admin_notes is distinct from old.admin_notes
       or new.completed_at is distinct from old.completed_at then
      raise exception 'Managers can only review or close completed orders';
    end if;

    return new;
  end if;

  raise exception 'No application role is configured for this user';
end;
$$;

drop trigger if exists touch_technicians_updated_at on public.technicians;
create trigger touch_technicians_updated_at
before update on public.technicians
for each row execute function public.touch_updated_at();

drop trigger if exists touch_profiles_updated_at on public.profiles;
create trigger touch_profiles_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists touch_orders_updated_at on public.orders;
create trigger touch_orders_updated_at
before update on public.orders
for each row execute function public.touch_updated_at();

drop trigger if exists enforce_order_update_permissions on public.orders;
create trigger enforce_order_update_permissions
before update on public.orders
for each row execute function public.enforce_order_update_permissions();

alter table public.technicians enable row level security;
alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.order_history enable row level security;

drop policy if exists "profiles select own or admin" on public.profiles;
create policy "profiles select own or admin"
on public.profiles
for select
to authenticated
using (user_id = auth.uid() or public.current_app_role() = 'Admin');

drop policy if exists "profiles admin insert" on public.profiles;
create policy "profiles admin insert"
on public.profiles
for insert
to authenticated
with check (public.current_app_role() = 'Admin');

drop policy if exists "profiles admin update" on public.profiles;
create policy "profiles admin update"
on public.profiles
for update
to authenticated
using (public.current_app_role() = 'Admin')
with check (public.current_app_role() = 'Admin');

drop policy if exists "technicians read authenticated" on public.technicians;
create policy "technicians read authenticated"
on public.technicians
for select
to authenticated
using (true);

drop policy if exists "technicians admin write" on public.technicians;
create policy "technicians admin write"
on public.technicians
for all
to authenticated
using (public.current_app_role() = 'Admin')
with check (public.current_app_role() = 'Admin');

drop policy if exists "orders role based read" on public.orders;
create policy "orders role based read"
on public.orders
for select
to authenticated
using (
  public.current_app_role() in ('Admin', 'Manager')
  or (
    public.current_app_role() = 'Technician'
    and assigned_technician_id = public.current_technician_id()
  )
);

drop policy if exists "orders admin insert" on public.orders;
create policy "orders admin insert"
on public.orders
for insert
to authenticated
with check (
  public.current_app_role() = 'Admin'
  and created_by = auth.uid()
);

drop policy if exists "orders admin update intake" on public.orders;
create policy "orders admin update intake"
on public.orders
for update
to authenticated
using (public.current_app_role() = 'Admin')
with check (public.current_app_role() = 'Admin');

drop policy if exists "orders technician complete assigned" on public.orders;
create policy "orders technician complete assigned"
on public.orders
for update
to authenticated
using (
  public.current_app_role() = 'Technician'
  and assigned_technician_id = public.current_technician_id()
)
with check (
  public.current_app_role() = 'Technician'
  and assigned_technician_id = public.current_technician_id()
);

drop policy if exists "orders manager review close" on public.orders;
create policy "orders manager review close"
on public.orders
for update
to authenticated
using (public.current_app_role() = 'Manager')
with check (public.current_app_role() = 'Manager');

drop policy if exists "order history role based read" on public.order_history;
create policy "order history role based read"
on public.order_history
for select
to authenticated
using (
  exists (
    select 1
    from public.orders
    where orders.id = order_history.order_id
  )
);

drop policy if exists "order history role based insert" on public.order_history;
create policy "order history role based insert"
on public.order_history
for insert
to authenticated
with check (
  actor_user_id = auth.uid()
  and exists (
    select 1
    from public.orders
    where orders.id = order_history.order_id
  )
);

create or replace function public.create_order_with_history(
  p_customer_name text,
  p_phone text,
  p_address text,
  p_service_type text,
  p_problem text,
  p_quoted_price numeric,
  p_assigned_technician_id text,
  p_admin_notes text,
  p_actor_label text,
  p_action text
)
returns public.orders
language plpgsql
as $$
declare
  created_order public.orders;
begin
  insert into public.orders (
    customer_name,
    phone,
    address,
    service_type,
    problem,
    quoted_price,
    assigned_technician_id,
    admin_notes,
    status,
    created_by,
    updated_by
  )
  values (
    p_customer_name,
    p_phone,
    p_address,
    p_service_type,
    p_problem,
    p_quoted_price,
    p_assigned_technician_id,
    p_admin_notes,
    'Assigned',
    auth.uid(),
    auth.uid()
  )
  returning * into created_order;

  insert into public.order_history (order_id, actor_user_id, actor_label, action)
  values (created_order.id, auth.uid(), p_actor_label, p_action);

  return created_order;
end;
$$;

create or replace function public.complete_order_with_history(
  p_order_id uuid,
  p_final_amount numeric,
  p_completion_work_done text,
  p_completion_extra_charges numeric,
  p_completion_remarks text,
  p_evidence jsonb,
  p_payment_received boolean,
  p_payment_amount numeric,
  p_payment_method text,
  p_receipt_file_name text,
  p_completed_at timestamptz,
  p_actor_label text,
  p_action text
)
returns public.orders
language plpgsql
as $$
declare
  updated_order public.orders;
begin
  update public.orders
  set
    final_amount = p_final_amount,
    completion_work_done = p_completion_work_done,
    completion_extra_charges = p_completion_extra_charges,
    completion_remarks = p_completion_remarks,
    evidence = p_evidence,
    payment_received = p_payment_received,
    payment_amount = p_payment_amount,
    payment_method = p_payment_method,
    receipt_file_name = p_receipt_file_name,
    completed_at = p_completed_at,
    status = 'Job Done',
    updated_by = auth.uid()
  where id = p_order_id
  returning * into updated_order;

  if updated_order.id is null then
    raise exception 'Order % was not found or cannot be completed', p_order_id;
  end if;

  insert into public.order_history (order_id, actor_user_id, actor_label, action)
  values (updated_order.id, auth.uid(), p_actor_label, p_action);

  return updated_order;
end;
$$;

create or replace function public.review_order_with_history(
  p_order_id uuid,
  p_actor_label text,
  p_action text
)
returns public.orders
language plpgsql
as $$
declare
  updated_order public.orders;
begin
  update public.orders
  set
    reviewed_by = auth.uid(),
    status = 'Reviewed',
    updated_by = auth.uid()
  where id = p_order_id
  returning * into updated_order;

  if updated_order.id is null then
    raise exception 'Order % was not found or cannot be reviewed', p_order_id;
  end if;

  insert into public.order_history (order_id, actor_user_id, actor_label, action)
  values (updated_order.id, auth.uid(), p_actor_label, p_action);

  return updated_order;
end;
$$;

create or replace function public.close_order_with_history(
  p_order_id uuid,
  p_actor_label text,
  p_action text
)
returns public.orders
language plpgsql
as $$
declare
  updated_order public.orders;
begin
  update public.orders
  set
    closed_by = auth.uid(),
    status = 'Closed',
    updated_by = auth.uid()
  where id = p_order_id
  returning * into updated_order;

  if updated_order.id is null then
    raise exception 'Order % was not found or cannot be closed', p_order_id;
  end if;

  insert into public.order_history (order_id, actor_user_id, actor_label, action)
  values (updated_order.id, auth.uid(), p_actor_label, p_action);

  return updated_order;
end;
$$;

grant execute on function public.create_order_with_history(text, text, text, text, text, numeric, text, text, text, text) to authenticated;
grant execute on function public.complete_order_with_history(uuid, numeric, text, numeric, text, jsonb, boolean, numeric, text, text, timestamptz, text, text) to authenticated;
grant execute on function public.review_order_with_history(uuid, text, text) to authenticated;
grant execute on function public.close_order_with_history(uuid, text, text) to authenticated;
grant usage on schema public to authenticated;
grant usage, select on sequence public.order_number_seq to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.technicians to authenticated;
grant select, insert, update on public.orders to authenticated;
grant select, insert on public.order_history to authenticated;

