import { OpenAPIHono } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'
import { env } from '../../../config/env.js'

import {
  createPublicFakePaymentByTokenSchema,
  createPublicStripeCheckoutSessionByTokenSchema,
  createPublicTrackClickByTokenSchema,
  createPublicTrackOpenByTokenSchema,
  createPublicPromiseByTokenSchema,
  createPublicInvoiceByTokenSchema,
  getPublicDebtByTokenSchema,
  trackPublicEmailOpenSchema,
  verifyStripePaymentByTokenSchema,
} from '../../../schema/v1/index.js'
import { toPrismaMetadata } from '../../../utils/metadata.js'
import { DebtsService, createOrReuseStripeInvoiceForDebt } from '../../../services/debts.js'
import type { Env } from '../../../types/index.js'
import { withRouteTryCatch } from '../../../utils/route-helpers.js'
import { logger } from '../../../utils/logger.js'
import { getStripeClient } from '../../../lib/stripe.js'

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
        currency: debt.currency,
        dueDate: debt.dueDate.toISOString(),
        promiseDate: debt.promiseDate ? debt.promiseDate.toISOString() : null,
        status: debt.status,
        campaignName: debt.campaign.name,
        workspaceName: debt.campaign.workspace?.name ?? null,
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

    return c.redirect(`${resolvePublicWebUrl()}/client/view?token=${encodeURIComponent(token)}`, 302)
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

    return c.body(body, 200, {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    })
  })
)

handler.openapi(
  createPublicPromiseByTokenSchema,
  withRouteTryCatch('publicDebts.createPromiseByToken', async (c) => {
    const { token } = c.req.valid('param')
    const payload = c.req.valid('json')

    const service = new DebtsService(c.get('prisma'))
    const updatedDebt = await service.createPromiseByCustomerToken(token, payload.promisedDate)

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
  createPublicStripeCheckoutSessionByTokenSchema,
  withRouteTryCatch('publicDebts.createStripeCheckoutSessionByToken', async (c) => {
    const { token } = c.req.valid('param')

    const service = new DebtsService(c.get('prisma'))
    const session = await service.createStripeCheckoutSessionByCustomerToken(token)

    return c.json(
      {
        data: {
          sessionId: session.sessionId,
          checkoutUrl: session.checkoutUrl,
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

handler.openapi(
  createPublicInvoiceByTokenSchema,
  withRouteTryCatch('publicDebts.getInvoiceByToken', async (c) => {
    const { token } = c.req.valid('param')
    const service = new DebtsService(c.get('prisma'))
    const { debt } = await service.getByCustomerToken(token)

    if (debt.status !== 'PAID') {
      throw new HTTPException(400, {
        message: 'Invoice is only available after payment confirmation',
      })
    }

    const paymentConfirmation = await c.get('prisma').customerActionHistory.findFirst({
      where: {
        debtId: debt.id,
        actionType: 'PAYMENT_CONFIRMED',
      },
      orderBy: { timestamp: 'desc' },
      select: { metadata: true },
    })

    const storedInvoice = paymentConfirmation?.metadata as
      | {
          stripe?: {
            invoice?: {
              hostedInvoiceUrl?: string | null
              invoicePdfUrl?: string | null
              invoiceId?: string | null
            } | null
          } | null
        }
      | null

    const invoiceUrl =
      storedInvoice?.stripe?.invoice?.hostedInvoiceUrl ?? storedInvoice?.stripe?.invoice?.invoicePdfUrl ?? null

    if (invoiceUrl) {
      c.header('Cache-Control', 'no-store')
      return c.redirect(invoiceUrl, 302)
    }

    if (!invoiceUrl) {
      try {
        const stripeInvoice = await createOrReuseStripeInvoiceForDebt(debt)
        const fallbackInvoiceUrl = stripeInvoice?.hostedInvoiceUrl ?? stripeInvoice?.invoicePdfUrl ?? null

        if (fallbackInvoiceUrl) {
          c.header('Cache-Control', 'no-store')
          return c.redirect(fallbackInvoiceUrl, 302)
        }
      } catch (error) {
        logger.warn(
          {
            debtId: debt.id,
            error: error instanceof Error ? error.message : String(error),
            scope: 'publicDebts.getInvoiceByToken.stripeFallback',
          },
          'Stripe invoice creation failed while opening the public invoice',
        )
      }

      throw new HTTPException(503, {
        message: 'Stripe invoice URL is not available',
      })
    }

    c.header('Cache-Control', 'no-store')
    return c.redirect(invoiceUrl, 302)
  })
)

handler.openapi(
  verifyStripePaymentByTokenSchema,
  withRouteTryCatch('publicDebts.verifyStripePaymentByToken', async (c) => {
    const { token } = c.req.valid('param')

    const service = new DebtsService(c.get('prisma'))
    const { debt } = await service.getByCustomerToken(token)

    // If a Stripe session_id is provided, query Stripe for authoritative status
    const sessionId = c.req.query('session_id') || c.req.query('sessionId') || undefined
    if (sessionId) {
      try {
        const stripe = getStripeClient()
        // Expand payment_intent to inspect status and id
        const session = await stripe.checkout.sessions.retrieve(sessionId, {
          expand: ['payment_intent'],
        })

        const paymentIntent =
          session.payment_intent && typeof session.payment_intent !== 'string'
            ? session.payment_intent
            : null
        const paidByStripe =
          session.payment_status === 'paid' || paymentIntent?.status === 'succeeded'

        if (paidByStripe) {
          // Sync DB using the existing idempotent confirm method.
          // We synthesize a minimal ConfirmStripePaymentInput — the method is safe to call multiple times.
          const input: Parameters<typeof service.confirmStripePaymentByDebtId>[1] = {
            stripeEventId: `manual-check:${session.id}`,
            stripeEventType: 'manual.verify',
            stripeSessionId: session.id,
            stripePaymentIntentId: paymentIntent?.id ?? null,
            amountTotal: session.amount_total ?? null,
            currency: session.currency ?? null,
            livemode: session.livemode,
          }

          try {
            await service.confirmStripePaymentByDebtId(debt.id, input)
          } catch (err) {
            // Log and continue — confirmStripePaymentByDebtId is idempotent but may fail
            logger.warn({ debtId: debt.id, err, scope: 'publicDebts.verifyStripePaymentByToken.sync' }, 'Failed to sync Stripe paid status to DB')
          }

          // Reload debt after potential sync
          const reloaded = await service.getByCustomerToken(token)
          return c.json({ data: { debtId: reloaded.debt.id, debtStatus: reloaded.debt.status, isPaid: reloaded.debt.status === 'PAID' } })
        }
      } catch (err) {
        logger.warn({ err, scope: 'publicDebts.verifyStripePaymentByToken.stripe' }, 'Stripe lookup failed')
        // fallthrough to return DB state below
      }
    }

    return c.json({
      data: {
        debtId: debt.id,
        debtStatus: debt.status,
        isPaid: debt.status === 'PAID',
      },
    })
  })
)

const routeModule = {
  path: '/api/v1/public/debts',
  handler,
}

export default routeModule
