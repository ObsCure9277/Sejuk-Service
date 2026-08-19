import { isCompletedStatus } from './orderStatus.js'

const DAY_IN_MS = 24 * 60 * 60 * 1000
const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
]

export function answerOperationsQuery({ now = new Date(), orders, question, technicians }) {
  const normalizedQuestion = normalizeText(question)
  const completedOrders = orders
    .map((order) => ({ ...order, completedDate: parseCompletedDate(order) }))
    .filter((order) => isCompletedStatus(order.status) && order.completedDate)

  if (isTechnicianJobsQuery(normalizedQuestion)) {
    return answerTechnicianJobsQuery({
      completedOrders,
      normalizedQuestion,
      now,
      technicians,
    })
  }

  if (normalizedQuestion.includes('most jobs')) {
    return answerTopTechnicianQuery({
      completedOrders,
      normalizedQuestion,
      now,
      technicians,
    })
  }

  if (normalizedQuestion.includes('how many') && normalizedQuestion.includes('completed')) {
    return answerCompletedCountQuery({ completedOrders, now, normalizedQuestion })
  }

  return {
    title: 'Try a service operations question',
    summary:
      'Ask about completed jobs by technician, the top technician this week, or how many jobs were completed today.',
    items: [
      'What jobs did technician Ali complete last week?',
      'Which technician completed the most jobs this week?',
      'How many jobs were completed today?',
    ],
  }
}

function answerTechnicianJobsQuery({ completedOrders, normalizedQuestion, now, technicians }) {
  const technician = technicians.find((currentTechnician) =>
    normalizedQuestion.includes(normalizeText(currentTechnician.name)),
  )

  if (!technician) {
    return {
      title: 'Technician not found',
      summary: 'Ask with a technician name from the current technician list.',
      items: technicians.map((currentTechnician) => currentTechnician.name),
    }
  }

  const period = getRequestedPeriod(normalizedQuestion, now)
  const technicianOrders = completedOrders
    .filter((order) => order.assignedTechnicianId === technician.id)
    .filter((order) => isDateInPeriod(order.completedDate, period))
    .sort((left, right) => left.completedDate - right.completedDate)

  return {
    title: `${technician.name} completed ${technicianOrders.length} ${pluralize(
      'job',
      technicianOrders.length,
    )} ${period.label}`,
    summary:
      technicianOrders.length > 0
        ? sentenceJoin(
            technicianOrders.map((order) => `${order.id} for ${order.customerName}`),
          ) + '.'
        : `No completed jobs found for ${technician.name} ${period.label}.`,
    items: technicianOrders.map(
      (order) =>
        `${order.id} - ${order.customerName} - ${formatShortDate(order.completedDate)}`,
    ),
  }
}

function answerTopTechnicianQuery({ completedOrders, normalizedQuestion, now, technicians }) {
  const period = getRequestedPeriod(normalizedQuestion, now)
  const rankedTechnicians = technicians
    .map((technician) => ({
      ...technician,
      completedCount: completedOrders.filter(
        (order) =>
          order.assignedTechnicianId === technician.id &&
          isDateInPeriod(order.completedDate, period),
      ).length,
    }))
    .sort((left, right) => right.completedCount - left.completedCount)
  const leader = rankedTechnicians[0]

  if (!leader || leader.completedCount === 0) {
    return {
      title: `No jobs completed ${period.label}`,
      summary: `No completed jobs are recorded for ${period.label}.`,
      items: [],
    }
  }

  return {
    title: `${leader.name} completed the most jobs ${period.label}`,
    summary: `${leader.name} completed ${leader.completedCount} ${pluralize(
      'job',
      leader.completedCount,
    )} ${period.label}.`,
    items: rankedTechnicians.map(
      (technician) =>
        `${technician.name} - ${technician.completedCount} ${pluralize(
          'job',
          technician.completedCount,
        )}`,
    ),
  }
}

function answerCompletedCountQuery({ completedOrders, now, normalizedQuestion }) {
  const period = getRequestedPeriod(normalizedQuestion, now)
  const matchingOrders = completedOrders.filter((order) =>
    isDateInPeriod(order.completedDate, period),
  )

  return {
    title: `${matchingOrders.length} ${pluralize('job', matchingOrders.length)} completed ${
      period.label
    }`,
    summary: `${matchingOrders.length} completed ${pluralize(
      'job',
      matchingOrders.length,
    )} are recorded for ${period.displayDate}.`,
    items: matchingOrders.map(
      (order) =>
        `${order.id} - ${order.customerName} - ${formatShortDate(order.completedDate)}`,
    ),
  }
}

function isTechnicianJobsQuery(normalizedQuestion) {
  return (
    normalizedQuestion.includes('complete') &&
    normalizedQuestion.includes('what')
  )
}

function getRequestedPeriod(normalizedQuestion, now) {
  const customRange = parseCustomDateRange(normalizedQuestion, now)
  if (customRange) return customRange

  if (normalizedQuestion.includes('last week')) {
    const thisWeekStart = getWeekStart(now)
    const start = addDays(thisWeekStart, -7)
    const end = addDays(thisWeekStart, -1)

    return {
      displayDate: `${formatLongDate(start)} to ${formatLongDate(end)}`,
      end: endOfDay(end),
      label: 'last week',
      start,
    }
  }

  if (normalizedQuestion.includes('today')) {
    return {
      displayDate: formatLongDate(now),
      end: endOfDay(now),
      label: 'today',
      start: startOfDay(now),
    }
  }

  const start = getWeekStart(now)
  const end = addDays(start, 6)

  return {
    displayDate: `${formatLongDate(start)} to ${formatLongDate(end)}`,
    end: endOfDay(end),
    label: 'this week',
    start,
  }
}

function parseCustomDateRange(normalizedQuestion, now) {
  const match = normalizedQuestion.match(
    /between\s+(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:\s+(\d{4}))?\s+and\s+(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:\s+(\d{4}))?/i,
  )
  if (!match) return null

  const [, startDay, startMonth, startYear, endDay, endMonth, endYear] = match
  const start = parseQueryDate(startDay, startMonth, startYear ?? now.getFullYear())
  const end = parseQueryDate(endDay, endMonth, endYear ?? startYear ?? now.getFullYear())
  if (!start || !end || end < start) return null

  return {
    displayDate: `${formatLongDate(start)} to ${formatLongDate(end)}`,
    end: endOfDay(end),
    label: `between ${formatLongDate(start)} and ${formatLongDate(end)}`,
    start: startOfDay(start),
  }
}

function parseQueryDate(day, month, year) {
  const monthIndex = MONTHS.findIndex(
    (monthName) => monthName === month || (month.length >= 3 && monthName.startsWith(month)),
  )
  if (monthIndex < 0) return null

  const date = new Date(Number(year), monthIndex, Number(day))
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== Number(day)
  ) {
    return null
  }
  return date
}

function parseCompletedDate(order) {
  if (!order.completedAt) return null
  const parsedDate = new Date(order.completedAt)
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
}

function isDateInPeriod(date, period) {
  return date >= period.start && date <= period.end
}

function getWeekStart(date) {
  const start = startOfDay(date)
  const day = start.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  return addDays(start, mondayOffset)
}

function startOfDay(date) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  return start
}

function endOfDay(date) {
  const end = new Date(date)
  end.setHours(23, 59, 59, 999)
  return end
}

function addDays(date, dayCount) {
  return new Date(date.getTime() + dayCount * DAY_IN_MS)
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat('en-MY', {
    day: '2-digit',
    month: 'short',
  }).format(date)
}

function formatLongDate(date) {
  return new Intl.DateTimeFormat('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function normalizeText(value) {
  return value.trim().toLowerCase()
}

function pluralize(word, count) {
  return count === 1 ? word : `${word}s`
}

function sentenceJoin(parts) {
  if (parts.length <= 1) return parts.join('')
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`
}
