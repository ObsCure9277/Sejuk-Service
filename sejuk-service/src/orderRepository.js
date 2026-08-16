import {
  buildCompleteOrderUpdate,
  buildCreateOrderInsert,
  mapOrderRows,
} from './orderPersistence.js'

export function createOrderRepository(supabase) {
  return {
    async listOrders() {
      const { data: orderRows, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .order('order_number', { ascending: true })

      if (ordersError) throw ordersError

      const rows = orderRows ?? []
      if (rows.length === 0) return []

      const orderIds = rows.map((order) => order.id)
      const { data: historyRows, error: historyError } = await supabase
        .from('order_history')
        .select('*')
        .in('order_id', orderIds)
        .order('occurred_at', { ascending: true })

      if (historyError) throw historyError

      return mapOrderRows({
        historyRows: historyRows ?? [],
        orderRows: rows,
      })
    },

    async createOrder({ assignedTechnicianName, form }) {
      return callOrderRpc({
        name: 'create_order_with_history',
        params: buildCreateOrderRpcParams({
          action: `Created order and assigned ${assignedTechnicianName}`,
          actorLabel: 'Admin',
          form,
        }),
        supabase,
      })
    },

    async completeOrder({ form, order, technicianName }) {
      return callOrderRpc({
        name: 'complete_order_with_history',
        params: buildCompleteOrderRpcParams({
          action: `Marked job done with ${form.attachments.length} attachments`,
          actorLabel: technicianName,
          form,
          order,
        }),
        supabase,
      })
    },

    async reviewOrder({ order }) {
      return callOrderRpc({
        name: 'review_order_with_history',
        params: {
          p_action: 'Reviewed completion record',
          p_actor_label: 'Manager',
          p_order_id: order.databaseId,
        },
        supabase,
      })
    },

    async closeOrder({ order }) {
      return callOrderRpc({
        name: 'close_order_with_history',
        params: {
          p_action: 'Closed completed job',
          p_actor_label: 'Manager',
          p_order_id: order.databaseId,
        },
        supabase,
      })
    },
  }
}

function buildCreateOrderRpcParams({ action, actorLabel, form }) {
  const payload = buildCreateOrderInsert({ form, userId: null })

  return {
    p_action: action,
    p_actor_label: actorLabel,
    p_address: payload.address,
    p_admin_notes: payload.admin_notes,
    p_assigned_technician_id: payload.assigned_technician_id,
    p_customer_name: payload.customer_name,
    p_phone: payload.phone,
    p_problem: payload.problem,
    p_quoted_price: payload.quoted_price,
    p_service_type: payload.service_type,
  }
}

function buildCompleteOrderRpcParams({ action, actorLabel, form, order }) {
  const payload = buildCompleteOrderUpdate({ form, order, userId: null })

  return {
    p_action: action,
    p_actor_label: actorLabel,
    p_completed_at: payload.completed_at,
    p_completion_extra_charges: payload.completion_extra_charges,
    p_completion_remarks: payload.completion_remarks,
    p_completion_work_done: payload.completion_work_done,
    p_evidence: payload.evidence,
    p_final_amount: payload.final_amount,
    p_order_id: order.databaseId,
    p_payment_amount: payload.payment_amount,
    p_payment_method: payload.payment_method,
    p_payment_received: payload.payment_received,
    p_receipt_file_name: payload.receipt_file_name,
  }
}

async function callOrderRpc({ name, params, supabase }) {
  const { data, error } = await supabase.rpc(name, params)

  if (error) throw error

  return data
}
