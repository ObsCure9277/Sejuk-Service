import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { STATUS } from '../src/orderStatus.js'
import {
  buildJobDoneOrderNotification,
  canCloseOrder,
  canReviewOrder,
  closeOrder,
  completeOrder,
  previewFinalAmount,
  previewNextOrderId,
  createOrder,
  reviewOrder,
} from '../src/orderWorkflow.js'

const technicians = [{ id: 'ali', name: 'Ali' }]

const now = new Date('2026-08-13T06:30:00.000Z')

describe('order workflow', () => {
  it('creates assigned orders with generated IDs and traceable history', () => {
    const order = createOrder({
      form: {
        adminNotes: 'Bring ladder.',
        address: '12 Jalan Sejuk',
        assignedTechnicianId: 'ali',
        customerName: ' Ahmad ',
        phone: ' 012-345 6789 ',
        problem: ' Weak airflow ',
        quotedPrice: '180',
        serviceType: 'Aircond cleaning',
      },
      now,
      orders: [{ id: 'ORDER1234' }],
      technicians,
    })

    assert.equal(previewNextOrderId({ orders: [{ id: 'ORDER1234' }] }), 'ORDER1235')
    assert.equal(order.id, 'ORDER1235')
    assert.equal(order.status, STATUS.ASSIGNED)
    assert.equal(order.customerName, 'Ahmad')
    assert.equal(order.quotedPrice, 180)
    assert.deepEqual(order.history, [
      {
        actor: 'Admin',
        action: 'Created order and assigned Ali',
        at: '13 Aug 2026, 2:30 pm',
      },
    ])
  })

  it('completes a job with payment, evidence, final amount, notification, and history', () => {
    const { order, whatsAppNotification } = completeOrder({
      form: {
        attachments: [{ name: 'before.jpg' }, { name: 'after.jpg' }],
        extraCharges: '70',
        paymentAmount: '250',
        paymentMethod: 'Bank transfer',
        paymentReceived: true,
        receiptFile: { name: 'receipt.pdf' },
        remarks: 'Cooling restored.',
        workDone: 'Cleaned unit and replaced capacitor.',
      },
      now,
      order: buildOrder({ quotedPrice: 180 }),
      technicianName: 'Ali',
    })

    assert.equal(
      previewFinalAmount({
        form: { extraCharges: '70' },
        order: buildOrder({ quotedPrice: 180 }),
      }),
      250,
    )
    assert.equal(order.status, STATUS.JOB_DONE)
    assert.equal(order.finalAmount, 250)
    assert.equal(order.attachments, 2)
    assert.deepEqual(order.completion.attachments, ['before.jpg', 'after.jpg'])
    assert.deepEqual(order.payment, {
      amount: 250,
      method: 'Bank transfer',
      receiptFile: 'receipt.pdf',
      received: true,
    })
    assert.equal(order.whatsAppNotification, whatsAppNotification)
    assert.match(whatsAppNotification.url, /^https:\/\/wa\.me\//)
    assert.equal(order.history.at(-1).action, 'Marked job done with 2 attachments')
  })

  it('reviews only Job Done orders and closes only closable orders', () => {
    const reviewedOrder = reviewOrder({
      now,
      order: buildOrder({ status: STATUS.JOB_DONE }),
    })
    const closedOrder = closeOrder({ now, order: reviewedOrder })
    const unchangedOrder = closeOrder({
      now,
      order: buildOrder({ status: STATUS.ASSIGNED }),
    })

    assert.equal(reviewedOrder.status, STATUS.REVIEWED)
    assert.equal(canReviewOrder(buildOrder({ status: STATUS.JOB_DONE })), true)
    assert.equal(canReviewOrder(buildOrder({ status: STATUS.REVIEWED })), false)
    assert.equal(canCloseOrder(reviewedOrder), true)
    assert.equal(closedOrder.status, STATUS.CLOSED)
    assert.equal(closedOrder.history.at(-1).action, 'Closed completed job')
    assert.equal(unchangedOrder.status, STATUS.ASSIGNED)
    assert.equal(unchangedOrder.history.length, 1)
  })

  it('builds seeded Job Done notifications through the workflow module', () => {
    const notification = buildJobDoneOrderNotification({
      order: buildOrder({
        completedAt: '13 Aug 2026, 11:45 AM',
        status: STATUS.JOB_DONE,
      }),
      technicianName: 'Ali',
    })

    assert.equal(notification.triggerStatus, STATUS.JOB_DONE)
    assert.match(notification.message, /Job ORDER1234/)
    assert.match(notification.message, /Technician Ali/)
  })
})

function buildOrder(overrides = {}) {
  return {
    adminNotes: '',
    assignedTechnicianId: 'ali',
    attachments: 0,
    completedAt: null,
    completion: null,
    customerName: 'Ahmad',
    finalAmount: null,
    history: [
      {
        actor: 'Admin',
        action: 'Created order and assigned Ali',
        at: '13 Aug 2026, 9:00 AM',
      },
    ],
    id: 'ORDER1234',
    payment: null,
    phone: '+6012 345 6789',
    problem: 'Weak airflow',
    quotedPrice: 180,
    serviceType: 'Aircond cleaning',
    status: STATUS.ASSIGNED,
    whatsAppNotification: null,
    ...overrides,
  }
}

