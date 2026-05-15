import { OpenAPIHono } from '@hono/zod-openapi'
import { withRouteTryCatch } from '../../../utils/route-helpers.js'
import { DebtsService } from '../../../services/debts.js'
import type { Env } from '../../../types/index.js'

const handler = new OpenAPIHono<Env>()

handler.post(
  '/mark-overdue',
  withRouteTryCatch('adminDebts.markOverdueByDueDate', async (c) => {
    const service = new DebtsService(c.get('prisma'))

    // Find debts past due date and not paid/already overdue, mark them overdue
    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)

    const debtsToUpdate = await c.get('prisma').debtRecord.findMany({
      where: {
        status: { notIn: ['PAID', 'OVERDUE_AFTER_PROMISE'] },
        dueDate: { lt: todayStart },
      },
      select: { id: true, clientId: true },
    })

    if (debtsToUpdate.length === 0) {
      return c.json({ data: { updated: 0 } })
    }

    const ids = debtsToUpdate.map((d) => d.id)

    const updated = await c.get('prisma').$transaction(async (tx) => {
      await tx.debtRecord.updateMany({ where: { id: { in: ids } }, data: { status: 'OVERDUE_AFTER_PROMISE' } })

      // create customerActionHistory entries for each
      const actions = debtsToUpdate.map((d) => ({
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

const routeModule = {
  path: '/api/v1/admin/debts',
  handler,
}

export default routeModule
