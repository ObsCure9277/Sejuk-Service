# Use a hybrid Supabase order model

Sejuk Service will store the current order state in an `orders` table and preserve workflow audit entries in an `order_history` table. The database will generate the human-facing `order_number` to avoid browser-side race conditions, while evidence files remain metadata-only until Supabase Storage policies are designed.
