import { OpenAPIHono } from '@hono/zod-openapi'
import { withRouteTryCatch } from '../../../utils/route-helpers.js'
import type { Env } from '../../../types/index.js'
import { assertCronSecret } from '../../../utils/cron-auth.js'
import { sendPromiseDueReminders } from '../../../services/promise-due-reminders.js'
import { markOverdueDebtsByDueDate } from '../../../services/overdue-debts.js'

const handler = new OpenAPIHono<Env>()

handler.post(
  '/mark-overdue',
  withRouteTryCatch('adminDebts.markOverdueByDueDate', async (c) => {
    const denied = assertCronSecret(c)
    if (denied) return denied

    const result = await markOverdueDebtsByDueDate(c.get('prisma'))
    return c.json({ data: result })
  }),
)

handler.post(
  '/send-promise-reminders',
  withRouteTryCatch('adminDebts.sendPromiseReminders', async (c) => {
    const denied = assertCronSecret(c)
    if (denied) return denied

    const result = await sendPromiseDueReminders(c.get('prisma'))
    return c.json({ data: result })
  }),
)

const routeModule = {
  path: '/api/v1/admin/debts',
  handler,
}

export default routeModule
