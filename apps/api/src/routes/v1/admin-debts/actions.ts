import { OpenAPIHono } from '@hono/zod-openapi'
import { withRouteTryCatch } from '../../../utils/route-helpers.js'
import type { Env } from '../../../types/index.js'
import { assertCronSecret } from '../../../utils/cron-auth.js'
import { sendPromiseDueReminders } from '../../../services/promise-due-reminders.js'
import { markOverdueDebtsByDueDate } from '../../../services/overdue-debts.js'

const handler = new OpenAPIHono<Env>()

const runMarkOverdueJob = withRouteTryCatch('adminDebts.markOverdueByDueDate', async (c) => {
  const denied = assertCronSecret(c)
  if (denied) return denied

  const result = await markOverdueDebtsByDueDate(c.get('prisma'))
  return c.json({ data: result })
})

const runPromiseReminderJob = withRouteTryCatch('adminDebts.sendPromiseReminders', async (c) => {
  const denied = assertCronSecret(c)
  if (denied) return denied

  const result = await sendPromiseDueReminders(c.get('prisma'))
  return c.json({ data: result })
})

handler.get('/mark-overdue', runMarkOverdueJob)
handler.post('/mark-overdue', runMarkOverdueJob)
handler.get('/send-promise-reminders', runPromiseReminderJob)
handler.post('/send-promise-reminders', runPromiseReminderJob)

const routeModule = {
  path: '/api/v1/admin/debts',
  handler,
}

export default routeModule
