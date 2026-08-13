import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { STATUS } from './orderStatus.js'
import { getWorkflowAlerts } from './workflowSupervisor.js'

const technicians = [{ id: 'ali', name: 'Ali' }]

describe('getWorkflowAlerts', () => {
  it('flags completed jobs where final amount is much higher than quoted', () => {
    const alerts = getWorkflowAlerts(
      [
        {
          id: 'ORDER2001',
          assignedTechnicianId: 'ali',
          attachments: 2,
          customerName: 'Ahmad',
          finalAmount: 280,
          quotedPrice: 180,
          status: STATUS.JOB_DONE,
        },
      ],
      technicians,
    )

    assert.equal(alerts.length, 1)
    assert.equal(alerts[0].title, 'Final amount above quote')
    assert.equal(alerts[0].severity.label, 'High')
    assert.match(alerts[0].detail, /RM 280/)
  })

  it('flags job done records without supporting uploads', () => {
    const alerts = getWorkflowAlerts(
      [
        {
          id: 'ORDER2002',
          assignedTechnicianId: 'ali',
          attachments: 0,
          customerName: 'Siti',
          finalAmount: 180,
          quotedPrice: 180,
          status: STATUS.REVIEWED,
        },
      ],
      technicians,
    )

    assert.equal(alerts.length, 1)
    assert.equal(alerts[0].title, 'Completion evidence missing')
    assert.equal(alerts[0].severity.label, 'Medium')
    assert.match(alerts[0].detail, /without supporting uploads/)
  })

  it('ignores orders that are not completed yet', () => {
    const alerts = getWorkflowAlerts(
      [
        {
          id: 'ORDER2003',
          assignedTechnicianId: 'ali',
          attachments: 0,
          customerName: 'Lim',
          finalAmount: null,
          quotedPrice: 180,
          status: STATUS.ASSIGNED,
        },
      ],
      technicians,
    )

    assert.deepEqual(alerts, [])
  })
})
