# Build Supabase integration in stages

Sejuk Service will add Supabase persistence in staged commits: SQL schema and seed files first, then frontend client and repositories, then authentication UI, then write actions. Demo data remains only as a local fallback when Supabase environment variables are missing, and it must not mix with live database data in the same session.
