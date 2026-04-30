import { PrismaClient } from '@repo/database'
import { HTTPException } from 'hono/http-exception'
import type { DebtStatus } from '@repo/database'
import { env } from '../config/env.js'
import { logBrevoEvent } from './brevo-event-logs.js'
import { signCustomerToken, verifyCustomerToken } from '../lib/customer-jwt.js'
import { logger } from '../utils/logger.js'
import { getStripeClient, getStripeCurrency } from '../lib/stripe.js'

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
    const { debt } = await this.getByCustomerToken(token)

    if (debt.status !== 'PROMISE_TO_PAY') {
      throw new HTTPException(400, {
        message: 'Fake payment is only available for debts in PROMISE_TO_PAY status',
      })
    }

    const updatedDebt = await this.prisma.$transaction(async (tx) => {
      const paidDebt = await tx.debtRecord.update({
        where: { id: debt.id },
        data: {
          status: 'PAID',
        },
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

    return updatedDebt
  }

  async createStripeCheckoutSessionByCustomerToken(token: string) {
    const { debt } = await this.getByCustomerToken(token)

    if (debt.status !== 'PROMISE_TO_PAY') {
      throw new HTTPException(400, {
        message: 'Stripe payment is only available for debts in PROMISE_TO_PAY status',
      })
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

    const successUrl = `${env.WEB_URL}/client/view?token=${encodeURIComponent(token)}&payment=success`
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

    return {
      sessionId: session.id,
      checkoutUrl: session.url,
    }
  }

  async confirmStripePaymentByDebtId(debtId: string, input: ConfirmStripePaymentInput) {
    const updatedDebt = await this.prisma.$transaction(async (tx) => {
      const debt = await tx.debtRecord.findUnique({
        where: { id: debtId },
        include: {
          campaign: true,
        },
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
        data: {
          status: 'PAID',
        },
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