import { OpenAPIHono } from '@hono/zod-openapi'
import { withRouteTryCatch } from '../../../utils/route-helpers.js'
import type { Env } from '../../../types/index.js'
import { assertCronSecret } from '../../../utils/cron-auth.js'
import { sendPromiseDueReminders } from '../../../services/promise-due-reminders.js'

const handler = new OpenAPIHono<Env>()

handler.post(
  '/mark-overdue',
  withRouteTryCatch('adminDebts.markOverdueByDueDate', async (c) => {
    const denied = assertCronSecret(c)
    if (denied) return denied

    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)

    const debtsToUpdate = await c.get('prisma').debtRecord.findMany({
      where: {
        status: { notIn: ['PAID', 'OVERDUE_AFTER_PROMISE'] },
        OR: [
          { dueDate: { lt: todayStart } },
          {
            status: 'PROMISE_TO_PAY',
            promiseDate: { lt: todayStart },
          },
        ],
      },
      select: { id: true, clientId: true },
    })

    if (debtsToUpdate.length === 0) {
      return c.json({ data: { updated: 0 } })
    }

    const ids = debtsToUpdate.map((d: { id: string }) => d.id)

    const updated = await c.get('prisma').$transaction(async (tx: any) => {
      await tx.debtRecord.updateMany({ where: { id: { in: ids } }, data: { status: 'OVERDUE_AFTER_PROMISE' } })

      // create customerActionHistory entries for each
      const actions = debtsToUpdate.map((d: { id: string; clientId: string }) => ({
        debtId: d.id,
        customerId: d.clientId,
        actionType: 'STATUS_CHANGED',
        metadata: { reason: 'due_date_passed', newStatus: 'OVERDUE_AFTER_PROMISE' },
      }))

      await tx.customerActionHistory.createMany({ data: actions })

      return ids.length
    })

    return c.json({ data: { updated: updated } })
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
