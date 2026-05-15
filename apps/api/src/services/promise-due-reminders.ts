import type { PrismaClient } from '@repo/database'
import { env } from '../config/env.js'
import { signCustomerToken } from '../lib/customer-jwt.js'
import { utcCalendarDayStart } from '../utils/calendar.js'
import { logger } from '../utils/logger.js'
import { resolvePublicWebUrl } from '../utils/public-url.js'
import { BrevoEmailService } from './brevo-email.js'
import { logBrevoEvent } from './brevo-event-logs.js'

/** Whole calendar days from `fromDay` to `toDay` (UTC); e.g. tomorrow → 1 */
function calendarDaysUntil(fromDayStart: Date, toDayStart: Date): number {
  const ms = toDayStart.getTime() - fromDayStart.getTime()
  return Math.round(ms / (24 * 60 * 60 * 1000))
}

function getReminderDaysBefore(): number {
  const raw = env.PROMISE_REMINDER_DAYS_BEFORE
  if (raw === undefined) return 1
  return Math.min(Math.max(0, raw), 30)
}

export type SendPromiseDueRemindersResult = {
  daysBefore: number
  candidateCount: number
  sent: number
  skippedNoEmail: number
  skippedWrongDay: number
  skippedAlreadySent: number
  skippedBrevo: number
  failed: number
}

/**
 * Sends Brevo reminder emails to campaign clients whose payment promise date
 * is exactly N calendar days away (UTC), default N=1 (day before promise).
 *
 * Idempotent per debt via Debt.prePromiseDueReminderSentFor (UTC date of promise).
 */
export async function sendPromiseDueReminders(prisma: PrismaClient): Promise<SendPromiseDueRemindersResult> {
  const daysBefore = getReminderDaysBefore()
  const brevo = new BrevoEmailService()
  const brevoConfigured = brevo.isConfigured()

  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const todayCal = utcCalendarDayStart(todayStart)

  const targetPromiseDay = new Date(todayCal)
  targetPromiseDay.setUTCDate(targetPromiseDay.getUTCDate() + daysBefore)
  const targetPromiseEnd = new Date(targetPromiseDay)
  targetPromiseEnd.setUTCDate(targetPromiseEnd.getUTCDate() + 1)

  const debts = await prisma.debtRecord.findMany({
    where: {
      status: 'PROMISE_TO_PAY',
      promiseDate: {
        gte: targetPromiseDay,
        lt: targetPromiseEnd,
      },
      client: {
        email: { not: null },
      },
    },
    include: {
      client: true,
      campaign: true,
    },
  })

  let skippedNoEmail = 0
  let skippedWrongDay = 0
  let skippedAlreadySent = 0
  let skippedBrevo = 0
  let sent = 0
  let failed = 0

  for (const debt of debts) {
    const email = debt.client.email?.trim()
    if (!email) {
      skippedNoEmail += 1
      continue
    }

    if (!debt.promiseDate) {
      skippedWrongDay += 1
      continue
    }

    const promiseCal = utcCalendarDayStart(debt.promiseDate)
    const daysUntilPromise = calendarDaysUntil(todayCal, promiseCal)

    if (daysUntilPromise !== daysBefore) {
      skippedWrongDay += 1
      continue
    }

    if (
      debt.prePromiseDueReminderSentFor &&
      utcCalendarDayStart(debt.prePromiseDueReminderSentFor).getTime() === promiseCal.getTime()
    ) {
      skippedAlreadySent += 1
      continue
    }

    if (!brevoConfigured) {
      skippedBrevo += 1
      logger.warn({ debtId: debt.id }, 'Brevo not configured, skipping promise due reminder')
      continue
    }

    let debtPageUrl: string | null = null
    try {
      const { token } = await signCustomerToken(debt.id)
      const base = resolvePublicWebUrl()
      debtPageUrl = `${base}/client/view?token=${encodeURIComponent(token)}`
    } catch (error) {
      logger.warn({ debtId: debt.id, error, scope: 'promiseDueReminders.signCustomerToken' }, 'Could not sign customer token for reminder')
      debtPageUrl = null
    }

    const promiseDateLabel = debt.promiseDate.toISOString().slice(0, 10)
    const customerName = debt.client.fullName?.trim() || email.split('@')[0] || 'Customer'
    const amount = Number(debt.amount)

    const sendResult = await brevo.sendPromiseDueReminderEmail({
      toEmail: email,
      customerName,
      campaignName: debt.campaign.name,
      campaignId: debt.campaignId,
      debtId: debt.id,
      amount: Number.isFinite(amount) ? amount : 0,
      promiseDateLabel,
      debtPageUrl,
    })

    if (!sendResult.ok) {
      failed += 1
      continue
    }

    try {
      await prisma.debtRecord.update({
        where: { id: debt.id },
        data: { prePromiseDueReminderSentFor: promiseCal },
      })
    } catch (error) {
      logger.warn({ debtId: debt.id, error, scope: 'promiseDueReminders.persistFlag' }, 'Sent email but failed to persist reminder flag')
    }

    try {
      await prisma.customerActionHistory.create({
        data: {
          debtId: debt.id,
          customerId: debt.clientId,
          actionType: 'EMAIL_SENT',
          metadata: {
            channel: 'brevo',
            template: 'promise_due_reminder',
            promiseDate: promiseDateLabel,
            daysBefore,
          },
        },
      })
    } catch (error) {
      logger.warn({ debtId: debt.id, error, scope: 'promiseDueReminders.actionHistory' }, 'Failed to log customer action for reminder')
    }

    await logBrevoEvent(prisma, {
      provider: 'brevo',
      source: 'promise-due-reminder',
      eventName: 'transactional_sent',
      email,
      messageId: sendResult.messageId,
      debtId: debt.id,
      customerId: debt.clientId,
      campaignId: debt.campaignId,
      payload: { daysBefore, promiseDate: promiseDateLabel },
    })

    sent += 1
  }

  return {
    daysBefore,
    candidateCount: debts.length,
    sent,
    skippedNoEmail,
    skippedWrongDay,
    skippedAlreadySent,
    skippedBrevo,
    failed,
  }
}
