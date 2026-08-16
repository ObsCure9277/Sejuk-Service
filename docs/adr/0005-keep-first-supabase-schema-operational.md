# Keep the first Supabase schema operational

The first Supabase schema will keep customer, payment, and evidence metadata on `orders` while preserving workflow audit entries in `order_history`. This favors a straightforward operational model over early CRM, payments, or storage abstractions, while still leaving room to split customers, payments, and Supabase Storage later.
