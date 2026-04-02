import { OpenAPIHono } from '@hono/zod-openapi'

import {
  createPublicFakePaymentByTokenSchema,
  createPublicPromiseByTokenSchema,
  getPublicDebtByTokenSchema,
} from '../../../schema/v1/index.js'
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
        promiseDate: debt.promiseDate ? debt.promiseDate.toISOString() : null,
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

handler.openapi(
  createPublicPromiseByTokenSchema,
  withRouteTryCatch('publicDebts.createPromiseByToken', async (c) => {
    const { token } = c.req.valid('param')
    const payload = c.req.valid('json')

    const service = new DebtsService(c.get('prisma'))
    const updatedDebt = await service.createPromiseByCustomerToken(token, new Date(payload.promisedDate))

    return c.json(
      {
        data: {
          debtId: updatedDebt.id,
          status: updatedDebt.status,
          promiseDate: updatedDebt.promiseDate?.toISOString() ?? payload.promisedDate,
        },
      },
      201,
    )
  })
)

handler.openapi(
  createPublicFakePaymentByTokenSchema,
  withRouteTryCatch('publicDebts.fakePaymentByToken', async (c) => {
    const { token } = c.req.valid('param')

    const service = new DebtsService(c.get('prisma'))
    const updatedDebt = await service.confirmFakePaymentByCustomerToken(token)

    return c.json({
      data: {
        debtId: updatedDebt.id,
        status: updatedDebt.status,
      },
    })
  })
)

const routeModule = {
  path: '/api/v1/public/debts',
  handler,
}

export default routeModule
