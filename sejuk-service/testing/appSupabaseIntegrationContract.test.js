import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const appSource = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')

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

  it('uses role-aware profile checks for workflow actions and shows local action errors', () => {
    assert.match(appSource, /canCompleteOrderForProfile\(activeProfile, order\)/)
    assert.match(appSource, /canCompleteOrderForProfile\(activeProfile, job\)/)
    assert.match(appSource, /canReviewOrderForProfile\(activeProfile, order\)/)
    assert.match(appSource, /canCloseOrderForProfile\(activeProfile, order\)/)
    assert.doesNotMatch(appSource, /canReviewOrder\(order\)/)
    assert.doesNotMatch(appSource, /canCloseOrder\(order\)/)
    assert.match(appSource, /className="action-error"/)
    assert.match(appSource, /return \{ error: message \}/)
  })

})
