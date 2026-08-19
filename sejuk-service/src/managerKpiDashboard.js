import { isCompletedStatus, STATUS } from './orderStatus.js'

const DAY_IN_MS = 24 * 60 * 60 * 1000

export function buildManagerKpiDashboard(
  orders,
  technicians,
  referenceDate = new Date(),
  periodType = 'week',
  rangeEndDate = null,
  comparisonStartDate = null,
  comparisonEndDate = null,
) {
  const datedCompletedOrders = orders
    .filter((order) => isCompletedStatus(order.status))
    .map((order) => ({ ...order, completedDate: parseCompletedDate(order) }))
    .filter((order) => order.completedDate)
  const currentPeriod = getPeriodBounds(referenceDate, periodType, rangeEndDate)
  const previousPeriod = comparisonStartDate && comparisonEndDate
    ? getDateRangeBounds(comparisonStartDate, comparisonEndDate)
    : getPreviousPeriodBounds(currentPeriod, periodType)
  const currentOrders = filterOrdersByPeriod(datedCompletedOrders, currentPeriod)
  const previousOrders = filterOrdersByPeriod(datedCompletedOrders, previousPeriod)
  const rows = technicians
    .map((technician) => buildTechnicianRow(technician, currentOrders, orders))
    .filter((row) => row.jobsCompleted > 0 || row.openJobs > 0)
    .sort(compareTechnicianRows)
  const highestJobCount = Math.max(...rows.map((row) => row.jobsCompleted), 0)
  const currentSummary = buildPeriodSummary(currentOrders)
  const previousSummary = buildPeriodSummary(previousOrders)

  return {
    periodType,
    periodLabel: formatPeriodLabel(currentPeriod, periodType),
    previousPeriodLabel: formatPeriodLabel(previousPeriod, periodType),
    hasCompletedJobs: currentOrders.length > 0,
    hasPreviousPeriodData: previousOrders.length > 0,
    rows: rows.map((row) => ({
      ...row,
      jobShare:
        highestJobCount > 0
          ? Math.round((row.jobsCompleted / highestJobCount) * 100)
          : 0,
    })),
    branches: buildBranchSummaries(currentOrders, technicians),
    totalBilled: currentSummary.completedJobValue,
    completedJobValue: currentSummary.completedJobValue,
    totalJobs: currentSummary.totalJobs,
    awaitingReview: currentSummary.awaitingReview,
    evidenceCount: currentSummary.evidenceCount,
    evidenceCompliance: currentSummary.evidenceCompliance,
    previous: previousSummary,
  }
}

function buildTechnicianRow(technician, periodOrders, allOrders) {
  const technicianOrders = periodOrders.filter(
    (order) => order.assignedTechnicianId === technician.id,
  )
  const openJobs = allOrders.filter(
    (order) =>
      order.assignedTechnicianId === technician.id && !isCompletedStatus(order.status),
  ).length
  const summary = buildPeriodSummary(technicianOrders)

  return {
    technicianId: technician.id,
    technicianName: technician.name,
    branch: technician.branch || 'Unassigned branch',
    jobsCompleted: summary.totalJobs,
    openJobs,
    awaitingReview: summary.awaitingReview,
    billedAmount: summary.completedJobValue,
    evidenceCount: summary.evidenceCount,
    evidenceRate: summary.evidenceCompliance,
  }
}

function buildPeriodSummary(orders) {
  const evidenceCount = orders.filter((order) => (order.attachments ?? 0) > 0).length
  const totalJobs = orders.length

  return {
    totalJobs,
    completedJobValue: orders.reduce(
      (total, order) => total + (order.finalAmount ?? order.quotedPrice ?? 0),
      0,
    ),
    awaitingReview: orders.filter((order) => order.status === STATUS.JOB_DONE).length,
    evidenceCount,
    evidenceCompliance:
      totalJobs > 0 ? Math.round((evidenceCount / totalJobs) * 100) : 0,
  }
}

function buildBranchSummaries(orders, technicians) {
  const technicianBranches = new Map(
    technicians.map((technician) => [technician.id, technician.branch || 'Unassigned branch']),
  )
  const summaries = new Map()

  orders.forEach((order) => {
    const branch = technicianBranches.get(order.assignedTechnicianId) || 'Unassigned branch'
    const current = summaries.get(branch) || {
      branch,
      completedJobValue: 0,
      evidenceCount: 0,
      jobsCompleted: 0,
    }
    current.completedJobValue += order.finalAmount ?? order.quotedPrice ?? 0
    current.evidenceCount += (order.attachments ?? 0) > 0 ? 1 : 0
    current.jobsCompleted += 1
    summaries.set(branch, current)
  })

  return [...summaries.values()]
    .map((summary) => ({
      ...summary,
      evidenceCompliance: Math.round((summary.evidenceCount / summary.jobsCompleted) * 100),
    }))
    .sort((left, right) => right.jobsCompleted - left.jobsCompleted)
}

function compareTechnicianRows(left, right) {
  return (
    right.awaitingReview - left.awaitingReview ||
    right.jobsCompleted - left.jobsCompleted ||
    right.billedAmount - left.billedAmount ||
    right.openJobs - left.openJobs
  )
}

function filterOrdersByPeriod(orders, period) {
  return orders.filter(
    (order) =>
      order.completedDate >= period.start && order.completedDate <= period.end,
  )
}

function getPeriodBounds(date, periodType, rangeEndDate) {
  if (rangeEndDate) return getDateRangeBounds(date, rangeEndDate)
  if (periodType === 'day') {
    const start = new Date(date)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }

  if (periodType === 'month' || periodType === 'range') {
    const start = new Date(date)
    start.setHours(0, 0, 0, 0)
    const end = new Date(rangeEndDate ?? date)
    end.setHours(23, 59, 59, 999)
    if (end < start) return { start, end: new Date(start.getTime() + DAY_IN_MS - 1) }
    return { start, end }
  }

  return getWeekBounds(date)
}

function getDateRangeBounds(startDate, endDate) {
  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)
  const end = new Date(endDate)
  end.setHours(23, 59, 59, 999)
  if (end < start) return { start, end: new Date(start.getTime() + DAY_IN_MS - 1) }
  return { start, end }
}
function getPreviousPeriodBounds(period, periodType) {
  if (periodType !== 'month' && periodType !== 'range') {
    return getPeriodBounds(new Date(period.start.getTime() - DAY_IN_MS), periodType)
  }

  const duration = period.end.getTime() - period.start.getTime()
  const end = new Date(period.start.getTime() - 1)
  const start = new Date(end.getTime() - duration)
  return { start, end }
}

function getWeekBounds(date) {
  const day = new Date(date)
  day.setHours(0, 0, 0, 0)
  const dayOfWeek = day.getDay()
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const start = new Date(day.getTime() - daysFromMonday * DAY_IN_MS)
  const end = new Date(start.getTime() + 6 * DAY_IN_MS)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

function formatPeriodLabel(period, periodType) {
  if (periodType === 'day') return formatDate(period.start)
  return `${formatDate(period.start)} - ${formatDate(period.end)}`
}

function parseCompletedDate(order) {
  if (!order.completedAt) return null
  const parsedDate = new Date(order.completedAt)
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
}

function formatDate(date) {
  return new Intl.DateTimeFormat('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}






