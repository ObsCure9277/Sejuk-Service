import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createSupabaseClient,
  hasSupabaseConfig,
} from './supabaseClient.js'

describe('Supabase client configuration', () => {
  it('keeps Supabase disabled unless both browser environment variables are present', () => {
    assert.equal(hasSupabaseConfig({}), false)
    assert.equal(
      hasSupabaseConfig({
        VITE_SUPABASE_URL: 'https://example.supabase.co',
      }),
      false,
    )
    assert.equal(
      hasSupabaseConfig({
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
      }),
      false,
    )
    assert.equal(
      hasSupabaseConfig({
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
        VITE_SUPABASE_URL: 'https://example.supabase.co',
      }),
      true,
    )
  })

  it('returns null in demo mode and creates a client only for live Supabase mode', () => {
    assert.equal(createSupabaseClient({}), null)

    const client = createSupabaseClient({
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
      VITE_SUPABASE_URL: 'https://example.supabase.co',
    })

    assert.equal(typeof client.from, 'function')
    assert.equal(typeof client.rpc, 'function')
    assert.equal(typeof client.auth.signInWithPassword, 'function')
  })
})
