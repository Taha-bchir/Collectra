import { PrismaClient } from '@repo/database'
import { HTTPException } from 'hono/http-exception'
import type { DebtStatus } from '@repo/database'
import { env } from '../config/env.js'
import { logBrevoEvent } from './brevo-event-logs.js'
import { signCustomerToken, verifyCustomerToken } from '../lib/customer-jwt.js'
import { logger } from '../utils/logger.js'
import { getStripeClient, getStripeCurrency } from '../lib/stripe.js'

const BREVO_EMAIL_API_URL = 'https://api.brevo.com/v3/smtp/email'
const DEFAULT_SENDER_NAME = 'Collectra'

function buildInvoiceNumber(debtId: string) {
  return `INV-${debtId.replace(/-/g, '').slice(0, 10).toUpperCase()}`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function generateInvoiceHtml(
  invoiceNumber: string,
  debtId: string,
  paymentDate: string,
  amount: string,
  customerName: string,
  customerEmail: string,
  customerPhone: string | null,
  campaignName: string,
  dueDate: Date,
  debtStatus: DebtStatus,
  stripeSessionId: string | null,
  invoiceDownloadUrl: string | null,
): string {
  return `<!doctype html>
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
      .actions { margin-top: 18px; }
      .btn { display: inline-flex; align-items: center; justify-content: center; padding: 10px 14px; border-radius: 999px; border: 1px solid #111827; color: #ffffff; background: #111827; text-decoration: none; font-weight: 700; }
      .footer { margin-top: 28px; padding-top: 18px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
      @media print { body { background: #fff; padding: 0; } .sheet { box-shadow: none; border: none; border-radius: 0; } }
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
          <div class="value">${escapeHtml(customerName)}</div>
          <div class="muted" style="margin-top:6px;">${escapeHtml(customerEmail ?? customerPhone ?? 'No contact provided')}</div>
        </div>
        <div class="card">
          <div class="label">Campaign</div>
          <div class="value">${escapeHtml(campaignName)}</div>
          <div class="muted" style="margin-top:6px;">Debt reference: ${escapeHtml(debtId)}</div>
        </div>
        <div class="card">
          <div class="label">Amount paid</div>
          <div class="amount">${amount}</div>
        </div>
        <div class="card">
          <div class="label">Due date</div>
          <div class="value">${escapeHtml(dueDate.toLocaleString())}</div>
          <div class="muted" style="margin-top:6px;">Status: ${escapeHtml(debtStatus)}</div>
        </div>
      </div>

      <div class="card" style="margin-top: 16px;">
        <div class="label">Payment details</div>
        <div class="muted">This receipt was generated after the payment was confirmed.</div>
        <div class="muted" style="margin-top:8px;">Stripe session: ${escapeHtml(stripeSessionId ?? 'n/a')}</div>
      </div>

      ${invoiceDownloadUrl
        ? `<div class="actions"><a class="btn" href="${escapeHtml(invoiceDownloadUrl)}">Download Invoice (PDF)</a></div>`
        : ''}

      <div class="footer">
        Collectra receipt generated for ${escapeHtml(customerName)}. Keep this document for your records.
      </div>
    </main>
  </body>
</html>`
}

async function sendInvoiceEmailToBrevo(options: {
  toEmail: string
  toName: string
  invoiceHtml: string
  invoiceNumber: string
  debtId: string
  campaignId?: string
}): Promise<{ ok: boolean; messageId: string | null }> {
  const apiKey = env.BREVO_API_KEY
  const senderEmail = env.BREVO_SENDER_EMAIL
  const senderName = env.BREVO_SENDER_NAME || DEFAULT_SENDER_NAME

  if (!apiKey || !senderEmail) {
    logger.warn(
      { scope: 'sendInvoiceEmailToBrevo' },
      'Brevo not configured, skipping invoice email',
    )
    return { ok: false, messageId: null }
  }

  try {
    const response = await fetch(BREVO_EMAIL_API_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: {
          email: senderEmail,
          name: senderName,
        },
        to: [{ email: options.toEmail, name: options.toName }],
        tags: [
          'collectra',
          'invoice',
          `debt:${options.debtId}`,
          ...(options.campaignId ? [`campaign:${options.campaignId}`] : []),
        ],
        headers: {
          'X-Mailin-custom': [
            `debt_id=${options.debtId}`,
            'email_type=invoice',
            ...(options.campaignId ? [`campaign_id=${options.campaignId}`] : []),
          ].join('|'),
        },
        subject: `Payment Receipt - Invoice ${options.invoiceNumber}`,
        htmlContent: options.invoiceHtml,
        textContent: `Your payment receipt for invoice ${options.invoiceNumber} has been generated. Please keep this for your records.`,
      }),
    })

    if (!response.ok) {
      logger.error(
        {
          status: response.status,
          statusText: response.statusText,
          debtId: options.debtId,
          scope: 'sendInvoiceEmailToBrevo.response',
        },
        'Brevo API error while sending invoice email',
      )
      return { ok: false, messageId: null }
    }

    let messageId: string | null = null
    try {
      const responseBody = (await response.json()) as Record<string, unknown>
      messageId =
        (typeof responseBody.messageId === 'string' ? responseBody.messageId : null) ??
        (typeof responseBody['message-id'] === 'string' ? responseBody['message-id'] : null) ??
        (typeof responseBody.message_id === 'string' ? responseBody.message_id : null)
    } catch {
      messageId = null
    }

    logger.info(
      {
        debtId: options.debtId,
        messageId,
        scope: 'sendInvoiceEmailToBrevo.success',
      },
      'Invoice email sent successfully',
    )

    return { ok: true, messageId }
  } catch (error) {
    logger.error(
      {
        debtId: options.debtId,
        error: error instanceof Error ? error.message : String(error),
        scope: 'sendInvoiceEmailToBrevo.catch',
      },
      'Failed to send invoice email',
    )
    return { ok: false, messageId: null }
  }
}

type ConfirmStripePaymentInput = {
  stripeEventId: string
  stripeEventType: string
  stripeSessionId: string
  stripePaymentIntentId: string | null
  amountTotal: number | null
  currency: string | null
  livemode: boolean
}

/**
 * SECURITY & LINK FORMAT – CUSTOMER PERSONAL LINKS
 *
 * Format: https://app.collectra.com/client/view?token=<jwt-token>
 *
 * - Token is a signed JWT (HS256) — no DB storage required
 * - debtId is stored in the JWT `sub` claim
 * - Expiry is enforced by the JWT `exp` claim (30 days)
 * - Link requires NO authentication – pure token-based access
 * - Token is tamper-proof (HMAC signature) and scoped to one debt
 * - NEVER expose raw debt IDs or predictable patterns in links
 * - Customer actions (view, promise, confirm) are logged anonymously
 */

export type DebtListFilters = {
  status?: DebtStatus
  clientId?: string
  campaignId?: string
}

export type DebtListOptions = {
  limit?: number
  offset?: number
}

export type CreateDebtInput = {
  campaignId: string
  clientId: string
  amount: number
  dueDate: Date
  status?: DebtStatus
  promiseDate?: Date | null
}

export type UpdateDebtInput = Partial<{
  amount: number
  dueDate: Date
  status: DebtStatus
  promiseDate?: Date | null
}>

export class DebtsService {
  constructor(private readonly prisma: PrismaClient) {}

  async recordEmailOpenByDebtId(debtId: string) {
    const debt = await this.prisma.debtRecord.findUnique({
      where: { id: debtId },
      select: { id: true, clientId: true, campaignId: true },
    })

    if (!debt) {
      throw new HTTPException(404, { message: 'Debt not found' })
    }

    await this.prisma.customerActionHistory.create({
      data: {
        debtId: debt.id,
        customerId: debt.clientId,
        actionType: 'OTHER',
        metadata: {
          channel: 'email_pixel',
          event: 'email_opened',
          source: 'brevo-email-pixel',
        },
      },
    })

    try {
      await logBrevoEvent(this.prisma, {
        provider: 'collectra',
        source: 'brevo-email-pixel',
        eventName: 'email_opened',
        status: 'created',
        debtId: debt.id,
        customerId: debt.clientId,
        campaignId: debt.campaignId,
        payload: {
          debtId,
        },
      })
    } catch (error) {
      logger.warn({ debtId: debt.id, error, scope: 'debts.recordEmailOpenByDebtId.logBrevoEvent' }, 'Failed to persist Brevo event log for email open')
    }

    return {
      debtId: debt.id,
      customerId: debt.clientId,
    }
  }

  async recordLinkClickByCustomerToken(token: string) {
    const { debt } = await this.getByCustomerToken(token)

    await this.prisma.customerActionHistory.create({
      data: {
        debtId: debt.id,
        customerId: debt.clientId,
        actionType: 'LINK_CLICKED',
        metadata: {
          channel: 'public_link',
          event: 'link_clicked',
          source: 'public-debts.track-click',
        },
      },
    })

    try {
      await logBrevoEvent(this.prisma, {
        provider: 'collectra',
        source: 'public_link',
        eventName: 'link_clicked',
        status: 'created',
        debtId: debt.id,
        customerId: debt.clientId,
        campaignId: debt.campaignId,
        payload: {
          tokenScopedDebtId: debt.id,
        },
      })
    } catch (error) {
      logger.warn({ debtId: debt.id, error, scope: 'debts.recordLinkClickByCustomerToken.logBrevoEvent' }, 'Failed to persist Brevo event log for link click')
    }

    return {
      debtId: debt.id,
      customerId: debt.clientId,
    }
  }

  async recordLinkOpenByCustomerToken(token: string) {
    const { debt } = await this.getByCustomerToken(token)

    await this.prisma.customerActionHistory.create({
      data: {
        debtId: debt.id,
        customerId: debt.clientId,
        actionType: 'OTHER',
        metadata: {
          channel: 'public_link',
          event: 'link_opened',
          source: 'public-debts.track-open',
        },
      },
    })

    try {
      await logBrevoEvent(this.prisma, {
        provider: 'collectra',
        source: 'public_link',
        eventName: 'link_opened',
        status: 'created',
        debtId: debt.id,
        customerId: debt.clientId,
        campaignId: debt.campaignId,
        payload: {
          tokenScopedDebtId: debt.id,
        },
      })
    } catch (error) {
      logger.warn({ debtId: debt.id, error, scope: 'debts.recordLinkOpenByCustomerToken.logBrevoEvent' }, 'Failed to persist Brevo event log for link open')
    }

    return {
      debtId: debt.id,
      customerId: debt.clientId,
    }
  }

  async getByCustomerToken(token: string) {
    let debtId: string
    let tokenExpiresAt: Date

    try {
      const result = await verifyCustomerToken(token)
      debtId = result.debtId
      tokenExpiresAt = result.expiresAt
    } catch {
      throw new HTTPException(404, { message: 'Debt link is invalid or expired' })
    }

    const debt = await this.prisma.debtRecord.findUnique({
      where: { id: debtId },
      include: { client: true, campaign: true },
    })

    if (!debt) {
      throw new HTTPException(404, { message: 'Debt link is invalid or expired' })
    }

    return { debt, tokenExpiresAt }
  }

  async createPromiseByCustomerToken(token: string, promisedDate: Date) {
    const { debt } = await this.getByCustomerToken(token)

    const parsedPromisedDate = new Date(promisedDate)
    if (Number.isNaN(parsedPromisedDate.getTime())) {
      throw new HTTPException(400, { message: 'Invalid promise date' })
    }

    // The UI submits a date-only value; compare using UTC day boundaries so
    // selecting "today" is always valid regardless of timezone offset.
    const normalizedPromisedDate = new Date(
      Date.UTC(
        parsedPromisedDate.getUTCFullYear(),
        parsedPromisedDate.getUTCMonth(),
        parsedPromisedDate.getUTCDate(),
      ),
    )

    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)

    const dueDateEnd = new Date(debt.dueDate)
    dueDateEnd.setUTCHours(23, 59, 59, 999)

    if (normalizedPromisedDate < todayStart) {
      throw new HTTPException(400, { message: 'Promise date cannot be in the past' })
    }

    if (normalizedPromisedDate > dueDateEnd) {
      throw new HTTPException(400, { message: 'Promise date must be on or before due date' })
    }

    const [updatedDebt, paymentPromise] = await this.prisma.$transaction([
      this.prisma.debtRecord.update({
        where: { id: debt.id },
        data: {
          promiseDate: normalizedPromisedDate,
          status: 'PROMISE_TO_PAY',
        },
      }),
      this.prisma.paymentPromise.create({
        data: {
          debtId: debt.id,
          promisedDate: normalizedPromisedDate,
          status: 'ACTIVE',
        },
      }),
    ])

    await this.prisma.customerActionHistory.create({
      data: {
        debtId: debt.id,
        customerId: debt.clientId,
        actionType: 'PROMISE_MADE',
        metadata: {
          promiseId: paymentPromise.id,
          promisedDate: normalizedPromisedDate.toISOString(),
          channel: 'public_link',
        },
      },
    })

    return updatedDebt
  }

  async confirmFakePaymentByCustomerToken(token: string) {
    const { debt: rawDebt } = await this.getByCustomerToken(token)
    const debt = rawDebt as typeof rawDebt & {
      invoiceNumber?: string | null
      pendingStripeSessionId?: string | null
    }

    if (debt.status !== 'PROMISE_TO_PAY') {
      throw new HTTPException(400, {
        message: 'Fake payment is only available for debts in PROMISE_TO_PAY status',
      })
    }

    // Validate payment is allowed on/after promise date
    if (debt.promiseDate) {
      const promiseDateStart = new Date(
        Date.UTC(
          debt.promiseDate.getUTCFullYear(),
          debt.promiseDate.getUTCMonth(),
          debt.promiseDate.getUTCDate(),
        ),
      )
      const todayStart = new Date()
      todayStart.setUTCHours(0, 0, 0, 0)

      if (todayStart < promiseDateStart) {
        throw new HTTPException(400, {
          message: `Payment is not available until ${debt.promiseDate.toISOString().split('T')[0]}`,
        })
      }
    }

    const updatedDebt = await this.prisma.$transaction(async (tx) => {
      const paidDebt = await tx.debtRecord.update({
        where: { id: debt.id },
        data: ({
          status: 'PAID',
          invoiceNumber: debt.invoiceNumber ?? buildInvoiceNumber(debt.id),
        } as unknown) as Parameters<typeof tx.debtRecord.update>[0]['data'],
      })

      await tx.paymentPromise.updateMany({
        where: {
          debtId: debt.id,
          status: 'ACTIVE',
        },
        data: {
          status: 'KEPT',
        },
      })

      await tx.customerActionHistory.create({
        data: {
          debtId: debt.id,
          customerId: debt.clientId,
          actionType: 'PAYMENT_CONFIRMED',
          metadata: {
            channel: 'public_link',
            fakePayment: true,
          },
        },
      })

      return paidDebt
    })

    // Send invoice email (non-blocking – failure won't block payment confirmation)
    try {
      const invoiceNumber = (updatedDebt as unknown as { invoiceNumber?: string | null }).invoiceNumber ?? buildInvoiceNumber(updatedDebt.id)
      const amount = updatedDebt.amount.toNumber().toFixed(2)
      const invoiceBaseUrl = (env.API_URL ?? env.WEB_URL ?? 'https://collectra.xyz').replace(/\/$/, '')
      const invoiceDownloadUrl = `${invoiceBaseUrl}/api/v1/public/debts/${encodeURIComponent(token)}/invoice`
      const invoiceHtml = generateInvoiceHtml(
        invoiceNumber,
        updatedDebt.id,
        new Date().toISOString(),
        amount,
        debt.client.fullName,
        debt.client.email ?? '',
        debt.client.phone ?? null,
        debt.campaign.name,
        debt.dueDate,
        updatedDebt.status,
        null,
        invoiceDownloadUrl,
      )

      if (debt.client.email) {
        await sendInvoiceEmailToBrevo({
          toEmail: debt.client.email,
          toName: debt.client.fullName,
          invoiceHtml,
          invoiceNumber,
          debtId: updatedDebt.id,
          campaignId: debt.campaign.id,
        })

        // Log email event
        await logBrevoEvent(this.prisma, {
          debtId: updatedDebt.id,
          customerId: debt.clientId,
          provider: 'brevo',
          source: 'payment_confirmation',
          eventName: 'invoice_sent',
          email: debt.client.email,
        })
      }
    } catch (error) {
      // Log error but don't block payment confirmation
      logger.error(
        {
          debtId: updatedDebt.id,
          error: error instanceof Error ? error.message : String(error),
          scope: 'debts.confirmFakePaymentByCustomerToken.sendInvoiceEmail',
        },
        'Failed to send or log invoice email after fake payment',
      )
    }

    return updatedDebt
  }

  async createStripeCheckoutSessionByCustomerToken(token: string) {
    const { debt: rawDebt } = await this.getByCustomerToken(token)
    const debt = rawDebt as typeof rawDebt & {
      invoiceNumber?: string | null
      pendingStripeSessionId?: string | null
    }

    if (debt.status !== 'PROMISE_TO_PAY') {
      throw new HTTPException(400, {
        message: 'Stripe payment is only available for debts in PROMISE_TO_PAY status',
      })
    }

    // Prevent duplicate checkout sessions while one is pending
    if (debt.pendingStripeSessionId) {
      throw new HTTPException(400, {
        message: 'A payment session is already in progress for this debt. Please wait or try again later.',
      })
    }

    // Validate payment is allowed on/after promise date
    if (debt.promiseDate) {
      const promiseDateStart = new Date(
        Date.UTC(
          debt.promiseDate.getUTCFullYear(),
          debt.promiseDate.getUTCMonth(),
          debt.promiseDate.getUTCDate(),
        ),
      )
      const todayStart = new Date()
      todayStart.setUTCHours(0, 0, 0, 0)

      if (todayStart < promiseDateStart) {
        throw new HTTPException(400, {
          message: `Payment is not available until ${debt.promiseDate.toISOString().split('T')[0]}`,
        })
      }
    }

    const amount = debt.amount.toNumber()
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new HTTPException(400, {
        message: 'Debt amount is invalid for Stripe payment',
      })
    }

    const stripe = getStripeClient()
    const currency = getStripeCurrency()
    const unitAmount = Math.round(amount * 100)

    const successUrl = `${env.WEB_URL}/client/view?token=${encodeURIComponent(token)}&payment=success&session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = `${env.WEB_URL}/client/view?token=${encodeURIComponent(token)}&payment=cancelled`

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: debt.client.email ?? undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: unitAmount,
            product_data: {
              name: `Debt Payment - ${debt.campaign.name}`,
              description: `Debt ID: ${debt.id}`,
            },
          },
        },
      ],
      metadata: {
        debtId: debt.id,
        customerId: debt.clientId,
        source: 'public_link',
      },
      payment_intent_data: {
        metadata: {
          debtId: debt.id,
          customerId: debt.clientId,
          source: 'public_link',
        },
      },
    })

    if (!session.url) {
      throw new HTTPException(500, { message: 'Stripe checkout URL was not returned' })
    }

    // Atomically store the pending session ID on the debt to prevent duplicates
    await this.prisma.debtRecord.update({
      where: { id: debt.id },
      data: ({
        pendingStripeSessionId: session.id,
      } as unknown) as Parameters<typeof this.prisma.debtRecord.update>[0]['data'],
    })

    return {
      sessionId: session.id,
      checkoutUrl: session.url,
    }
  }

  async confirmStripePaymentByDebtId(debtId: string, input: ConfirmStripePaymentInput) {
    const updatedDebt = await this.prisma.$transaction(async (tx) => {
      const debt = (await tx.debtRecord.findUnique({
        where: { id: debtId },
        include: {
          campaign: true,
          client: true,
        },
      })) as typeof input extends never
        ? never
        : (Awaited<ReturnType<typeof tx.debtRecord.findUnique>> & {
            invoiceNumber?: string | null
            pendingStripeSessionId?: string | null
          })

      if (!debt) {
        logger.warn(
          {
            debtId,
            stripeEventId: input.stripeEventId,
            scope: 'debts.confirmStripePaymentByDebtId',
          },
          'Skipping Stripe payment confirmation because debt was not found',
        )
        return null
      }

      if (debt.status === 'PAID') {
        return debt
      }

      const paidDebt = await tx.debtRecord.update({
        where: { id: debt.id },
        data: ({
          status: 'PAID',
          pendingStripeSessionId: null,
          invoiceNumber: debt.invoiceNumber ?? buildInvoiceNumber(debt.id),
        } as unknown) as Parameters<typeof tx.debtRecord.update>[0]['data'],
      })

      await tx.paymentPromise.updateMany({
        where: {
          debtId: debt.id,
          status: 'ACTIVE',
        },
        data: {
          status: 'KEPT',
        },
      })

      await tx.customerActionHistory.create({
        data: {
          debtId: debt.id,
          customerId: debt.clientId,
          actionType: 'PAYMENT_CONFIRMED',
          metadata: {
            channel: 'stripe',
            stripe: {
              eventId: input.stripeEventId,
              eventType: input.stripeEventType,
              sessionId: input.stripeSessionId,
              paymentIntentId: input.stripePaymentIntentId,
              amountTotal: input.amountTotal,
              currency: input.currency,
              livemode: input.livemode,
            },
          },
        },
      })

      return paidDebt
    })

    // Send invoice email (non-blocking – failure won't block payment confirmation)
    if (updatedDebt && updatedDebt.status === 'PAID') {
      try {
        // Fetch full debt data (including client and campaign) outside transaction for email
        const fullDebt = await this.prisma.debtRecord.findUnique({
          where: { id: debtId },
          include: { client: true, campaign: true },
        })

        if (fullDebt && fullDebt.client.email) {
          const invoiceNumber = (fullDebt as unknown as { invoiceNumber?: string | null }).invoiceNumber ?? buildInvoiceNumber(fullDebt.id)
          const amount = fullDebt.amount.toNumber().toFixed(2)
          const { token } = await signCustomerToken(fullDebt.id)
          const invoiceBaseUrl = (env.API_URL ?? env.WEB_URL ?? 'https://collectra.xyz').replace(/\/$/, '')
          const invoiceDownloadUrl = `${invoiceBaseUrl}/api/v1/public/debts/${encodeURIComponent(token)}/invoice`
          const invoiceHtml = generateInvoiceHtml(
            invoiceNumber,
            fullDebt.id,
            new Date().toISOString(),
            amount,
            fullDebt.client.fullName,
            fullDebt.client.email ?? '',
            fullDebt.client.phone ?? null,
            fullDebt.campaign.name,
            fullDebt.dueDate,
            fullDebt.status,
            input.stripeSessionId,
            invoiceDownloadUrl,
          )

          await sendInvoiceEmailToBrevo({
            toEmail: fullDebt.client.email,
            toName: fullDebt.client.fullName,
            invoiceHtml,
            invoiceNumber,
            debtId: fullDebt.id,
            campaignId: fullDebt.campaign.id,
          })

          // Log email event
          await logBrevoEvent(this.prisma, {
            debtId: fullDebt.id,
            customerId: fullDebt.clientId,
            provider: 'brevo',
            source: 'stripe_payment_confirmation',
            eventName: 'invoice_sent',
            email: fullDebt.client.email,
          })
        }
      } catch (error) {
        // Log error but don't block payment confirmation
        logger.error(
          {
            debtId: updatedDebt.id,
            error: error instanceof Error ? error.message : String(error),
            scope: 'debts.confirmStripePaymentByDebtId.sendInvoiceEmail',
          },
          'Failed to send or log invoice email after Stripe payment',
        )
      }
    }

    return updatedDebt
  }

  async generateCustomerToken(workspaceId: string, debtId: string) {
    await this.getById(workspaceId, debtId) // ensures ownership
    return signCustomerToken(debtId)
  }

  async getPersonalLink(workspaceId: string, debtId: string) {
    const { token, expiresAt } = await this.generateCustomerToken(workspaceId, debtId)
    return {
      link: `${env.WEB_URL}/client/view?token=${encodeURIComponent(token)}`,
      token,
      expiresAt,
    }
  }

  async list(
    workspaceId: string,
    filters: DebtListFilters = {},
    options: DebtListOptions = {},
  ) {
    const { status, clientId, campaignId } = filters
    const { limit = 100, offset = 0 } = options

    const safeLimit = Math.min(Math.max(limit, 1), 500)
    const safeOffset = Math.max(offset, 0)

    return this.prisma.debtRecord.findMany({
      where: {
        campaign: { workspaceId },
        ...(status && { status }),
        ...(clientId && { clientId }),
        ...(campaignId && { campaignId }),
      },
      include: { client: true },
      orderBy: { dueDate: 'asc' },
      take: safeLimit,
      skip: safeOffset,
    })
  }

  async getById(workspaceId: string, id: string) {
    const debt = await this.prisma.debtRecord.findUnique({
      where: { id },
      include: { client: true, campaign: true },
    })

    if (!debt || debt.campaign.workspaceId !== workspaceId) {
      throw new HTTPException(404, { message: 'Debt not found or not in your workspace' })
    }

    return debt
  }

  async create(workspaceId: string, data: CreateDebtInput) {
    // Verify campaign & client both belong to the workspace before creating the debt
    const [campaign, client] = await Promise.all([
      this.prisma.campaign.findUnique({
        where: { id: data.campaignId },
      }),
      this.prisma.client.findUnique({
        where: { id: data.clientId },
      }),
    ] as const)

    if (!campaign || campaign.workspaceId !== workspaceId) {
      throw new HTTPException(403, { message: 'Campaign not in your workspace' })
    }

    if (!client || client.workspaceId !== workspaceId) {
      throw new HTTPException(403, { message: 'Client not in your workspace' })
    }

    return this.prisma.debtRecord.create({ data })
  }

  async update(workspaceId: string, id: string, data: UpdateDebtInput) {
    // Reuse tenant check from getById to ensure isolation
    await this.getById(workspaceId, id)

    return this.prisma.debtRecord.update({
      where: { id },
      data,
      include: { client: true },
    })
  }
}