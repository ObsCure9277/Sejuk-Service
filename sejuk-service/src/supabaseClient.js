import { createClient } from '@supabase/supabase-js'

export function hasSupabaseConfig(env = import.meta.env) {
  return Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY)
}

export function createSupabaseClient(env = import.meta.env) {
  if (!hasSupabaseConfig(env)) return null

  return createClient(
    env.VITE_SUPABASE_URL,
    env.VITE_SUPABASE_PUBLISHABLE_KEY,
  )
}
