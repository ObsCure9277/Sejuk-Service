import { STATUS } from './orderStatus.js'
import { buildJobDoneWhatsAppNotification } from './whatsappNotification.js'

export function createOrder({ form, now = new Date(), orders, technicians = [] }) {
  return {
    id: generateOrderId(orders),
    customerName: form.customerName.trim(),
    phone: form.phone.trim(),
    address: form.address.trim(),
    serviceType: form.serviceType,
    problem: form.problem.trim(),
    quotedPrice: Number(form.quotedPrice),
    finalAmount: null,
    completion: null,
    payment: null,
    whatsAppNotification: null,
    assignedTechnicianId: form.assignedTechnicianId,
    adminNotes: form.adminNotes.trim(),
    status: STATUS.ASSIGNED,
    attachments: 0,
    completedAt: null,
    history: [
      {
        actor: 'Admin',
        action: `Created order and assigned ${getTechnicianName(form.assignedTechnicianId, technicians)}`,
        at: formatActionTime(now),
      },
    ],
  }
}

export function completeOrder({
  form,
  now = new Date(),
  order,
  technicianName,
}) {
  const completedAt = formatActionTime(now)
  const completedOrder = {
    ...order,
    status: STATUS.JOB_DONE,
    finalAmount: calculateFinalAmount(order.quotedPrice, form.extraCharges),
    attachments: form.attachments.length,
    completedAt,
    completion: {
      workDone: form.workDone.trim(),
      extraCharges: Number(form.extraCharges || 0),
      remarks: form.remarks.trim(),
      attachments: form.attachments.map((file) => file.name),
    },
    payment: form.paymentReceived
      ? {
          received: true,
          amount: Number(form.paymentAmount),
          method: form.paymentMethod,
          receiptFile: form.receiptFile?.name ?? '',
        }
      : { received: false, amount: 0, method: '', receiptFile: '' },
  }
  const whatsAppNotification = buildJobDoneWhatsAppNotification({
    completedAt,
    order: completedOrder,
    technicianName,
  })

  return {
    order: recordAction(
      {
        ...completedOrder,
        whatsAppNotification,
      },
      technicianName,
      `Marked job done with ${form.attachments.length} attachments`,
      now,
    ),
    whatsAppNotification,
  }
}

export function reviewOrder({ now = new Date(), order }) {
  if (!canReviewOrder(order)) return order

  return recordAction(
    {
      ...order,
      status: STATUS.REVIEWED,
    },
    'Manager',
    'Reviewed completion record',
    now,
  )
}

export function closeOrder({ now = new Date(), order }) {
  if (!canCloseOrder(order)) return order

  return recordAction(
    {
      ...order,
      status: STATUS.CLOSED,
    },
    'Manager',
    'Closed completed job',
    now,
  )
}

export function previewNextOrderId({ orders }) {
  return generateOrderId(orders)
}

export function previewFinalAmount({ form, order }) {
  return calculateFinalAmount(order.quotedPrice, form.extraCharges)
}

const closableStatuses = new Set([
  STATUS.JOB_DONE,
  STATUS.REVIEWED,
])

export function canReviewOrder(order) {
  return order.status === STATUS.JOB_DONE
}

export function canCloseOrder(order) {
  return closableStatuses.has(order.status)
}

export function buildJobDoneOrderNotification({ order, technicianName }) {
  return buildJobDoneWhatsAppNotification({
    completedAt: order.completedAt,
    order,
    technicianName,
  })
}

function calculateFinalAmount(quotedPrice, extraCharges) {
  const parsedExtraCharges = Number(extraCharges || 0)
  return quotedPrice + (Number.isNaN(parsedExtraCharges) ? 0 : parsedExtraCharges)
}

function generateOrderId(orders) {
  const highestNumber = orders.reduce((highest, order) => {
    const orderNumber = Number(order.id.replace('ORDER', ''))
    return Number.isNaN(orderNumber) ? highest : Math.max(highest, orderNumber)
  }, 1200)

  return `ORDER${highestNumber + 1}`
}

function formatActionTime(date = new Date()) {
  return new Intl.DateTimeFormat('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function recordAction(order, actor, action, now) {
  return {
    ...order,
    history: [
      ...order.history,
      {
        actor,
        action,
        at: formatActionTime(now),
      },
    ],
  }
}

function getTechnicianName(technicianId, technicians) {
  return (
    technicians.find((technician) => technician.id === technicianId)?.name ??
    'Unassigned'
  )
}
