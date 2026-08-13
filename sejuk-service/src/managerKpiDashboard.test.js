import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { STATUS } from './orderStatus.js'
import { buildManagerKpiDashboard } from './managerKpiDashboard.js'

const technicians = [
  { id: 'ali', name: 'Ali', branch: 'Shah Alam' },
  { id: 'john', name: 'John', branch: 'Petaling Jaya' },
  { id: 'bala', name: 'Bala', branch: 'Klang' },
]

describe('buildManagerKpiDashboard', () => {
  it('builds weekly technician metrics from completed workflow states', () => {
    const dashboard = buildManagerKpiDashboard(
      [
        buildOrder({
          assignedTechnicianId: 'ali',
          completedAt: '13 Aug 2026, 11:45 AM',
          finalAmount: 390,
          status: STATUS.JOB_DONE,
        }),
        buildOrder({
          assignedTechnicianId: 'ali',
          attachments: 0,
          completedAt: '12 Aug 2026, 5:05 PM',
          finalAmount: 120,
          status: STATUS.REVIEWED,
        }),
        buildOrder({
          assignedTechnicianId: 'john',
          completedAt: '10 Aug 2026, 6:10 PM',
          finalAmount: 300,
          status: STATUS.CLOSED,
        }),
        buildOrder({
          assignedTechnicianId: 'bala',
          completedAt: '30 Jul 2026, 9:00 AM',
          finalAmount: 800,
          status: STATUS.CLOSED,
        }),
        buildOrder({
          assignedTechnicianId: 'bala',
          completedAt: null,
          finalAmount: null,
          status: STATUS.IN_PROGRESS,
        }),
      ],
      technicians,
    )

    assert.equal(dashboard.totalJobs, 3)
    assert.equal(dashboard.totalBilled, 810)
    assert.deepEqual(
      dashboard.rows.map((row) => [
        row.technicianName,
        row.jobsCompleted,
        row.billedAmount,
        row.awaitingReview,
      ]),
      [
        ['Ali', 2, 510, 1],
        ['John', 1, 300, 0],
      ],
    )
    assert.equal(dashboard.rows[0].evidenceRate, 50)
    assert.equal(dashboard.rows[0].jobShare, 100)
    assert.equal(dashboard.rows[1].jobShare, 50)
  })

  it('returns an empty state when no completed jobs have dates', () => {
    const dashboard = buildManagerKpiDashboard(
      [buildOrder({ status: STATUS.ASSIGNED })],
      technicians,
    )

    assert.equal(dashboard.periodLabel, 'No completed jobs yet')
    assert.deepEqual(dashboard.rows, [])
    assert.equal(dashboard.totalBilled, 0)
    assert.equal(dashboard.totalJobs, 0)
  })
})

function buildOrder(overrides = {}) {
  return {
    assignedTechnicianId: 'ali',
    attachments: 1,
    completedAt: '13 Aug 2026, 10:00 AM',
    finalAmount: 100,
    quotedPrice: 100,
    status: STATUS.JOB_DONE,
    ...overrides,
  }
}
