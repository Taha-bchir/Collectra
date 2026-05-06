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
import { DebtsService } from '../../../services/debts.js'
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
    const prisma = c.get('prisma')
    const service = new DebtsService(prisma)
    const { debt } = await service.getByCustomerToken(token)

    if (debt.status !== 'PAID') {
      throw new HTTPException(400, {
        message: 'Invoice is only available after payment confirmation',
      })
    }

    const paymentConfirmation = await prisma.customerActionHistory.findFirst({
      where: {
        debtId: debt.id,
        actionType: 'PAYMENT_CONFIRMED',
      },
      orderBy: {
        timestamp: 'desc',
      },
    })

    const metadata = paymentConfirmation?.metadata as
      | { stripe?: { sessionId?: string | null; paymentIntentId?: string | null } }
      | null
    const invoiceNumber = debt.invoiceNumber ?? `INV-${debt.id.slice(0, 8).toUpperCase()}`
    const paymentDate = paymentConfirmation?.timestamp?.toISOString() ?? debt.updatedAt.toISOString()
    const amount = debt.amount.toNumber().toFixed(2)

    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')

    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Invoice ${escapeHtml(invoiceNumber)}</title>
    <style>
      :root { color-scheme: light; }
      body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 32px; background: #f6f7fb; color: #111827; }
      .sheet { max-width: 840px; margin: 0 auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 20px; padding: 32px; box-shadow: 0 10px 30px rgba(17, 24, 39, 0.08); }
      .header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; border-bottom: 1px solid #e5e7eb; padding-bottom: 20px; margin-bottom: 24px; }
      h1 { margin: 0; font-size: 30px; }
      .muted { color: #6b7280; }
      .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 20px; }
      .card { border: 1px solid #e5e7eb; border-radius: 16px; padding: 16px; background: #fafafa; }
      .label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 6px; }
      .value { font-size: 16px; font-weight: 600; word-break: break-word; }
      .amount { font-size: 34px; font-weight: 800; }
      .footer { margin-top: 28px; padding-top: 18px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
      .actions { margin-top: 18px; display: flex; gap: 12px; flex-wrap: wrap; }
      .btn { display: inline-flex; align-items: center; justify-content: center; padding: 10px 14px; border-radius: 999px; border: 1px solid #111827; color: #111827; text-decoration: none; font-weight: 700; }
      .btn.primary { background: #111827; color: #fff; }
      @media print { body { background: #fff; padding: 0; } .sheet { box-shadow: none; border: none; border-radius: 0; } .actions { display: none; } }
    </style>
  </head>
  <body>
    <main class="sheet">
      <div class="header">
        <div>
          <p class="muted" style="margin:0 0 8px; text-transform: uppercase; letter-spacing: 0.08em; font-size: 12px;">Collectra</p>
          <h1>Invoice / Receipt</h1>
          <p class="muted" style="margin: 10px 0 0;">Payment confirmed for your debt account.</p>
        </div>
        <div style="text-align:right;">
          <div class="label">Invoice number</div>
          <div class="value">${escapeHtml(invoiceNumber)}</div>
          <div class="label" style="margin-top: 12px;">Payment date</div>
          <div class="value">${escapeHtml(new Date(paymentDate).toLocaleString())}</div>
        </div>
      </div>

      <div class="grid">
        <div class="card">
          <div class="label">Customer</div>
          <div class="value">${escapeHtml(debt.client.fullName)}</div>
          <div class="muted" style="margin-top:6px;">${escapeHtml(debt.client.email ?? debt.client.phone ?? 'No contact provided')}</div>
        </div>
        <div class="card">
          <div class="label">Campaign</div>
          <div class="value">${escapeHtml(debt.campaign.name)}</div>
          <div class="muted" style="margin-top:6px;">Debt reference: ${escapeHtml(debt.id)}</div>
        </div>
        <div class="card">
          <div class="label">Amount paid</div>
          <div class="amount">${amount}</div>
        </div>
        <div class="card">
          <div class="label">Due date</div>
          <div class="value">${escapeHtml(debt.dueDate.toLocaleString())}</div>
          <div class="muted" style="margin-top:6px;">Status: ${escapeHtml(debt.status)}</div>
        </div>
      </div>

      <div class="card" style="margin-top: 16px;">
        <div class="label">Payment details</div>
        <div class="muted">This receipt was generated after the payment webhook or Stripe verification confirmed the payment.</div>
        <div class="muted" style="margin-top:8px;">Stripe session: ${escapeHtml(metadata?.stripe?.sessionId ?? 'n/a')}</div>
      </div>

      <div class="actions">
        <a class="btn primary" href="javascript:window.print()">Print / Save as PDF</a>
        <a class="btn" href="${escapeHtml(`${env.WEB_URL}/client/view?token=${encodeURIComponent(token)}`)}">Back to debt view</a>
      </div>

      <div class="footer">
        Collectra receipt generated for ${escapeHtml(debt.client.fullName)}. Keep this document for your records.
      </div>
    </main>
  </body>
</html>`

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  })
)

handler.openapi(
  verifyStripePaymentByTokenSchema,
  withRouteTryCatch('publicDebts.verifyStripePaymentByToken', async (c) => {
    const { token } = c.req.valid('param')

    const service = new DebtsService(c.get('prisma'))
    const { debt } = await service.getByCustomerToken(token)

    // If a Stripe session_id is provided, query Stripe for authoritative status
    const sessionId = c.req.query('session_id') || c.req.query('sessionId') || null
    if (sessionId) {
      try {
        const stripe = getStripeClient()
        // Expand payment_intent to inspect status and id
        const session = await stripe.checkout.sessions.retrieve(sessionId as string, {
          expand: ['payment_intent'],
        })

        const paymentIntent: any = session.payment_intent || null
        const paidByStripe = (session.payment_status === 'paid') || (paymentIntent && paymentIntent.status === 'succeeded')

        if (paidByStripe) {
          // Sync DB using the existing idempotent confirm method.
          // We synthesize a minimal ConfirmStripePaymentInput — the method is safe to call multiple times.
          const input = {
            stripeEventId: `manual-check:${session.id}`,
            stripeEventType: 'manual.verify',
            stripeSessionId: session.id as string,
            stripePaymentIntentId: paymentIntent ? (paymentIntent.id as string) : null,
            amountTotal: session.amount_total ?? null,
            currency: session.currency ?? null,
            livemode: Boolean((session as any).livemode),
          }

          try {
            await service.confirmStripePaymentByDebtId(debt.id, input as any)
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
