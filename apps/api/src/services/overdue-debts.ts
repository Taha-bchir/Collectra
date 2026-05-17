import type { PrismaClient } from '@repo/database'
import { BrevoEmailService } from './brevo-email.js'
import { logBrevoEvent } from './brevo-event-logs.js'
import { logger } from '../utils/logger.js'
import { utcCalendarDayStart } from '../utils/calendar.js'

type OverdueDebtCandidate = {
  id: string
  clientId: string
  amount: { toNumber(): number }
  dueDate: Date
  status: 'IMPORTED' | 'UNPAID' | 'NOTIFIED' | 'PROMISE_TO_PAY' | 'PAID' | 'OVERDUE_AFTER_PROMISE'
  client: {
    fullName: string
    email: string | null
  }
  campaign: {
    id: string
    name: string
  }
}

export type MarkOverdueDebtsResult = {
  candidateCount: number
  updated: number
  emailed: number
  skippedNoEmail: number
  skippedBrevo: number
  failed: number
}

async function sendOverdueNoticeIfPossible(prisma: PrismaClient, debt: OverdueDebtCandidate) {
  const emailService = new BrevoEmailService()
  const amount = debt.amount.toNumber()
  const dueDateLabel = debt.dueDate.toISOString().split('T')[0] ?? debt.dueDate.toISOString()

  if (!debt.client.email) {
    return { ok: false as const, skippedNoEmail: true, skippedBrevo: false }
  }

  const result = await emailService.sendOverdueNoticeEmail({
    toEmail: debt.client.email,
    customerName: debt.client.fullName,
    campaignName: debt.campaign.name,
    campaignId: debt.campaign.id,
    debtId: debt.id,
    amount,
    dueDateLabel,
  })

  if (!result.ok) {
    return {
      ok: false as const,
      skippedNoEmail: false,
      skippedBrevo: !emailService.isConfigured(),
    }
  }

  try {
    await logBrevoEvent(prisma, {
      provider: 'brevo',
      source: 'overdue_notice',
      eventName: 'overdue_notice_sent',
      email: debt.client.email,
      debtId: debt.id,
      customerId: debt.clientId,
      campaignId: debt.campaign.id,
      payload: {
        debtId: debt.id,
        dueDate: debt.dueDate.toISOString(),
      },
    })
  } catch (error) {
    logger.warn(
      { debtId: debt.id, error, scope: 'overdue-debts.logBrevoEvent' },
      'Failed to persist Brevo event log for overdue notice',
    )
  }

  return { ok: true as const, skippedNoEmail: false, skippedBrevo: false }
}

export async function transitionDebtToOverdue(
  prisma: PrismaClient,
  debt: OverdueDebtCandidate,
): Promise<{ transitioned: boolean; emailed: boolean; skippedNoEmail: boolean; skippedBrevo: boolean }> {
  if (debt.status === 'PAID' || debt.status === 'OVERDUE_AFTER_PROMISE') {
    return { transitioned: false, emailed: false, skippedNoEmail: false, skippedBrevo: false }
  }

  const todayStart = utcCalendarDayStart(new Date())
  const dueDateStart = utcCalendarDayStart(debt.dueDate)

  if (todayStart.getTime() <= dueDateStart.getTime()) {
    return { transitioned: false, emailed: false, skippedNoEmail: false, skippedBrevo: false }
  }

  await prisma.$transaction(async (tx) => {
    await tx.debtRecord.update({
      where: { id: debt.id },
      data: { status: 'OVERDUE_AFTER_PROMISE' },
    })

    await tx.customerActionHistory.create({
      data: {
        debtId: debt.id,
        customerId: debt.clientId,
        actionType: 'STATUS_CHANGED',
        metadata: {
          reason: 'due_date_passed',
          newStatus: 'OVERDUE_AFTER_PROMISE',
        },
      },
    })
  })

  const emailResult = await sendOverdueNoticeIfPossible(prisma, debt)

  return {
    transitioned: true,
    emailed: emailResult.ok,
    skippedNoEmail: emailResult.skippedNoEmail,
    skippedBrevo: emailResult.skippedBrevo,
  }
}

export async function markOverdueDebtsByDueDate(prisma: PrismaClient): Promise<MarkOverdueDebtsResult> {
  const todayStart = utcCalendarDayStart(new Date())

  const debts = await prisma.debtRecord.findMany({
    where: {
      status: { notIn: ['PAID', 'OVERDUE_AFTER_PROMISE'] },
      dueDate: { lt: todayStart },
    },
    select: {
      id: true,
      clientId: true,
      amount: true,
      dueDate: true,
      status: true,
      client: {
        select: {
          fullName: true,
          email: true,
        },
      },
      campaign: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { dueDate: 'asc' },
  })

  let updated = 0
  let emailed = 0
  let skippedNoEmail = 0
  let skippedBrevo = 0
  let failed = 0

  for (const debt of debts as OverdueDebtCandidate[]) {
    try {
      const result = await transitionDebtToOverdue(prisma, debt)
      if (result.transitioned) {
        updated += 1
      }
      if (result.emailed) {
        emailed += 1
      }
      if (result.skippedNoEmail) {
        skippedNoEmail += 1
      }
      if (result.skippedBrevo) {
        skippedBrevo += 1
      }
    } catch (error) {
      failed += 1
      logger.error(
        { debtId: debt.id, error, scope: 'overdue-debts.markOverdueDebtsByDueDate' },
        'Failed to transition debt to overdue',
      )
    }
  }

  return {
    candidateCount: debts.length,
    updated,
    emailed,
    skippedNoEmail,
    skippedBrevo,
    failed,
  }
}
