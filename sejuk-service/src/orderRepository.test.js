import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { STATUS } from './orderStatus.js'
import { createOrderRepository } from './orderRepository.js'

describe('createOrderRepository', () => {
  it('loads orders through the hybrid orders and order_history tables', async () => {
    const calls = []
    const repository = createOrderRepository({
      from(table) {
        calls.push(['from', table])

        if (table === 'orders') {
          return {
            select(columns) {
              calls.push(['orders.select', columns])
              return {
                order(column, options) {
                  calls.push(['orders.order', column, options])
                  return {
                    data: [
                      {
                        admin_notes: '',
                        assigned_technician_id: 'ali',
                        completed_at: null,
                        completion_extra_charges: 0,
                        completion_remarks: null,
                        completion_work_done: null,
                        customer_name: 'Ahmad',
                        evidence: [],
                        final_amount: null,
                        id: 'db-order-1',
                        order_number: 'ORDER1234',
                        payment_amount: null,
                        payment_method: null,
                        payment_received: false,
                        phone: '+6012 345 6789',
                        problem: 'Weak airflow',
                        quoted_price: 180,
                        receipt_file_name: null,
                        service_type: 'Aircond cleaning',
                        status: STATUS.ASSIGNED,
                      },
                    ],
                    error: null,
                  }
                },
              }
            },
          }
        }

        return {
          select(columns) {
            calls.push(['history.select', columns])
            return {
              in(column, values) {
                calls.push(['history.in', column, values])
                return {
                  order(columnName, options) {
                    calls.push(['history.order', columnName, options])
                    return {
                      data: [
                        {
                          action: 'Created order and assigned Ali',
                          actor_label: 'Admin',
                          occurred_at: '2026-08-13T01:00:00.000Z',
                          order_id: 'db-order-1',
                        },
                      ],
                      error: null,
                    }
                  },
                }
              },
            }
          },
        }
      },
    })

    const orders = await repository.listOrders()

    assert.equal(orders[0].id, 'ORDER1234')
    assert.equal(orders[0].databaseId, 'db-order-1')
    assert.deepEqual(orders[0].history, [
      {
        action: 'Created order and assigned Ali',
        actor: 'Admin',
        at: '13 Aug 2026, 9:00 am',
      },
    ])
    assert.deepEqual(calls, [
      ['from', 'orders'],
      ['orders.select', '*'],
      ['orders.order', 'order_number', { ascending: true }],
      ['from', 'order_history'],
      ['history.select', '*'],
      ['history.in', 'order_id', ['db-order-1']],
      ['history.order', 'occurred_at', { ascending: true }],
    ])
  })

  it('creates orders through the atomic create_order_with_history RPC', async () => {
    const rpcCalls = []
    const repository = createOrderRepository({
      rpc(name, params) {
        rpcCalls.push([name, params])
        return {
          data: { id: 'db-order-1', order_number: 'ORDER1261' },
          error: null,
        }
      },
    })

    assert.deepEqual(
      await repository.createOrder({
        assignedTechnicianName: 'Ali',
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
      }),
      { id: 'db-order-1', order_number: 'ORDER1261' },
    )
    assert.deepEqual(rpcCalls, [
      [
        'create_order_with_history',
        {
          p_action: 'Created order and assigned Ali',
          p_actor_label: 'Admin',
          p_address: '12 Jalan Sejuk',
          p_admin_notes: 'Bring ladder.',
          p_assigned_technician_id: 'ali',
          p_customer_name: 'Ahmad',
          p_phone: '012-345 6789',
          p_problem: 'Weak airflow',
          p_quoted_price: 180,
          p_service_type: 'Aircond cleaning',
        },
      ],
    ])
  })

  it('updates workflow state through role-specific atomic RPCs', async () => {
    const rpcCalls = []
    const repository = createOrderRepository({
      rpc(name, params) {
        rpcCalls.push([name, params])
        return {
          data: { id: 'db-order-1' },
          error: null,
        }
      },
    })

    await repository.completeOrder({
      form: {
        attachments: [{ name: 'before.jpg' }],
        extraCharges: '20',
        paymentAmount: '',
        paymentMethod: 'Cash',
        paymentReceived: false,
        receiptFile: null,
        remarks: 'Cooling restored.',
        workDone: 'Cleaned unit.',
      },
      order: { databaseId: 'db-order-1', quotedPrice: 180 },
      technicianName: 'Ali',
    })
    await repository.reviewOrder({ order: { databaseId: 'db-order-1' } })
    await repository.closeOrder({ order: { databaseId: 'db-order-1' } })

    assert.equal(rpcCalls[0][0], 'complete_order_with_history')
    assert.equal(rpcCalls[0][1].p_action, 'Marked job done with 1 attachments')
    assert.equal(rpcCalls[0][1].p_final_amount, 200)
    assert.deepEqual(rpcCalls.slice(1), [
      [
        'review_order_with_history',
        {
          p_action: 'Reviewed completion record',
          p_actor_label: 'Manager',
          p_order_id: 'db-order-1',
        },
      ],
      [
        'close_order_with_history',
        {
          p_action: 'Closed completed job',
          p_actor_label: 'Manager',
          p_order_id: 'db-order-1',
        },
      ],
    ])
  })
})
