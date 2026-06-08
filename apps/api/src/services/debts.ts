import { PrismaClient } from '@repo/database'
import { HTTPException } from 'hono/http-exception'
import type { DebtStatus } from '@repo/database'
import { env } from '../config/env.js'
import { logBrevoEvent } from './brevo-event-logs.js'
import { signCustomerToken, verifyCustomerToken } from '../lib/customer-jwt.js'
import { logger } from '../utils/logger.js'
import {
  assertStripeCheckoutCurrency,
  getStripeClient,
  normalizeStripeCurrency,
  toStripeHttpException,
} from '../lib/stripe.js'
import { resolvePublicApiUrl, resolvePublicWebUrl } from '../utils/public-url.js'
import { parsePromisedDateInput, utcCalendarDayStart } from '../utils/calendar.js'
import { assertCustomerPaymentAllowed } from '../utils/customer-payment.js'
import { toPrismaMetadata } from '../utils/metadata.js'
import { transitionDebtToOverdue } from './overdue-debts.js'

const BREVO_EMAIL_API_URL = 'https://api.brevo.com/v3/smtp/email'
const DEFAULT_SENDER_NAME = 'Collectra'

type StripeClient = ReturnType<typeof getStripeClient>
type StripLastResponse<T> = T extends { lastResponse: unknown } ? Omit<T, 'lastResponse'> : T
type StripeCustomer = StripLastResponse<Awaited<ReturnType<StripeClient['customers']['create']>>>
type StripeCustomerListItem = StripLastResponse<Awaited<ReturnType<StripeClient['customers']['list']>>['data'][number]>
type StripeInvoice = StripLastResponse<Awaited<ReturnType<StripeClient['invoices']['create']>>>
type StripeInvoiceItem = StripLastResponse<Awaited<ReturnType<StripeClient['invoiceItems']['create']>>>

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

type CollectraInvoiceData = {
  invoiceNumber: string
  paidAt: Date
  customerName: string
  customerEmail: string | null
  amount: number
  currency: string
  dueDate: Date
  campaignName: string
  workspaceName: string | null
  debtId: string
  logoUrl: string
  downloadUrl: string
}

function formatInvoiceDisplayDate(value: Date) {
  return value.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatInvoiceAmount(amount: number, currency: string) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: (currency || 'USD').toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function buildCollectraInvoiceHtml(
  data: CollectraInvoiceData,
  options?: { forDownload?: boolean },
) {
  const issuer = data.workspaceName?.trim() || data.campaignName
  const downloadQuery = options?.forDownload ? '' : '?download=1'

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(data.invoiceNumber)} - Collectra</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f7f4ef;
        --card: #ffffff;
        --text: #2f2622;
        --muted: #6f625c;
        --border: #e7ddd4;
        --primary: #7a3340;
        --primary-soft: #f8ecee;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", Arial, sans-serif;
        background: var(--bg);
        color: var(--text);
        line-height: 1.5;
      }
      .page {
        max-width: 720px;
        margin: 32px auto;
        padding: 0 16px 40px;
      }
      .card {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: 18px;
        overflow: hidden;
        box-shadow: 0 10px 30px rgba(47, 38, 34, 0.06);
      }
      .header {
        display: flex;
        justify-content: space-between;
        gap: 24px;
        padding: 28px 28px 20px;
        border-bottom: 1px solid var(--border);
        background: linear-gradient(180deg, #fff 0%, #fbf8f5 100%);
      }
      .brand img {
        height: 36px;
        width: auto;
        display: block;
      }
      .brand p {
        margin: 10px 0 0;
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
      }
      .meta {
        text-align: right;
      }
      .meta h1 {
        margin: 0;
        font-size: 24px;
        color: var(--primary);
      }
      .meta p {
        margin: 6px 0 0;
        color: var(--muted);
        font-size: 14px;
      }
      .badge {
        display: inline-block;
        margin-top: 12px;
        padding: 6px 12px;
        border-radius: 999px;
        background: var(--primary-soft);
        color: var(--primary);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .content {
        padding: 28px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 18px;
        margin-bottom: 24px;
      }
      .field {
        padding: 16px;
        border: 1px solid var(--border);
        border-radius: 14px;
        background: #fcfaf8;
      }
      .field span {
        display: block;
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
        margin-bottom: 6px;
      }
      .field strong {
        font-size: 15px;
      }
      .amount-box {
        margin-top: 8px;
        padding: 22px;
        border-radius: 16px;
        background: var(--primary-soft);
        border: 1px solid #ead2d7;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
      }
      .amount-box span {
        color: var(--muted);
        font-size: 14px;
      }
      .amount-box strong {
        font-size: 28px;
        color: var(--primary);
      }
      .footer {
        padding: 0 28px 28px;
        color: var(--muted);
        font-size: 12px;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin: 0 28px 28px;
      }
      .button {
        appearance: none;
        border: 0;
        border-radius: 999px;
        padding: 12px 18px;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .button-primary {
        background: var(--primary);
        color: #fff;
      }
      .button-secondary {
        background: #fff;
        color: var(--primary);
        border: 1px solid #d8b8bf;
      }
      @media print {
        body { background: #fff; }
        .page { margin: 0; padding: 0; max-width: none; }
        .card { border: 0; box-shadow: none; }
        .actions { display: none; }
      }
      @media (max-width: 640px) {
        .header, .grid { grid-template-columns: 1fr; display: grid; }
        .meta { text-align: left; }
        .amount-box { flex-direction: column; align-items: flex-start; }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="card">
        <div class="header">
          <div class="brand">
            <img src="${escapeHtml(data.logoUrl)}" alt="Collectra" />
            <p>Payment receipt</p>
          </div>
          <div class="meta">
            <h1>${escapeHtml(data.invoiceNumber)}</h1>
            <p>Paid on ${escapeHtml(formatInvoiceDisplayDate(data.paidAt))}</p>
            <span class="badge">Paid</span>
          </div>
        </div>

        <div class="content">
          <div class="grid">
            <div class="field">
              <span>Customer</span>
              <strong>${escapeHtml(data.customerName)}</strong>
            </div>
            <div class="field">
              <span>Issued by</span>
              <strong>${escapeHtml(issuer)}</strong>
            </div>
            <div class="field">
              <span>Due date</span>
              <strong>${escapeHtml(formatInvoiceDisplayDate(data.dueDate))}</strong>
            </div>
            <div class="field">
              <span>Reference</span>
              <strong>${escapeHtml(data.campaignName)}</strong>
            </div>
          </div>

          <div class="amount-box">
            <span>Amount paid</span>
            <strong>${escapeHtml(formatInvoiceAmount(data.amount, data.currency))}</strong>
          </div>
        </div>

        <div class="actions">
          <button class="button button-primary" type="button" onclick="window.print()">Print / Save as PDF</button>
          <a class="button button-secondary" href="${escapeHtml(data.downloadUrl)}${downloadQuery}">Download receipt</a>
        </div>

        <div class="footer">
          Thank you for your payment. This receipt was generated by Collectra.
          ${data.customerEmail ? ` A copy was sent to ${escapeHtml(data.customerEmail)}.` : ''}
        </div>
      </div>
    </div>
  </body>
</html>`
}

export async function buildPaidDebtCollectraInvoiceHtml(
  prisma: PrismaClient,
  debt: {
    id: string
    amount: { toNumber(): number }
    currency: string
    dueDate: Date
    invoiceNumber: string | null
    client: {
      fullName: string
      email: string | null
    }
    campaign: {
      name: string
      workspace?: { name: string } | null
    }
  },
  token: string,
  options?: { forDownload?: boolean },
) {
  const paymentConfirmation = await prisma.customerActionHistory.findFirst({
    where: {
      debtId: debt.id,
      actionType: 'PAYMENT_CONFIRMED',
    },
    orderBy: { timestamp: 'desc' },
    select: { timestamp: true },
  })

  const invoiceNumber = debt.invoiceNumber ?? buildInvoiceNumber(debt.id)
  const invoiceBaseUrl = resolvePublicApiUrl().replace(/\/$/, '')
  const downloadUrl = `${invoiceBaseUrl}/api/v1/public/debts/${encodeURIComponent(token)}/invoice`

  return buildCollectraInvoiceHtml(
    {
      invoiceNumber,
      paidAt: paymentConfirmation?.timestamp ?? new Date(),
      customerName: debt.client.fullName,
      customerEmail: debt.client.email,
      amount: debt.amount.toNumber(),
      currency: debt.currency,
      dueDate: debt.dueDate,
      campaignName: debt.campaign.name,
      workspaceName: debt.campaign.workspace?.name ?? null,
      debtId: debt.id,
      logoUrl: `${resolvePublicWebUrl()}/logo-collectra-02.png`,
      downloadUrl,
    },
    options,
  )
}

export type StripeInvoiceDetails = {
  invoiceId: string
  invoiceNumber: string
  hostedInvoiceUrl: string | null
  invoicePdfUrl: string | null
  customerId: string
}

export type DebtInvoiceSource = {
  id: string
  amount: { toNumber(): number }
  currency: string
  dueDate: Date
  status: DebtStatus
  invoiceNumber: string | null
  clientId: string
  client: {
    id: string
    fullName: string
    email: string | null
    phone: string | null
  }
  campaign: {
    id: string
    name: string
  }
}

function getStripeInvoiceIdempotencyKey(debtId: string) {
  return `collectra:stripe-invoice:${debtId}`
}

function isDeletedStripeResource(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || !('deleted' in value)) {
    return false
  }

  return (value as { deleted?: unknown }).deleted === true
}

async function getOrCreateStripeCustomer(
  stripe: StripeClient,
  debt: DebtInvoiceSource,
): Promise<StripeCustomer> {
  const email = debt.client.email?.trim()
  const customerList = email
    ? await stripe.customers.list({
        email,
        limit: 100,
      })
    : { data: [] as StripeCustomerListItem[] }

  const existingCustomer = customerList.data.find((customer) => !isDeletedStripeResource(customer))
  if (existingCustomer !== undefined) {
    return existingCustomer
  }

  return stripe.customers.create(
    {
      name: debt.client.fullName,
      email: email || undefined,
      phone: debt.client.phone || undefined,
      metadata: {
        debtId: debt.id,
        clientId: debt.clientId,
        campaignId: debt.campaign.id,
        source: 'collectra_debt_invoice',
      },
    },
    {
      idempotencyKey: `collectra:stripe-customer:${debt.id}`,
    },
  )
}

async function findStripeInvoiceForDebt(
  stripe: StripeClient,
  customers: StripeCustomer[],
  debtId: string,
): Promise<StripeInvoice | null> {
  for (const customer of customers) {
    const invoices = await stripe.invoices.list({
      customer: customer.id,
      limit: 100,
    })

    const existingInvoice = invoices.data.find((invoice) => invoice.metadata?.debtId === debtId)
    if (existingInvoice) {
      return existingInvoice
    }
  }

  return null
}

async function addDebtAmountToStripeInvoice(
  stripe: StripeClient,
  invoiceId: string,
  customerId: string,
  debt: DebtInvoiceSource,
): Promise<StripeInvoiceItem> {
  const amount = debt.amount.toNumber()
  const currency = normalizeStripeCurrency(debt.currency)

  return stripe.invoiceItems.create(
    {
      customer: customerId,
      invoice: invoiceId,
      currency,
      amount: Math.round(amount * 100),
      description: `Debt repayment for ${debt.campaign.name}`,
      metadata: {
        debtId: debt.id,
        clientId: debt.clientId,
        campaignId: debt.campaign.id,
        source: 'collectra_debt_invoice_item',
      },
    },
    {
      idempotencyKey: `collectra:stripe-invoice-item:${debt.id}:${invoiceId}`,
    },
  )
}

export async function createOrReuseStripeInvoiceForDebt(
  debt: DebtInvoiceSource,
): Promise<StripeInvoiceDetails | null> {
  const stripe = getStripeClient()
  const amount = debt.amount.toNumber()

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new HTTPException(400, {
      message: 'Debt amount is invalid for Stripe invoice creation',
    })
  }

  const customers: StripeCustomer[] =
    debt.client.email?.trim()
      ? (
          await stripe.customers.list({
            email: debt.client.email.trim(),
            limit: 100,
          })
        ).data.filter((customer) => !isDeletedStripeResource(customer))
      : []

  if (customers.length === 0) {
    customers.push(await getOrCreateStripeCustomer(stripe, debt))
  }

  const customer = customers[0]
  if (!customer) {
    throw new HTTPException(500, {
      message: 'Failed to create or retrieve Stripe customer',
    })
  }

  const existingInvoice = await findStripeInvoiceForDebt(stripe, customers, debt.id)
  if (existingInvoice) {
    const invoiceNumber = existingInvoice.number ?? debt.invoiceNumber ?? buildInvoiceNumber(debt.id)

    if (existingInvoice.status !== 'paid') {
      if ((existingInvoice.total ?? 0) === 0) {
        await addDebtAmountToStripeInvoice(stripe, existingInvoice.id, customer.id, debt)
      }

      const finalizedInvoice =
        existingInvoice.status === 'draft'
          ? await stripe.invoices.finalizeInvoice(existingInvoice.id)
          : existingInvoice

      const paidInvoice =
        finalizedInvoice.status === 'paid'
          ? finalizedInvoice
          : await stripe.invoices.pay(finalizedInvoice.id, {
              paid_out_of_band: true,
            })

      return {
        invoiceId: paidInvoice.id,
        invoiceNumber: paidInvoice.number ?? invoiceNumber,
        hostedInvoiceUrl: paidInvoice.hosted_invoice_url ?? null,
        invoicePdfUrl: paidInvoice.invoice_pdf ?? null,
        customerId: paidInvoice.customer as string,
      }
    }

    return {
      invoiceId: existingInvoice.id,
      invoiceNumber,
      hostedInvoiceUrl: existingInvoice.hosted_invoice_url ?? null,
      invoicePdfUrl: existingInvoice.invoice_pdf ?? null,
      customerId: existingInvoice.customer as string,
    }
  }

  const createdInvoice = await stripe.invoices.create(
    {
      customer: customer.id,
      currency: normalizeStripeCurrency(debt.currency),
      collection_method: 'send_invoice',
      auto_advance: false,
      days_until_due: 0,
      pending_invoice_items_behavior: 'exclude',
      metadata: {
        debtId: debt.id,
        clientId: debt.clientId,
        campaignId: debt.campaign.id,
        source: 'collectra_debt_invoice',
      },
    },
    {
      idempotencyKey: getStripeInvoiceIdempotencyKey(debt.id),
    },
  )

  await addDebtAmountToStripeInvoice(stripe, createdInvoice.id, customer.id, debt)

  const finalizedInvoice =
    createdInvoice.status === 'draft' ? await stripe.invoices.finalizeInvoice(createdInvoice.id) : createdInvoice

  const paidInvoice =
    finalizedInvoice.status === 'paid'
      ? finalizedInvoice
      : await stripe.invoices.pay(finalizedInvoice.id, {
          paid_out_of_band: true,
        })

  return {
    invoiceId: paidInvoice.id,
    invoiceNumber: paidInvoice.number ?? debt.invoiceNumber ?? buildInvoiceNumber(debt.id),
    hostedInvoiceUrl: paidInvoice.hosted_invoice_url ?? null,
    invoicePdfUrl: paidInvoice.invoice_pdf ?? null,
    customerId: customer.id,
  }
}

async function getStoredCheckoutSessionIdForDebt(
  prisma: PrismaClient,
  debtId: string,
  pendingStripeSessionId?: string | null,
) {
  if (pendingStripeSessionId) {
    return pendingStripeSessionId
  }

  const paymentConfirmation = await prisma.customerActionHistory.findFirst({
    where: {
      debtId,
      actionType: 'PAYMENT_CONFIRMED',
    },
    orderBy: { timestamp: 'desc' },
    select: { metadata: true },
  })

  const metadata = paymentConfirmation?.metadata as
    | {
        stripe?: {
          sessionId?: string | null
        } | null
      }
    | null

  return metadata?.stripe?.sessionId ?? null
}

async function getStripeReceiptUrlForCheckoutSession(stripe: StripeClient, sessionId: string) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['payment_intent.latest_charge'],
  })

  const paymentIntent = session.payment_intent
  if (!paymentIntent || typeof paymentIntent === 'string') {
    return null
  }

  const latestCharge = paymentIntent.latest_charge
  if (!latestCharge || typeof latestCharge === 'string') {
    return null
  }

  return latestCharge.receipt_url ?? null
}

export async function resolvePaidDebtStripeInvoiceUrl(
  prisma: PrismaClient,
  debt: DebtInvoiceSource & { pendingStripeSessionId?: string | null },
) {
  try {
    const stripeInvoice = await createOrReuseStripeInvoiceForDebt(debt)
    const invoiceUrl = stripeInvoice?.hostedInvoiceUrl ?? stripeInvoice?.invoicePdfUrl ?? null
    if (invoiceUrl) {
      return invoiceUrl
    }
  } catch (error) {
    logger.warn(
      {
        debtId: debt.id,
        error: error instanceof Error ? error.message : String(error),
        scope: 'debts.resolvePaidDebtStripeInvoiceUrl.createOrReuseStripeInvoiceForDebt',
      },
      'Stripe invoice creation failed; trying checkout receipt fallback',
    )
  }

  try {
    const stripe = getStripeClient()
    const sessionId = await getStoredCheckoutSessionIdForDebt(
      prisma,
      debt.id,
      debt.pendingStripeSessionId,
    )

    if (sessionId) {
      const receiptUrl = await getStripeReceiptUrlForCheckoutSession(stripe, sessionId)
      if (receiptUrl) {
        return receiptUrl
      }
    }
  } catch (error) {
    logger.warn(
      {
        debtId: debt.id,
        error: error instanceof Error ? error.message : String(error),
        scope: 'debts.resolvePaidDebtStripeInvoiceUrl.checkoutReceiptFallback',
      },
      'Stripe checkout receipt lookup failed',
    )
  }

  throw new HTTPException(503, {
    message: 'Stripe invoice is not available yet. Please try again in a moment.',
  })
}

async function sendInvoiceEmailToBrevo(options: {
  toEmail: string
  toName: string
  invoiceNumber: string
  invoiceUrl: string
  invoicePdfUrl: string | null
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
        htmlContent: `<!doctype html>
<html lang="en">
  <body style="font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 24px; background: #f6f7fb; color: #111827;">
    <div style="max-width: 640px; margin: 0 auto; background: #fff; border: 1px solid #e5e7eb; border-radius: 18px; padding: 28px;">
      <p style="margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.08em; font-size: 12px; color: #6b7280;">Collectra</p>
      <h1 style="margin: 0 0 12px; font-size: 28px;">Payment receipt ready</h1>
      <p style="margin: 0 0 16px; color: #374151;">Your Collectra receipt for invoice ${escapeHtml(options.invoiceNumber)} is ready.</p>
      <p style="margin: 0 0 18px;"><a href="${escapeHtml(options.invoiceUrl)}" style="display: inline-block; background: #7a3340; color: #fff; text-decoration: none; font-weight: 700; padding: 12px 16px; border-radius: 999px;">View receipt</a></p>
      ${options.invoicePdfUrl ? `<p style="margin: 0 0 12px;"><a href="${escapeHtml(options.invoicePdfUrl)}" style="color: #7a3340;">Download receipt</a></p>` : ''}
      <p style="margin: 0; font-size: 12px; color: #6b7280;">Keep this invoice for your records.</p>
    </div>
  </body>
</html>`,
        textContent: [
          `Your Collectra receipt ${options.invoiceNumber} is ready.`,
          `Open it here: ${options.invoiceUrl}`,
          ...(options.invoicePdfUrl ? [`Download: ${options.invoicePdfUrl}`] : []),
        ].join('\n'),
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
  currency?: string
  dueDate: Date
  status?: DebtStatus
  promiseDate?: Date | null
}

export type UpdateDebtInput = Partial<{
  amount: number
  currency: string
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

  private async checkAndUpdateOverdueStatus<
    T extends {
      id: string
      clientId: string
      status: DebtStatus
      promiseDate: Date | null
      dueDate?: Date
      client?: {
        fullName: string
        email: string | null
      } | null
      campaign?: {
        id: string
        name: string
      } | null
      amount?: { toNumber(): number }
    },
  >(debt: T): Promise<T> {
    const dueDate = debt.dueDate
    if (!dueDate) {
      return debt
    }

    const result = await transitionDebtToOverdue(this.prisma, {
      id: debt.id,
      clientId: debt.clientId,
      amount: debt.amount ?? { toNumber: () => 0 },
      dueDate,
      promiseDate: debt.promiseDate ?? null,
      status: debt.status,
      client: debt.client ?? { fullName: '', email: null },
      campaign: debt.campaign ?? { id: '', name: '' },
    })

    if (result.transitioned) {
      return {
        ...debt,
        status: 'OVERDUE_AFTER_PROMISE',
      } as T
    }

    return debt
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
      include: { client: true, campaign: { include: { workspace: true } } },
    })

    if (!debt) {
      throw new HTTPException(404, { message: 'Debt link is invalid or expired' })
    }

    // Check if debt should be marked as overdue
    const updatedDebt = await this.checkAndUpdateOverdueStatus(debt)

    return { debt: updatedDebt, tokenExpiresAt }
  }

  async createPromiseByCustomerToken(token: string, promisedDateInput: string | Date) {
    const { debt } = await this.getByCustomerToken(token)

    const raw =
      promisedDateInput instanceof Date ? promisedDateInput.toISOString() : promisedDateInput
    const normalizedPromisedDate = parsePromisedDateInput(raw)
    if (!normalizedPromisedDate) {
      throw new HTTPException(400, { message: 'Invalid promise date' })
    }

    const todayDay = utcCalendarDayStart(new Date())
    const dueDay = utcCalendarDayStart(debt.dueDate)
    const dueNotPassed = dueDay.getTime() >= todayDay.getTime()

    if (normalizedPromisedDate.getTime() < todayDay.getTime()) {
      throw new HTTPException(400, { message: 'Promise date cannot be in the past' })
    }

    if (dueNotPassed && normalizedPromisedDate.getTime() > dueDay.getTime()) {
      throw new HTTPException(400, { message: 'Promise date must be on or before due date' })
    }

    const [updatedDebt, paymentPromise] = await this.prisma.$transaction([
      this.prisma.debtRecord.update({
        where: { id: debt.id },
        data: {
          promiseDate: normalizedPromisedDate,
          status: 'PROMISE_TO_PAY',
          prePromiseDueReminderSentFor: null,
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
        metadata: toPrismaMetadata({
          promiseId: paymentPromise.id,
          promisedDate: normalizedPromisedDate.toISOString(),
          channel: 'public_link',
        }),
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
        message: 'This debt is overdue and can no longer be paid online',
      })
    }

    assertCustomerPaymentAllowed(debt)

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
      await createOrReuseStripeInvoiceForDebt(updatedDebt as unknown as DebtInvoiceSource)

      if (debt.client.email) {
        const invoiceBaseUrl = resolvePublicApiUrl().replace(/\/$/, '')
        const invoiceUrl = `${invoiceBaseUrl}/api/v1/public/debts/${encodeURIComponent(token)}/invoice`

        await sendInvoiceEmailToBrevo({
          toEmail: debt.client.email,
          toName: debt.client.fullName,
          invoiceUrl,
          invoicePdfUrl: `${invoiceUrl}?download=1`,
          invoiceNumber: updatedDebt.invoiceNumber ?? buildInvoiceNumber(updatedDebt.id),
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

    assertCustomerPaymentAllowed(debt)

    const amount = debt.amount.toNumber()
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new HTTPException(400, {
        message: 'Debt amount is invalid for Stripe payment',
      })
    }

    const stripe = getStripeClient()
    const currency = assertStripeCheckoutCurrency(debt.currency)
    const unitAmount = Math.round(amount * 100)

    try {
      if (debt.pendingStripeSessionId) {
        try {
          const pendingSession = await stripe.checkout.sessions.retrieve(debt.pendingStripeSessionId)

          if (pendingSession.status === 'open' && pendingSession.url) {
            return {
              sessionId: pendingSession.id,
              checkoutUrl: pendingSession.url,
            }
          }

          if (pendingSession.status === 'complete' || pendingSession.payment_status === 'paid') {
            throw new HTTPException(400, {
              message: 'This payment has already been completed. Please refresh the page.',
            })
          }
        } catch (error) {
          if (error instanceof HTTPException) {
            throw error
          }

          await this.prisma.debtRecord.update({
            where: { id: debt.id },
            data: {
              pendingStripeSessionId: null,
            },
          })
        }
      }

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
    } catch (error) {
      throw toStripeHttpException(error)
    }
  }

  async confirmStripePaymentByDebtId(debtId: string, input: ConfirmStripePaymentInput) {
    const fullDebt = await this.prisma.debtRecord.findUnique({
      where: { id: debtId },
      include: { client: true, campaign: true },
    })

    if (!fullDebt) {
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

    const wasAlreadyPaid = fullDebt.status === 'PAID'

    let stripeInvoice: StripeInvoiceDetails | null = null
    try {
      stripeInvoice = await createOrReuseStripeInvoiceForDebt(fullDebt)
    } catch (error) {
      logger.warn(
        {
          debtId,
          error: error instanceof Error ? error.message : String(error),
          scope: 'debts.confirmStripePaymentByDebtId.stripeInvoice',
        },
        'Stripe invoice creation failed; payment confirmation will continue',
      )
    }

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
          invoiceNumber:
            stripeInvoice?.invoiceNumber ?? debt.invoiceNumber ?? buildInvoiceNumber(debt.id),
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
              invoice: stripeInvoice,
            },
          },
        },
      })

      return paidDebt
    })

    if (updatedDebt && updatedDebt.status === 'PAID' && fullDebt.client.email) {
      const invoiceEmailAlreadyLogged = await this.prisma.brevoEventLog.findFirst({
        where: {
          debtId: fullDebt.id,
          source: 'stripe_payment_confirmation',
          eventName: 'invoice_sent',
        },
      })

      if (invoiceEmailAlreadyLogged || wasAlreadyPaid) {
        return updatedDebt
      }

      try {
        const { token } = await signCustomerToken(fullDebt.id)
        const invoiceBaseUrl = (env.API_URL ?? env.WEB_URL ?? 'https://collectra.xyz').replace(/\/$/, '')
        const invoiceDownloadUrl = `${invoiceBaseUrl}/api/v1/public/debts/${encodeURIComponent(token)}/invoice`

        await sendInvoiceEmailToBrevo({
          toEmail: fullDebt.client.email,
          toName: fullDebt.client.fullName,
          invoiceNumber: stripeInvoice?.invoiceNumber ?? updatedDebt.invoiceNumber ?? buildInvoiceNumber(fullDebt.id),
          invoiceUrl: invoiceDownloadUrl,
          invoicePdfUrl: `${invoiceDownloadUrl}?download=1`,
          debtId: fullDebt.id,
          campaignId: fullDebt.campaign.id,
        })

        await logBrevoEvent(this.prisma, {
          debtId: fullDebt.id,
          customerId: fullDebt.clientId,
          provider: 'brevo',
          source: 'stripe_payment_confirmation',
          eventName: 'invoice_sent',
          email: fullDebt.client.email,
        })
      } catch (error) {
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
      link: `${resolvePublicWebUrl()}/client/view?token=${encodeURIComponent(token)}`,
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

    // Check if debt should be marked as overdue (either promise date or due date)
    const updatedDebt = await this.checkAndUpdateOverdueStatus(debt)

    return updatedDebt
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

    return this.prisma.debtRecord.create({
      data: {
        ...data,
        currency: normalizeStripeCurrency(data.currency),
      },
    })
  }

  async update(workspaceId: string, id: string, data: UpdateDebtInput) {
    const existing = await this.getById(workspaceId, id)

    let clearReminder = false
    if (data.promiseDate !== undefined) {
      const nextStart = data.promiseDate ? utcCalendarDayStart(data.promiseDate) : null
      const prevStart = existing.promiseDate ? utcCalendarDayStart(existing.promiseDate) : null
      const prevMs = prevStart?.getTime() ?? null
      const nextMs = nextStart?.getTime() ?? null
      clearReminder = prevMs !== nextMs
    }

    return this.prisma.debtRecord.update({
      where: { id },
      data: clearReminder
        ? {
            ...data,
            ...(data.currency ? { currency: normalizeStripeCurrency(data.currency) } : {}),
            prePromiseDueReminderSentFor: null,
          }
        : {
            ...data,
            ...(data.currency ? { currency: normalizeStripeCurrency(data.currency) } : {}),
          },
      include: { client: true },
    })
  }
}