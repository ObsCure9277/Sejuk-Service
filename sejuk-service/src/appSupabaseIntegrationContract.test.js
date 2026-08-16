import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const appSource = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')

describe('App Supabase integration contract', () => {
  it('does not keep demo business records in the runtime app', () => {
    assert.doesNotMatch(appSource, /const initialOrders = \[/)
    assert.doesNotMatch(appSource, /const demoProfiles = \{/)
    assert.doesNotMatch(appSource, /const technicians = \[/)
    assert.doesNotMatch(appSource, /buildJobDoneOrderNotification\(\{\s*order:/)
    assert.doesNotMatch(appSource, /technician Ali/)
  })

  it('requires Supabase configuration instead of falling back to demo records', () => {
    assert.match(appSource, /if \(!supabase\) \{\s*return \(\s*<SupabaseSetupPanel/)
    assert.match(appSource, /const \[activeProfile, setActiveProfile\] = useState\(null\)/)
    assert.match(appSource, /const \[orders, setOrders\] = useState\(\[\]\)/)
    assert.doesNotMatch(appSource, /role-switcher/)
  })

  it('loads orders and technicians through Supabase repositories in live mode', () => {
    assert.match(appSource, /createOrderRepository\(supabase\)/)
    assert.match(appSource, /createSessionRepository\(supabase\)/)
    assert.match(appSource, /createTechnicianRepository\(supabase\)/)
    assert.match(appSource, /technicianRepository\s*\.listTechnicians\(\)/)
    assert.match(appSource, /orderRepository\s*\.listOrders\(\)/)
  })
})
