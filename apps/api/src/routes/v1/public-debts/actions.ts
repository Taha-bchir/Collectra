import { OpenAPIHono } from '@hono/zod-openapi'

import { getPublicDebtByTokenSchema } from '../../../schema/v1/index.js'
import { DebtsService } from '../../../services/debts.js'
import type { Env } from '../../../types/index.js'
import { withRouteTryCatch } from '../../../utils/route-helpers.js'

const handler = new OpenAPIHono<Env>()

handler.openapi(
  getPublicDebtByTokenSchema,
  withRouteTryCatch('publicDebts.getByToken', async (c) => {
    const { token } = c.req.valid('param')

    const service = new DebtsService(c.get('prisma'))
    const { debt, tokenExpiresAt } = await service.getByCustomerToken(token)

    return c.json({
      data: {
        debtId: debt.id,
        amount: debt.amount.toNumber(),
        dueDate: debt.dueDate.toISOString(),
        status: debt.status,
        campaignName: debt.campaign.name,
        tokenExpiresAt: tokenExpiresAt.toISOString(),
        customer: {
          fullName: debt.client.fullName,
          email: debt.client.email,
          phone: debt.client.phone,
        },
      },
    })
  })
)

const routeModule = {
  path: '/api/v1/public/debts',
  handler,
}

export default routeModule
