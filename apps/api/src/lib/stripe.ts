import Stripe from 'stripe'
import { HTTPException } from 'hono/http-exception'
import { env } from '../config/env.js'

let stripeClient: InstanceType<typeof Stripe> | null = null

export function getStripeClient() {
  if (!env.STRIPE_SECRET_KEY) {
    throw new HTTPException(503, {
      message: 'Stripe integration is not configured',
    })
  }

  if (!stripeClient) {
    stripeClient = new Stripe(env.STRIPE_SECRET_KEY)
  }

  return stripeClient
}

export function getStripeCurrency() {
  return (env.STRIPE_CURRENCY ?? 'usd').toLowerCase()
}

export function normalizeStripeCurrency(value?: string | null) {
  const normalized = (value ?? '').trim().toLowerCase()
  return normalized.length > 0 ? normalized : getStripeCurrency()
}
