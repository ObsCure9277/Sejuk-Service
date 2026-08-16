# Use profiles and repositories for Supabase access

Sejuk Service will store operational roles in a `profiles` table linked to Supabase Auth users, with `technician_id` mapping Technician users to technician records. React components will access persistence through small repository modules instead of embedding Supabase table queries directly, keeping UI code separate from database shape while the app transitions away from fake role switching.
