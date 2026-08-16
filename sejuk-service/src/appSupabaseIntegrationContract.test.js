import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const appSource = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')

describe('App Supabase integration contract', () => {
  it('uses demo data only when Supabase configuration is absent', () => {
    assert.match(
      appSource,
      /const \[activeProfile, setActiveProfile\] = useState\(\s*supabase \? null : demoProfiles\[ROLE\.ADMIN\]/,
    )
    assert.match(
      appSource,
      /const \[orders, setOrders\] = useState\(supabase \? \[\] : initialOrders\)/,
    )
    assert.match(
      appSource,
      /\{!supabase && \(\s*<nav className="role-switcher" aria-label="Demo role switcher">/,
    )
  })

  it('uses Supabase auth and repositories only in live mode', () => {
    assert.match(
      appSource,
      /\(\) => \(supabase \? createOrderRepository\(supabase\) : null\)/,
    )
    assert.match(
      appSource,
      /\(\) => \(supabase \? createSessionRepository\(supabase\) : null\)/,
    )
    assert.match(
      appSource,
      /\{supabase && !activeProfile && \(\s*<SupabaseLoginPanel/,
    )
    assert.match(appSource, /if \(!supabase\) return undefined/)
  })
})
