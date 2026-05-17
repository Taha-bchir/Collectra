import { serve } from '@hono/node-server'
import app from './app.js'
import { env } from './config/env.js'
import { getPrismaClient } from './lib/prisma.js'
import { sendPromiseDueReminders } from './services/promise-due-reminders.js'
import { markOverdueDebtsByDueDate } from './services/overdue-debts.js'
import { logger } from './utils/logger.js'

const port = Number.parseInt(env.PORT, 10)
const prisma = getPrismaClient()
const REMINDER_JOB_INTERVAL_MS = 60 * 60 * 1000

const runPromiseReminderJob = async () => {
  try {
    const result = await sendPromiseDueReminders(prisma)
    logger.info(
      {
        scope: 'promiseDueReminders.scheduler',
        daysBefore: result.daysBefore,
        candidateCount: result.candidateCount,
        sent: result.sent,
        failed: result.failed,
        skippedAlreadySent: result.skippedAlreadySent,
        skippedBrevo: result.skippedBrevo,
        skippedNoEmail: result.skippedNoEmail,
        skippedWrongDay: result.skippedWrongDay,
      },
      'Promise reminder job completed',
    )
  } catch (error) {
    logger.error({ error, scope: 'promiseDueReminders.scheduler' }, 'Promise reminder job failed')
  }
}

const runOverdueDebtJob = async () => {
  try {
    const result = await markOverdueDebtsByDueDate(prisma)
    logger.info(
      {
        scope: 'overdueDebts.scheduler',
        candidateCount: result.candidateCount,
        updated: result.updated,
        emailed: result.emailed,
        failed: result.failed,
        skippedBrevo: result.skippedBrevo,
        skippedNoEmail: result.skippedNoEmail,
      },
      'Overdue debt job completed',
    )
  } catch (error) {
    logger.error({ error, scope: 'overdueDebts.scheduler' }, 'Overdue debt job failed')
  }
}

void runPromiseReminderJob()
void runOverdueDebtJob()
setInterval(() => {
  void runPromiseReminderJob()
  void runOverdueDebtJob()
}, REMINDER_JOB_INTERVAL_MS)

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    logger.info(`Loaded env file: ${env.NODE_ENV}`)
    logger.info(`Server running on http://localhost:${info.port}`)
    logger.info(`Documentation available on http://localhost:${info.port}/docs`)
})
