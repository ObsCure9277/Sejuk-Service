import { STATUS } from './orderStatus.js'

export function mapOrderRows({ historyRows = [], orderRows = [] }) {
  const historyByOrderId = groupHistoryRows(historyRows)

  return orderRows.map((row) => {
    const evidence = Array.isArray(row.evidence) ? row.evidence : []
    const attachmentNames = evidence
      .map((item) => item?.name)
      .filter((name) => typeof name === 'string' && name.length > 0)

    return {
      adminNotes: row.admin_notes,
      assignedTechnicianId: row.assigned_technician_id,
      attachments: attachmentNames.length,
      completedAt: formatDatabaseTime(row.completed_at),
      completion: buildCompletion(row, attachmentNames),
      customerName: row.customer_name,
      databaseId: row.id,
      finalAmount: toNullableNumber(row.final_amount),
      history: (historyByOrderId.get(row.id) ?? []).map(mapHistoryRow),
      id: row.order_number,
      payment: buildPayment(row),
      phone: row.phone,
      problem: row.problem,
      quotedPrice: Number(row.quoted_price),
      serviceType: row.service_type,
      status: row.status,
      whatsAppNotification: null,
    }
  })
}

export function buildCreateOrderInsert({ form, userId }) {
  return {
    address: form.address.trim(),
    admin_notes: form.adminNotes.trim(),
    assigned_technician_id: form.assignedTechnicianId,
    created_by: userId,
    customer_name: form.customerName.trim(),
    phone: form.phone.trim(),
    problem: form.problem.trim(),
    quoted_price: Number(form.quotedPrice),
    service_type: form.serviceType,
    status: STATUS.ASSIGNED,
    updated_by: userId,
  }
}

export function buildCompleteOrderUpdate({ form, now = new Date(), order, userId }) {
  const extraCharges = Number(form.extraCharges || 0)
  const parsedExtraCharges = Number.isNaN(extraCharges) ? 0 : extraCharges
  const paymentReceived = Boolean(form.paymentReceived)

  return {
    completed_at: now.toISOString(),
    completion_extra_charges: parsedExtraCharges,
    completion_remarks: form.remarks.trim(),
    completion_work_done: form.workDone.trim(),
    evidence: form.attachments.map((file) => ({ name: file.name })),
    final_amount: Number(order.quotedPrice) + parsedExtraCharges,
    payment_amount: paymentReceived ? Number(form.paymentAmount) : 0,
    payment_method: paymentReceived ? form.paymentMethod : '',
    payment_received: paymentReceived,
    receipt_file_name: paymentReceived ? form.receiptFile?.name ?? '' : '',
    status: STATUS.JOB_DONE,
    updated_by: userId,
  }
}

export function buildReviewOrderUpdate({ userId }) {
  return {
    reviewed_by: userId,
    status: STATUS.REVIEWED,
    updated_by: userId,
  }
}

export function buildCloseOrderUpdate({ userId }) {
  return {
    closed_by: userId,
    status: STATUS.CLOSED,
    updated_by: userId,
  }
}

export function buildHistoryInsert({ action, actorLabel, orderId, userId }) {
  return {
    action,
    actor_label: actorLabel,
    actor_user_id: userId,
    order_id: orderId,
  }
}

function groupHistoryRows(historyRows) {
  const groups = new Map()

  for (const row of historyRows) {
    const existingRows = groups.get(row.order_id) ?? []
    groups.set(row.order_id, [...existingRows, row])
  }

  for (const [orderId, rows] of groups) {
    groups.set(
      orderId,
      rows.toSorted(
        (left, right) => new Date(left.occurred_at) - new Date(right.occurred_at),
      ),
    )
  }

  return groups
}

function buildCompletion(row, attachmentNames) {
  if (!row.completion_work_done && !row.completion_remarks && attachmentNames.length === 0) {
    return null
  }

  return {
    attachments: attachmentNames,
    extraCharges: Number(row.completion_extra_charges ?? 0),
    remarks: row.completion_remarks ?? '',
    workDone: row.completion_work_done ?? '',
  }
}

function buildPayment(row) {
  if (
    row.payment_received === null ||
    row.payment_received === undefined ||
    row.payment_amount === null
  ) {
    return null
  }

  return {
    amount: Number(row.payment_amount),
    method: row.payment_method ?? '',
    receiptFile: row.receipt_file_name ?? '',
    received: Boolean(row.payment_received),
  }
}

function mapHistoryRow(row) {
  return {
    action: row.action,
    actor: row.actor_label,
    at: formatDatabaseTime(row.occurred_at),
  }
}

function toNullableNumber(value) {
  return value === null || value === undefined ? null : Number(value)
}

function formatDatabaseTime(value) {
  if (!value) return null

  return new Intl.DateTimeFormat('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}
