export const STATUS = Object.freeze({
  NEW: 'New',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  JOB_DONE: 'Job Done',
  REVIEWED: 'Reviewed',
  CLOSED: 'Closed',
})

export const orderStatuses = Object.values(STATUS)

const completedStatuses = new Set([
  STATUS.JOB_DONE,
  STATUS.REVIEWED,
  STATUS.CLOSED,
])

const closableStatuses = new Set([
  STATUS.JOB_DONE,
  STATUS.REVIEWED,
])
export function isCompletedStatus(status) {
  return completedStatuses.has(status)
}

export function isClosableStatus(status) {
  return closableStatuses.has(status)
}
