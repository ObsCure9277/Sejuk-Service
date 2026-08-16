import { STATUS } from './orderStatus.js'

export const ROLE = Object.freeze({
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  TECHNICIAN: 'Technician',
})

export function canReadOrderForProfile(profile, order) {
  if (!profile) return false
  if (profile.role === ROLE.ADMIN || profile.role === ROLE.MANAGER) return true

  return (
    profile.role === ROLE.TECHNICIAN &&
    order.assignedTechnicianId === profile.technicianId
  )
}

export function canCreateOrderForProfile(profile) {
  return profile?.role === ROLE.ADMIN
}

export function canCompleteOrderForProfile(profile, order) {
  return (
    profile?.role === ROLE.TECHNICIAN &&
    order.assignedTechnicianId === profile.technicianId &&
    (order.status === STATUS.ASSIGNED || order.status === STATUS.IN_PROGRESS)
  )
}

export function canReviewOrderForProfile(profile, order) {
  return profile?.role === ROLE.MANAGER && order.status === STATUS.JOB_DONE
}

export function canCloseOrderForProfile(profile, order) {
  return (
    profile?.role === ROLE.MANAGER &&
    (order.status === STATUS.JOB_DONE || order.status === STATUS.REVIEWED)
  )
}

export function getProfileTechnicianScope(profile) {
  return profile?.role === ROLE.TECHNICIAN ? profile.technicianId : null
}
