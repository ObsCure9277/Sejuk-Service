import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { STATUS } from './orderStatus.js'
import {
  buildCloseOrderUpdate,
  buildCompleteOrderUpdate,
  buildCreateOrderInsert,
  buildHistoryInsert,
  buildReviewOrderUpdate,
  mapOrderRows,
} from './orderPersistence.js'

describe('mapOrderRows', () => {
  it('maps hybrid Supabase order and history rows into the app order shape', () => {
    const orders = mapOrderRows({
      historyRows: [
        {
          action: 'Assigned Bala',
          actor_label: 'Admin',
          occurred_at: '2026-08-11T08:30:00.000Z',
          order_id: 'db-order-1',
        },
        {
          action: 'Marked job done with 2 attachments',
          actor_label: 'Bala',
          occurred_at: '2026-08-13T03:45:00.000Z',
          order_id: 'db-order-1',
        },
      ],
      orderRows: [
        {
          address: 'Lot 8, Jalan Industri, Klang',
          admin_notes: 'Office closes at 6 PM.',
          assigned_technician_id: 'bala',
          completed_at: '2026-08-13T03:45:00.000Z',
          completion_extra_charges: 70,
          completion_remarks: 'Cooling improved after pressure test.',
          completion_work_done: 'Refilled refrigerant gas.',
          customer_name: 'Lim Trading',
          evidence: [{ name: 'pressure-reading.jpg' }, { name: 'outdoor-unit.jpg' }],
          final_amount: 390,
          id: 'db-order-1',
          order_number: 'ORDER1241',
          payment_amount: 390,
          payment_method: 'Bank transfer',
          payment_received: true,
          phone: '+603 7788 1200',
          problem: 'Office unit not cooling',
          quoted_price: 320,
          receipt_file_name: 'receipt-order1241.pdf',
          service_type: 'Gas refill',
          status: STATUS.JOB_DONE,
        },
      ],
    })

    assert.deepEqual(orders, [
      {
        adminNotes: 'Office closes at 6 PM.',
        assignedTechnicianId: 'bala',
        attachments: 2,
        completedAt: '13 Aug 2026, 11:45 am',
        completion: {
          attachments: ['pressure-reading.jpg', 'outdoor-unit.jpg'],
          extraCharges: 70,
          remarks: 'Cooling improved after pressure test.',
          workDone: 'Refilled refrigerant gas.',
        },
        customerName: 'Lim Trading',
        databaseId: 'db-order-1',
        finalAmount: 390,
        history: [
          {
            action: 'Assigned Bala',
            actor: 'Admin',
            at: '11 Aug 2026, 4:30 pm',
          },
          {
            action: 'Marked job done with 2 attachments',
            actor: 'Bala',
            at: '13 Aug 2026, 11:45 am',
          },
        ],
        id: 'ORDER1241',
        payment: {
          amount: 390,
          method: 'Bank transfer',
          receiptFile: 'receipt-order1241.pdf',
          received: true,
        },
        phone: '+603 7788 1200',
        problem: 'Office unit not cooling',
        quotedPrice: 320,
        serviceType: 'Gas refill',
        status: STATUS.JOB_DONE,
        whatsAppNotification: null,
      },
    ])
  })
})

describe('order persistence payloads', () => {
  it('builds an order insert without browser-generated order numbers', () => {
    assert.deepEqual(
      buildCreateOrderInsert({
        form: {
          address: '12 Jalan Sejuk',
          adminNotes: 'Bring ladder.',
          assignedTechnicianId: 'ali',
          customerName: ' Ahmad ',
          phone: ' 012-345 6789 ',
          problem: ' Weak airflow ',
          quotedPrice: '180',
          serviceType: 'Aircond cleaning',
        },
        userId: 'admin-user',
      }),
      {
        address: '12 Jalan Sejuk',
        admin_notes: 'Bring ladder.',
        assigned_technician_id: 'ali',
        created_by: 'admin-user',
        customer_name: 'Ahmad',
        phone: '012-345 6789',
        problem: 'Weak airflow',
        quoted_price: 180,
        service_type: 'Aircond cleaning',
        status: STATUS.ASSIGNED,
        updated_by: 'admin-user',
      },
    )
  })

  it('builds role-specific update payloads for workflow changes', () => {
    assert.deepEqual(
      buildCompleteOrderUpdate({
        form: {
          attachments: [{ name: 'before.jpg' }, { name: 'after.jpg' }],
          extraCharges: '70',
          paymentAmount: '250',
          paymentMethod: 'Bank transfer',
          paymentReceived: true,
          receiptFile: { name: 'receipt.pdf' },
          remarks: 'Cooling restored.',
          workDone: 'Cleaned unit.',
        },
        now: new Date('2026-08-13T06:30:00.000Z'),
        order: { quotedPrice: 180 },
        userId: 'tech-user',
      }),
      {
        completed_at: '2026-08-13T06:30:00.000Z',
        completion_extra_charges: 70,
        completion_remarks: 'Cooling restored.',
        completion_work_done: 'Cleaned unit.',
        evidence: [{ name: 'before.jpg' }, { name: 'after.jpg' }],
        final_amount: 250,
        payment_amount: 250,
        payment_method: 'Bank transfer',
        payment_received: true,
        receipt_file_name: 'receipt.pdf',
        status: STATUS.JOB_DONE,
        updated_by: 'tech-user',
      },
    )

    assert.deepEqual(buildReviewOrderUpdate({ userId: 'manager-user' }), {
      reviewed_by: 'manager-user',
      status: STATUS.REVIEWED,
      updated_by: 'manager-user',
    })
    assert.deepEqual(buildCloseOrderUpdate({ userId: 'manager-user' }), {
      closed_by: 'manager-user',
      status: STATUS.CLOSED,
      updated_by: 'manager-user',
    })
  })
  it('builds order history inserts for the audit table', () => {
    assert.deepEqual(
      buildHistoryInsert({
        action: 'Reviewed completion record',
        actorLabel: 'Manager',
        orderId: 'db-order-1',
        userId: 'manager-user',
      }),
      {
        action: 'Reviewed completion record',
        actor_label: 'Manager',
        actor_user_id: 'manager-user',
        order_id: 'db-order-1',
      },
    )
  })
})

