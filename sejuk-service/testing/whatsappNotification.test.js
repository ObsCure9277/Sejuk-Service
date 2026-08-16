import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildJobDoneWhatsAppNotification,
  normalizeWhatsAppPhone,
} from '../src/whatsappNotification.js'

describe('buildJobDoneWhatsAppNotification', () => {
  it('generates a wa.me deep link with required job completion details', () => {
    const notification = buildJobDoneWhatsAppNotification({
      completedAt: '13 Aug 2026, 2:30 PM',
      order: {
        id: 'ORDER1234',
        customerName: 'Ahmad',
        phone: '+6012 345 6789',
      },
      technicianName: 'Ali',
    })

    assert.equal(notification.channel, 'WhatsApp')
    assert.equal(notification.recipientName, 'Ahmad')
    assert.equal(notification.recipientPhone, '+6012 345 6789')
    assert.equal(notification.triggeredAt, '13 Aug 2026, 2:30 PM')
    assert.equal(notification.triggerStatus, 'Job Done')
    assert.match(notification.url, /^https:\/\/wa\.me\/60123456789\?text=/)
    assert.match(notification.message, /^Hi Ahmad,/)
    assert.match(notification.message, /Job ORDER1234/)
    assert.match(notification.message, /Technician Ali/)
    assert.match(notification.message, /13 Aug 2026, 2:30 PM/)
  })
})

describe('normalizeWhatsAppPhone', () => {
  it('normalizes Malaysian local mobile numbers for wa.me links', () => {
    assert.equal(normalizeWhatsAppPhone('012-345 6789'), '60123456789')
  })
})

