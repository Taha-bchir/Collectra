import { OpenAPIHono } from '@hono/zod-openapi'
import { env } from '../../../config/env.js'

import {
  createPublicFakePaymentByTokenSchema,
  createPublicTrackClickByTokenSchema,
  createPublicTrackOpenByTokenSchema,
  createPublicPromiseByTokenSchema,
  getPublicDebtByTokenSchema,
  trackPublicEmailOpenSchema,
} from '../../../schema/v1/index.js'
import { toPrismaMetadata } from '../../../utils/metadata.js'
import { DebtsService } from '../../../services/debts.js'
import type { Env } from '../../../types/index.js'
import { withRouteTryCatch } from '../../../utils/route-helpers.js'
import { logger } from '../../../utils/logger.js'

const handler = new OpenAPIHono<Env>()
const TRANSPARENT_GIF_BASE64 =
  'R0lGODlhAQABAPAAAAAAAP///yH5BAAAAAAALAAAAAABAAEAAAICRAEAOw=='

handler.openapi(
  getPublicDebtByTokenSchema,
  withRouteTryCatch('publicDebts.getByToken', async (c) => {
    const { token } = c.req.valid('param')
    const shouldTrackOpen = c.req.query('track') === '1'

    const service = new DebtsService(c.get('prisma'))
    const { debt, tokenExpiresAt } = await service.getByCustomerToken(token)

    if (shouldTrackOpen) {
      try {
        await c.get('prisma').customerActionHistory.create({
          data: {
            debtId: debt.id,
            customerId: debt.clientId,
            actionType: 'LINK_CLICKED',
            metadata: toPrismaMetadata({
              channel: 'public_link',
              event: 'link_clicked',
              source: 'public-debts.getByToken.track',
            }),
          },
        })
      } catch (error) {
        logger.warn({ debtId: debt.id, error, scope: 'publicDebts.getByToken.track' }, 'Failed to track link open')
      }
    }

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
  createPublicTrackClickByTokenSchema,
  withRouteTryCatch('publicDebts.trackClickByToken', async (c) => {
    const { token } = c.req.valid('param')

    const service = new DebtsService(c.get('prisma'))
    await service.recordLinkClickByCustomerToken(token)

    return c.redirect(`${env.WEB_URL}/client/view?token=${encodeURIComponent(token)}`, 302)
  })
)

handler.openapi(
  createPublicTrackOpenByTokenSchema,
  withRouteTryCatch('publicDebts.trackOpenByToken', async (c) => {
    const { token } = c.req.valid('param')

    const service = new DebtsService(c.get('prisma'))
    const tracking = await service.recordLinkOpenByCustomerToken(token)

    return c.json(
      {
        data: {
          debtId: tracking.debtId,
          tracked: true,
        },
      },
      201,
    )
  })
)

handler.openapi(
  trackPublicEmailOpenSchema,
  withRouteTryCatch('publicDebts.emailOpenPixel', async (c) => {
    const { debtId } = c.req.valid('param')

    const service = new DebtsService(c.get('prisma'))
    await service.recordEmailOpenByDebtId(debtId)

    const body = Uint8Array.from(atob(TRANSPARENT_GIF_BASE64), (char) => char.charCodeAt(0))

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
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
