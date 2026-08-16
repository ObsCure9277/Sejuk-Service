import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { STATUS } from './orderStatus.js'
import {
  ROLE,
  canCloseOrderForProfile,
  canCompleteOrderForProfile,
  canCreateOrderForProfile,
  canReadOrderForProfile,
  canReviewOrderForProfile,
  getProfileTechnicianScope,
} from './roleAccess.js'

describe('role access', () => {
  it('allows Admin and Manager to read every order while scoping Technicians to assigned orders', () => {
    const order = { assignedTechnicianId: 'ali', status: STATUS.ASSIGNED }

    assert.equal(canReadOrderForProfile(adminProfile(), order), true)
    assert.equal(canReadOrderForProfile(managerProfile(), order), true)
    assert.equal(canReadOrderForProfile(technicianProfile('ali'), order), true)
    assert.equal(canReadOrderForProfile(technicianProfile('john'), order), false)
    assert.equal(canReadOrderForProfile(null, order), false)
  })

  it('keeps Admins on intake and Managers on review or close actions', () => {
    assert.equal(canCreateOrderForProfile(adminProfile()), true)
    assert.equal(canCreateOrderForProfile(managerProfile()), false)

    assert.equal(
      canReviewOrderForProfile(managerProfile(), { status: STATUS.JOB_DONE }),
      true,
    )
    assert.equal(
      canReviewOrderForProfile(adminProfile(), { status: STATUS.JOB_DONE }),
      false,
    )
    assert.equal(
      canCloseOrderForProfile(managerProfile(), { status: STATUS.REVIEWED }),
      true,
    )
    assert.equal(
      canCloseOrderForProfile(managerProfile(), { status: STATUS.ASSIGNED }),
      false,
    )
  })

  it('allows Technicians to complete only their assigned active orders', () => {
    assert.equal(
      canCompleteOrderForProfile(technicianProfile('ali'), {
        assignedTechnicianId: 'ali',
        status: STATUS.IN_PROGRESS,
      }),
      true,
    )
    assert.equal(
      canCompleteOrderForProfile(technicianProfile('ali'), {
        assignedTechnicianId: 'john',
        status: STATUS.IN_PROGRESS,
      }),
      false,
    )
    assert.equal(
      canCompleteOrderForProfile(technicianProfile('ali'), {
        assignedTechnicianId: 'ali',
        status: STATUS.REVIEWED,
      }),
      false,
    )
  })

  it('exposes the Technician profile scope used by Supabase RLS filters', () => {
    assert.equal(getProfileTechnicianScope(technicianProfile('bala')), 'bala')
    assert.equal(getProfileTechnicianScope(adminProfile()), null)
  })
})

function adminProfile() {
  return { role: ROLE.ADMIN, technicianId: null }
}

function managerProfile() {
  return { role: ROLE.MANAGER, technicianId: null }
}

function technicianProfile(technicianId) {
  return { role: ROLE.TECHNICIAN, technicianId }
}
