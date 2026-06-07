import Stripe from 'stripe'
import { HTTPException } from 'hono/http-exception'
import { env } from '../config/env.js'

/** Currencies Collectra can charge through Stripe Checkout. */
export const STRIPE_CHECKOUT_CURRENCIES = ['eur', 'usd'] as const

export type StripeCheckoutCurrency = (typeof STRIPE_CHECKOUT_CURRENCIES)[number]

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

export function isStripeCheckoutCurrency(value: string): value is StripeCheckoutCurrency {
  return (STRIPE_CHECKOUT_CURRENCIES as readonly string[]).includes(value)
}

export function assertStripeCheckoutCurrency(value?: string | null) {
  const currency = normalizeStripeCurrency(value)
  if (!isStripeCheckoutCurrency(currency)) {
    throw new HTTPException(400, {
      message: `Online payment is not available for ${currency.toUpperCase()} debts. Stripe currently supports EUR and USD only.`,
    })
  }
  return currency
}

export function toStripeHttpException(error: unknown): HTTPException {
  if (error instanceof HTTPException) {
    return error
  }

  if (error instanceof Stripe.errors.StripeError) {
    return new HTTPException(400, { message: error.message })
  }

  return new HTTPException(500, { message: 'Unable to start secure payment. Please try again.' })
}
