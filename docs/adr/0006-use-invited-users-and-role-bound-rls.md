# Use invited users and role-bound RLS

Sejuk Service will start with manually created or invited users, not public self-signup. Technicians can see and update only their assigned orders, Managers own review and close actions, and Admins own order intake and assignment, so authorization is enforced by Supabase RLS instead of the browser UI.
