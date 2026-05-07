import Stripe from 'stripe'
import { OpenAPIHono } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'
import type { Env } from '../../../../types/index.js'
import { env } from '../../../../config/env.js'
import { getStripeClient } from '../../../../lib/stripe.js'
import { DebtsService } from '../../../../services/debts.js'
import { logger } from '../../../../utils/logger.js'

const handler = new OpenAPIHono<Env>()

handler.post('/events', async (c) => {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new HTTPException(503, {
      message: 'Stripe webhook integration is not configured',
    })
  }

  const stripe = getStripeClient()
  const signature = c.req.header('stripe-signature')

  if (!signature) {
    return c.json({ error: 'Missing stripe-signature header' }, 400)
  }

  const rawBody = await c.req.text()

  type WebhookEvent = {
    id: string
    type: string
    livemode?: boolean
    data: {
      object: {
        id: string
        metadata?: Record<string, string>
        payment_intent?: string | Record<string, unknown>
        amount_total?: number
        currency?: string
      }
    }
  }

  let event: WebhookEvent
  try {
    // Stripe returns a strongly-typed Event; cast to our minimal WebhookEvent
    event = (stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET) as unknown) as WebhookEvent
  } catch (error) {
    logger.warn(
      {
        error,
        scope: 'webhooks.stripe.events.verify',
      },
      'Failed to verify Stripe webhook signature',
    )
    return c.json({ error: 'Invalid Stripe signature' }, 400)
  }

  const debtsService = new DebtsService(c.get('prisma'))

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as {
      id: string
      metadata?: Record<string, string>
      payment_intent?: string | Record<string, unknown>
      amount_total?: number
      currency?: string
    }
    const debtId = session.metadata?.debtId

    if (!debtId) {
      logger.warn(
        {
          stripeEventId: event.id,
          stripeSessionId: session.id,
          scope: 'webhooks.stripe.events.checkoutCompleted',
        },
        'Stripe checkout completed event received without debtId metadata',
      )
    } else {
      await debtsService.confirmStripePaymentByDebtId(debtId, {
        stripeEventId: event.id,
        stripeEventType: event.type,
        stripeSessionId: session.id,
        stripePaymentIntentId:
          typeof session.payment_intent === 'string' ? session.payment_intent : null,
        amountTotal: (session.amount_total ?? null) as number | null,
        currency: (session.currency ?? null) as string | null,
        livemode: Boolean(event.livemode),
      })
    }
  }

  return c.json({ received: true })
})

const routeModule = {
  path: '/api/v1/webhooks/stripe',
  handler,
}

export default routeModule
