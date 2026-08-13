import { isCompletedStatus } from './orderStatus.js'

const FINAL_AMOUNT_OVER_QUOTE_THRESHOLD = 0.3

export const ALERT_SEVERITY = Object.freeze({
  HIGH: { id: 'high', label: 'High' },
  MEDIUM: { id: 'medium', label: 'Medium' },
})


export function getWorkflowAlerts(orders, technicians) {
  return orders
    .filter((order) => isCompletedStatus(order.status))
    .flatMap((order) => buildOrderAlerts(order, technicians))
}

function buildOrderAlerts(order, technicians) {
  const technicianName = getTechnicianName(order.assignedTechnicianId, technicians)
  const alerts = []

  if (isFinalAmountHigh(order)) {
    alerts.push({
      id: `${order.id}-amount`,
      severity: ALERT_SEVERITY.HIGH,
      title: 'Final amount above quote',
      orderId: order.id,
      technicianName,
      detail: `${order.customerName} final amount is RM ${order.finalAmount}, above the RM ${order.quotedPrice} quote.`,
    })
  }

  if ((order.attachments ?? 0) === 0) {
    alerts.push({
      id: `${order.id}-evidence`,
      severity: ALERT_SEVERITY.MEDIUM,
      title: 'Completion evidence missing',
      orderId: order.id,
      technicianName,
      detail: `${order.customerName} is marked ${order.status} without supporting uploads.`,
    })
  }

  return alerts
}

function isFinalAmountHigh(order) {
  if (order.finalAmount == null || order.quotedPrice <= 0) return false
  return order.finalAmount > order.quotedPrice * (1 + FINAL_AMOUNT_OVER_QUOTE_THRESHOLD)
}

function getTechnicianName(technicianId, technicians) {
  return (
    technicians.find((technician) => technician.id === technicianId)?.name ??
    'Unassigned'
  )
}
