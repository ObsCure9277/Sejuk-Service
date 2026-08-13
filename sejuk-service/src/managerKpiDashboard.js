import { isCompletedStatus, STATUS } from './orderStatus.js'

const WEEK_IN_DAYS = 7
const DAY_IN_MS = 24 * 60 * 60 * 1000

export function buildManagerKpiDashboard(orders, technicians) {
  const completedOrders = orders.filter((order) =>
    isCompletedStatus(order.status),
  )
  const datedOrders = completedOrders
    .map((order) => ({ ...order, completedDate: parseCompletedDate(order) }))
    .filter((order) => order.completedDate)
  const periodEnd = getLatestDate(datedOrders)

  if (!periodEnd) {
    return {
      periodLabel: 'No completed jobs yet',
      rows: [],
      totalBilled: 0,
      totalJobs: 0,
    }
  }

  const periodStart = new Date(periodEnd.getTime() - (WEEK_IN_DAYS - 1) * DAY_IN_MS)
  const weeklyOrders = datedOrders.filter(
    (order) => order.completedDate >= periodStart && order.completedDate <= periodEnd,
  )
  const rows = technicians
    .map((technician) => buildTechnicianRow(technician, weeklyOrders))
    .filter((row) => row.jobsCompleted > 0)
    .sort((left, right) =>
      right.awaitingReview - left.awaitingReview ||
        right.jobsCompleted - left.jobsCompleted ||
        right.billedAmount - left.billedAmount,
    )
  const highestJobCount = Math.max(...rows.map((row) => row.jobsCompleted), 0)

  return {
    periodLabel: `${formatDate(periodStart)} - ${formatDate(periodEnd)}`,
    rows: rows.map((row) => ({
      ...row,
      jobShare:
        highestJobCount > 0
          ? Math.round((row.jobsCompleted / highestJobCount) * 100)
          : 0,
    })),
    totalBilled: rows.reduce((total, row) => total + row.billedAmount, 0),
    totalJobs: rows.reduce((total, row) => total + row.jobsCompleted, 0),
  }
}

function buildTechnicianRow(technician, orders) {
  const technicianOrders = orders.filter(
    (order) => order.assignedTechnicianId === technician.id,
  )
  const billedAmount = technicianOrders.reduce(
    (total, order) => total + (order.finalAmount ?? order.quotedPrice),
    0,
  )
  const evidenceCount = technicianOrders.filter(
    (order) => (order.attachments ?? 0) > 0,
  ).length
  const awaitingReview = technicianOrders.filter(
    (order) => order.status === STATUS.JOB_DONE,
  ).length

  return {
    technicianId: technician.id,
    technicianName: technician.name,
    branch: technician.branch,
    jobsCompleted: technicianOrders.length,
    awaitingReview,
    billedAmount,
    evidenceCount,
    evidenceRate:
      technicianOrders.length > 0
        ? Math.round((evidenceCount / technicianOrders.length) * 100)
        : 0,
  }
}

function parseCompletedDate(order) {
  if (!order.completedAt) return null
  const parsedDate = new Date(order.completedAt)
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
}

function getLatestDate(orders) {
  return orders.reduce((latestDate, order) => {
    if (!latestDate || order.completedDate > latestDate) return order.completedDate
    return latestDate
  }, null)
}

function formatDate(date) {
  return new Intl.DateTimeFormat('en-MY', {
    day: '2-digit',
    month: 'short',
  }).format(date)
}
