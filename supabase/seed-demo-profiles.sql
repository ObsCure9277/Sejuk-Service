-- Create these users first in Supabase Auth. This script looks up their
-- auth.users.id values by email so profiles satisfy profiles_user_id_fkey.
--
-- Demo accounts aligned with supabase/import-current-data.sql actors:
-- admin@sejuk-service.test           -> Operations Admin
-- manager@sejuk-service.test         -> Service Manager
-- technician.ali@sejuk-service.test  -> Ali, technician_id ali
-- technician.john@sejuk-service.test -> John, technician_id john
-- technician.bala@sejuk-service.test -> Bala, technician_id bala
-- technician.yusoff@sejuk-service.test -> Yusoff, technician_id yusoff

do $$
declare
  missing_emails text;
begin
  with expected_profiles(email, display_name, role, technician_id) as (
    values
      ('admin@sejuk-service.test', 'Operations Admin', 'Admin', null),
      ('manager@sejuk-service.test', 'Service Manager', 'Manager', null),
      ('technician.ali@sejuk-service.test', 'Ali', 'Technician', 'ali'),
      ('technician.john@sejuk-service.test', 'John', 'Technician', 'john'),
      ('technician.bala@sejuk-service.test', 'Bala', 'Technician', 'bala'),
      ('technician.yusoff@sejuk-service.test', 'Yusoff', 'Technician', 'yusoff')
  )
  select string_agg(expected_profiles.email, ', ' order by expected_profiles.email)
  into missing_emails
  from expected_profiles
  left join auth.users on auth.users.email = expected_profiles.email
  where auth.users.id is null;

  if missing_emails is not null then
    raise exception 'Create these Supabase Auth users before seeding profiles: %',
      missing_emails;
  end if;
end $$;

with expected_profiles(email, display_name, role, technician_id) as (
  values
    ('admin@sejuk-service.test', 'Operations Admin', 'Admin', null),
    ('manager@sejuk-service.test', 'Service Manager', 'Manager', null),
    ('technician.ali@sejuk-service.test', 'Ali', 'Technician', 'ali'),
    ('technician.john@sejuk-service.test', 'John', 'Technician', 'john'),
    ('technician.bala@sejuk-service.test', 'Bala', 'Technician', 'bala'),
    ('technician.yusoff@sejuk-service.test', 'Yusoff', 'Technician', 'yusoff')
)
insert into public.profiles (user_id, display_name, role, technician_id)
select
  auth.users.id,
  expected_profiles.display_name,
  expected_profiles.role,
  expected_profiles.technician_id
from expected_profiles
join auth.users on auth.users.email = expected_profiles.email
on conflict (user_id) do update
set
  display_name = excluded.display_name,
  role = excluded.role,
  technician_id = excluded.technician_id,
  updated_at = now();