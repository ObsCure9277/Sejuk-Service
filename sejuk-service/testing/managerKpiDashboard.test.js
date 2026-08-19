import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { STATUS } from '../src/orderStatus.js'
import { buildManagerKpiDashboard } from '../src/managerKpiDashboard.js'

const technicians = [
  { id: 'ali', name: 'Ali', branch: 'Shah Alam' },
  { id: 'john', name: 'John', branch: 'Petaling Jaya' },
  { id: 'bala', name: 'Bala', branch: 'Klang' },
]

describe('buildManagerKpiDashboard', () => {
  it('builds current and previous calendar week metrics', () => {
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
          completedAt: '7 Aug 2026, 9:00 AM',
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
      new Date('13 Aug 2026, 12:00 PM'),
    )

    assert.equal(dashboard.totalJobs, 3)
    assert.equal(dashboard.completedJobValue, 810)
    assert.equal(dashboard.awaitingReview, 1)
    assert.equal(dashboard.evidenceCompliance, 67)
    assert.equal(dashboard.hasPreviousPeriodData, true)
    assert.equal(dashboard.previous.completedJobValue, 800)
    assert.deepEqual(
      dashboard.rows.map((row) => [
        row.technicianName,
        row.jobsCompleted,
        row.openJobs,
        row.billedAmount,
        row.awaitingReview,
      ]),
      [
        ['Ali', 2, 0, 510, 1],
        ['John', 1, 0, 300, 0],
        ['Bala', 0, 1, 0, 0],
      ],
    )
    assert.equal(dashboard.rows[0].evidenceRate, 50)
    assert.equal(dashboard.rows[0].jobShare, 100)
    assert.equal(dashboard.rows[1].jobShare, 50)
    assert.deepEqual(
      dashboard.branches.map((branch) => [branch.branch, branch.jobsCompleted]),
      [
        ['Shah Alam', 2],
        ['Petaling Jaya', 1],
        ['Klang', 0],
      ],
    )
  })


  it('compares a selected day with the immediately previous day', () => {
    const dashboard = buildManagerKpiDashboard(
      [
        buildOrder({
          completedAt: '13 Aug 2026, 11:45 AM',
          finalAmount: 390,
          status: STATUS.JOB_DONE,
        }),
        buildOrder({
          completedAt: '12 Aug 2026, 5:05 PM',
          finalAmount: 120,
          status: STATUS.CLOSED,
        }),
      ],
      technicians,
      new Date('13 Aug 2026, 12:00 PM'),
      'day',
    )

    assert.equal(dashboard.periodType, 'day')
    assert.equal(dashboard.periodLabel, '13 Aug 2026')
    assert.equal(dashboard.previousPeriodLabel, '12 Aug 2026')
    assert.equal(dashboard.totalJobs, 1)
    assert.equal(dashboard.completedJobValue, 390)
    assert.equal(dashboard.previous.completedJobValue, 120)
    assert.equal(dashboard.hasPreviousPeriodData, true)
  })


  it('compares a selected monthly range with the previous same-length range', () => {
    const dashboard = buildManagerKpiDashboard(
      [
        buildOrder({
          completedAt: '31 Aug 2026, 11:45 AM',
          finalAmount: 390,
          status: STATUS.JOB_DONE,
        }),
        buildOrder({
          completedAt: '31 Jul 2026, 5:05 PM',
          finalAmount: 120,
          status: STATUS.CLOSED,
        }),
      ],
      technicians,
      new Date('1 Aug 2026, 12:00 PM'),
      'month',
      new Date('31 Aug 2026, 12:00 PM'),
    )

    assert.equal(dashboard.periodType, 'month')
    assert.equal(dashboard.periodLabel, '01 Aug 2026 - 31 Aug 2026')
    assert.equal(dashboard.previousPeriodLabel, '01 Jul 2026 - 31 Jul 2026')
    assert.equal(dashboard.totalJobs, 1)
    assert.equal(dashboard.completedJobValue, 390)
    assert.equal(dashboard.previous.completedJobValue, 120)
    assert.equal(dashboard.hasPreviousPeriodData, true)
  })


  it('compares a custom date range with the previous same-length range', () => {
    const dashboard = buildManagerKpiDashboard(
      [
        buildOrder({
          completedAt: '15 Aug 2026, 11:45 AM',
          finalAmount: 390,
          status: STATUS.JOB_DONE,
        }),
        buildOrder({
          completedAt: '5 Aug 2026, 5:05 PM',
          finalAmount: 120,
          status: STATUS.CLOSED,
        }),
      ],
      technicians,
      new Date('10 Aug 2026, 12:00 PM'),
      'range',
      new Date('20 Aug 2026, 12:00 PM'),
    )

    assert.equal(dashboard.periodType, 'range')
    assert.equal(dashboard.periodLabel, '10 Aug 2026 - 20 Aug 2026')
    assert.equal(dashboard.previousPeriodLabel, '30 Jul 2026 - 09 Aug 2026')
    assert.equal(dashboard.totalJobs, 1)
    assert.equal(dashboard.previous.completedJobValue, 120)
  })


  it('uses independently selected comparison dates for weekly ranges', () => {
    const dashboard = buildManagerKpiDashboard(
      [
        buildOrder({
          completedAt: '12 Aug 2026, 11:45 AM',
          finalAmount: 390,
          status: STATUS.JOB_DONE,
        }),
        buildOrder({
          completedAt: '5 Aug 2026, 5:05 PM',
          finalAmount: 120,
          status: STATUS.CLOSED,
        }),
      ],
      technicians,
      new Date('10 Aug 2026, 12:00 PM'),
      'week',
      new Date('16 Aug 2026, 12:00 PM'),
      new Date('3 Aug 2026, 12:00 PM'),
      new Date('9 Aug 2026, 12:00 PM'),
    )

    assert.equal(dashboard.periodLabel, '10 Aug 2026 - 16 Aug 2026')
    assert.equal(dashboard.previousPeriodLabel, '03 Aug 2026 - 09 Aug 2026')
    assert.equal(dashboard.completedJobValue, 390)
    assert.equal(dashboard.previous.completedJobValue, 120)
  })

  it('returns the current period with no completed jobs when only open work exists', () => {
    const dashboard = buildManagerKpiDashboard(
      [
        buildOrder({
          completedAt: null,
          finalAmount: null,
          status: STATUS.ASSIGNED,
        }),
      ],
      technicians,
      new Date('13 Aug 2026, 12:00 PM'),
    )

    assert.equal(dashboard.hasCompletedJobs, false)
    assert.equal(dashboard.totalJobs, 0)
    assert.deepEqual(dashboard.rows[0], {
      technicianId: 'ali',
      technicianName: 'Ali',
      branch: 'Shah Alam',
      jobsCompleted: 0,
      openJobs: 1,
      awaitingReview: 0,
      billedAmount: 0,
      evidenceCount: 0,
      evidenceRate: 0,
      jobShare: 0,
    })
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







