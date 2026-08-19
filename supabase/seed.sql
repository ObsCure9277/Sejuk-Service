insert into public.technicians (id, name, branch, is_active)
values
  ('ali', 'Ali', 'Shah Alam', true),
  ('john', 'John', 'Petaling Jaya', true),
  ('bala', 'Bala', 'Klang', true),
  ('yusoff', 'Yusoff', 'Subang', true)
on conflict (id) do update
set
  name = excluded.name,
  branch = excluded.branch,
  is_active = excluded.is_active,
  updated_at = now();

-- After creating the first Admin user in Supabase Auth, run this manually
-- with that user's UUID. Do not run it with the placeholder UUID.
--
-- insert into public.profiles (user_id, display_name, role)
-- values ('00000000-0000-0000-0000-000000000000', 'Admin', 'Admin');
