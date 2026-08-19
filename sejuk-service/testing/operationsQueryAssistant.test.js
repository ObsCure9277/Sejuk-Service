import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { STATUS } from '../src/orderStatus.js'
import { answerOperationsQuery } from '../src/operationsQueryAssistant.js'

const technicians = [
  { id: 'ali', name: 'Ali', branch: 'Shah Alam' },
  { id: 'john', name: 'John', branch: 'Petaling Jaya' },
]

describe('answerOperationsQuery', () => {
  it('answers which jobs a named technician completed last week', () => {
    const answer = answerOperationsQuery({
      now: new Date('2026-08-14T12:00:00+08:00'),
      orders: [
        buildOrder({
          id: 'ORDER1001',
          customerName: 'Ahmad',
          assignedTechnicianId: 'ali',
          completedAt: '6 Aug 2026, 10:00 AM',
        }),
        buildOrder({
          id: 'ORDER1002',
          customerName: 'Lim Trading',
          assignedTechnicianId: 'ali',
          completedAt: '8 Aug 2026, 2:30 PM',
        }),
        buildOrder({
          id: 'ORDER1003',
          assignedTechnicianId: 'john',
          completedAt: '7 Aug 2026, 11:00 AM',
        }),
      ],
      question: 'What jobs did technician Ali complete last week?',
      technicians,
    })

    assert.equal(answer.title, 'Ali completed 2 jobs last week')
    assert.equal(answer.summary, 'ORDER1001 for Ahmad and ORDER1002 for Lim Trading.')
    assert.deepEqual(answer.items, [
      'ORDER1001 - Ahmad - 06 Aug',
      'ORDER1002 - Lim Trading - 08 Aug',
    ])
  })

  it('answers which technician completed the most jobs this week', () => {
    const answer = answerOperationsQuery({
      now: new Date('2026-08-14T12:00:00+08:00'),
      orders: [
        buildOrder({ assignedTechnicianId: 'ali', completedAt: '11 Aug 2026, 9:00 AM' }),
        buildOrder({ assignedTechnicianId: 'john', completedAt: '12 Aug 2026, 9:00 AM' }),
        buildOrder({ assignedTechnicianId: 'john', completedAt: '13 Aug 2026, 9:00 AM' }),
      ],
      question: 'Which technician completed the most jobs this week?',
      technicians,
    })

    assert.equal(answer.title, 'John completed the most jobs this week')
    assert.equal(answer.summary, 'John completed 2 jobs this week.')
  })

  it('accepts direct technician phrasing and applies the requested period to leader queries', () => {
    const answer = answerOperationsQuery({
      now: new Date('2026-08-14T12:00:00+08:00'),
      orders: [
        buildOrder({
          assignedTechnicianId: 'ali',
          completedAt: '5 Aug 2026, 9:00 AM',
        }),
        buildOrder({
          assignedTechnicianId: 'ali',
          completedAt: '6 Aug 2026, 9:00 AM',
        }),
        buildOrder({
          assignedTechnicianId: 'john',
          completedAt: '11 Aug 2026, 9:00 AM',
        }),
      ],
      question: 'Which technician completed the most jobs last week?',
      technicians,
    })

    assert.equal(answer.title, 'Ali completed the most jobs last week')
    assert.equal(answer.summary, 'Ali completed 2 jobs last week.')

    const technicianAnswer = answerOperationsQuery({
      now: new Date('2026-08-14T12:00:00+08:00'),
      orders: [
        buildOrder({
          id: 'ORDER1001',
          customerName: 'Ahmad',
          assignedTechnicianId: 'ali',
          completedAt: '6 Aug 2026, 10:00 AM',
        }),
      ],
      question: 'What jobs did Ali complete last week?',
      technicians,
    })

    assert.equal(technicianAnswer.title, 'Ali completed 1 job last week')
  })

  it('answers how many jobs were completed today', () => {
    const answer = answerOperationsQuery({
      now: new Date('2026-08-14T12:00:00+08:00'),
      orders: [
        buildOrder({ completedAt: '14 Aug 2026, 9:00 AM' }),
        buildOrder({ completedAt: '14 Aug 2026, 11:30 AM', status: STATUS.REVIEWED }),
        buildOrder({ completedAt: '13 Aug 2026, 5:00 PM' }),
      ],
      question: 'How many jobs were completed today?',
      technicians,
    })

    assert.equal(answer.title, '2 jobs completed today')
    assert.equal(answer.summary, '2 completed jobs are recorded for 14 Aug 2026.')
  })

  it('answers completed job counts for a custom date range', () => {
    const answer = answerOperationsQuery({
      now: new Date('2026-08-19T12:00:00+08:00'),
      orders: [
        buildOrder({ completedAt: '1 Aug 2026, 9:00 AM' }),
        buildOrder({ completedAt: '15 Aug 2026, 5:00 PM' }),
        buildOrder({ completedAt: '16 Aug 2026, 9:00 AM' }),
      ],
      question: 'How many jobs were completed between 1 August and 15 August?',
      technicians,
    })

    assert.equal(answer.title, '2 jobs completed between 01 Aug 2026 and 15 Aug 2026')
    assert.equal(answer.summary, '2 completed jobs are recorded for 01 Aug 2026 to 15 Aug 2026.')
  })

  it('applies a custom date range to technician queries with ordinal dates and explicit years', () => {
    const answer = answerOperationsQuery({
      now: new Date('2026-08-19T12:00:00+08:00'),
      orders: [
        buildOrder({
          id: 'ORDER1001',
          customerName: 'Ahmad',
          assignedTechnicianId: 'ali',
          completedAt: '5 Aug 2026, 10:00 AM',
        }),
        buildOrder({
          id: 'ORDER1002',
          assignedTechnicianId: 'ali',
          completedAt: '16 Aug 2026, 10:00 AM',
        }),
      ],
      question: 'What jobs did Ali complete between 1st August 2026 and 15th August 2026?',
      technicians,
    })

    assert.equal(answer.title, 'Ali completed 1 job between 01 Aug 2026 and 15 Aug 2026')
    assert.deepEqual(answer.items, ['ORDER1001 - Ahmad - 05 Aug'])
  })
})

function buildOrder(overrides = {}) {
  return {
    id: 'ORDER1000',
    customerName: 'Customer',
    assignedTechnicianId: 'ali',
    completedAt: '14 Aug 2026, 9:00 AM',
    status: STATUS.JOB_DONE,
    ...overrides,
  }
}
