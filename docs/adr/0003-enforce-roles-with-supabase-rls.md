# Enforce roles with Supabase RLS

Admin, Technician, and Manager are real logged-in roles, not just UI modes. Supabase Row Level Security will enforce role-specific access from the first database pass so client-side code cannot bypass operational permissions.
