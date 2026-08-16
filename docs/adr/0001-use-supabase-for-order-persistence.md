# Use Supabase for order persistence

Sejuk Service will persist operational data in Supabase, with normal order CRUD performed directly from the Vite browser app using the publishable key and Row Level Security. Privileged operations that require a secret key will stay server-side, either in future Supabase Edge Functions or another backend, so secrets are not exposed in client code.
