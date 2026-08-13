import { STATUS } from './orderStatus.js'

const MALAYSIA_WHATSAPP_COUNTRY_CODE = '60'

export function normalizeWhatsAppPhone(phone) {
  const digits = String(phone).replace(/[^\d]/g, '')

  if (!digits) return ''
  if (digits.startsWith(MALAYSIA_WHATSAPP_COUNTRY_CODE)) return digits
  if (digits.startsWith('0')) {
    return `${MALAYSIA_WHATSAPP_COUNTRY_CODE}${digits.slice(1)}`
  }

  return digits
}

export function buildJobDoneWhatsAppNotification({
  completedAt,
  order,
  technicianName,
}) {
  const phoneNumber = normalizeWhatsAppPhone(order.phone)
  const message = [
    `Hi ${order.customerName},`,
    `Customer: ${order.customerName}.`,
    `Job ${order.id} has been completed by Technician ${technicianName} at ${completedAt}.`,
    'Please check and leave feedback.',
    'Thank you!',
  ].join('\n')

  return {
    channel: 'WhatsApp',
    recipientName: order.customerName,
    recipientPhone: order.phone,
    message,
    url: `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`,
    triggeredAt: completedAt,
    triggerStatus: STATUS.JOB_DONE,
  }
}
