import { DebtStatus, PrismaClient } from '@repo/database'
import { HTTPException } from 'hono/http-exception'
import type { Prisma } from '@repo/database'

export type CustomerListOptions = {
  search?: string
  limit?: number
  offset?: number
}

export type CustomerDebtListOptions = {
  status?: DebtStatus
  clicked?: boolean
  search?: string
  campaignId?: string
  page?: number
  limit?: number
}

export type CustomerDebtSummary = {
  id: string
  campaignId: string
  campaignName: string
  amount: number
  dueDate: Date
  promiseDate: Date | null
  status: DebtStatus
  linkOpenCount: number
  linkOpenTimes: Date[]
  createdAt: Date
  updatedAt: Date
}

export type CustomerPaymentPromiseSummary = {
  id: string
  debtId: string
  promisedDate: Date
  status: 'ACTIVE' | 'KEPT' | 'BROKEN' | 'CANCELLED'
  createdAt: Date
  updatedAt: Date
}

export type CustomerDebtDetails = {
  id: string
  campaignId: string
  campaignName: string
  amount: number
  dueDate: Date
  promiseDate: Date | null
  status: DebtStatus
  createdAt: Date
  updatedAt: Date
  promises: CustomerPaymentPromiseSummary[]
}

export type CustomerActionHistoryEntry = {
  id: string
  debtId: string | null
  customerId: string
  actionType:
    | 'LINK_SENT'
    | 'LINK_CLICKED'
    | 'PROMISE_MADE'
    | 'PROMISE_UPDATED'
    | 'PAYMENT_CONFIRMED'
    | 'STATUS_CHANGED'
    | 'NOTE_ADDED'
    | 'EMAIL_SENT'
    | 'SMS_SENT'
    | 'PHONE_CALL'
    | 'OTHER'
  timestamp: Date
  performedBy: string | null
  metadata: unknown
  createdAt: Date
}

export type CustomerWithDetails = {
  id: string
  fullName: string
  email: string | null
  phone: string | null
  address: string | null
  createdAt: Date
  updatedAt: Date
  debts: CustomerDebtDetails[]
  actionHistory: CustomerActionHistoryEntry[]
}

export type CustomerTrackingStatus =
  | 'SENT'
  | 'CLICKED'
  | 'SPAM'

export type CustomerTrackingEvent = {
  id: string
  debtId: string | null
  timestamp: Date
  actionType: CustomerActionHistoryEntry['actionType']
  eventName: string | null
  channel: string | null
  metadata: unknown
}

export type CustomerDebtTracking = {
  debtId: string
  campaignId: string
  campaignName: string
  debtStatus: DebtStatus
  sentCount: number
  deliveredCount: number
  openedCount: number
  clickedCount: number
  spamCount: number
  bouncedCount: number
  unsubscribedCount: number
  publicLinkVisitCount: number
  notSent: boolean
  notSeen: boolean
  status: CustomerTrackingStatus
  lastEventAt: Date | null
  lastSeenAt: Date | null
  events: CustomerTrackingEvent[]
}

export type CustomerCommunicationTracking = {
  customerId: string
  summary: {
    totalDebts: number
    sentDebts: number
    notSentDebts: number
    deliveredCount: number
    openedCount: number
    clickedCount: number
    spamCount: number
    bouncedCount: number
    unsubscribedCount: number
    publicLinkVisitCount: number
    lastEventAt: Date | null
  }
  debts: CustomerDebtTracking[]
}

export type CustomerWithDebtSummary = {
  customer: {
    id: string
    fullName: string
    email: string | null
    phone: string | null
    address: string | null
    createdAt: Date
    updatedAt: Date
  }
  debt: CustomerDebtSummary
}

export type CustomerDebtListPagination = {
  page: number
  limit: number
  total: number
  totalPages: number
}

export type CreateCustomerInput = {
  fullName: string
  email?: string
  phone?: string
  address?: string
}

export type UpdateCustomerInput = Partial<{
  fullName: string
  email?: string | null
  phone?: string | null
  address?: string | null
}>

export class CustomersService {
  constructor(private readonly prisma: PrismaClient) {}

  async listWithDebtSummary(workspaceId: string, options: CustomerDebtListOptions = {}) {
    const limit = clampLimit(options.limit)
    const search = normalizeSearch(options.search)
    const page = Math.max(Math.floor(options.page ?? 1), 1)

    const debtWhere: Prisma.DebtRecordWhereInput = {
      campaign: { workspaceId },
      ...(options.status ? { status: options.status } : {}),
      ...(options.clicked ? { actionHistory: { some: { actionType: 'LINK_CLICKED' } } } : {}),
      ...(options.campaignId ? { campaignId: options.campaignId } : {}),
      ...(search
        ? {
            client: {
              workspaceId,
              OR: [
                { fullName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            },
          }
        : {
            client: {
              workspaceId,
            },
          }),
    }

    const total = await this.prisma.debtRecord.count({ where: debtWhere })
    const totalPages = Math.max(1, Math.ceil(total / limit))
    const safePage = Math.min(page, totalPages)
    const skip = (safePage - 1) * limit

    const debts = await this.prisma.debtRecord.findMany({
      where: debtWhere,
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
      skip,
      select: {
        id: true,
        clientId: true,
        campaignId: true,
        amount: true,
        dueDate: true,
        promiseDate: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        client: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            address: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        campaign: {
          select: {
            name: true,
          },
        },
        actionHistory: {
          where: {
            actionType: 'LINK_CLICKED',
          },
          orderBy: {
            timestamp: 'desc',
          },
          select: {
            timestamp: true,
          },
        },
      },
    })

    return {
      data: debts.map((debt) => ({
        customer: {
          id: debt.client.id,
          fullName: debt.client.fullName,
          email: debt.client.email,
          phone: debt.client.phone,
          address: debt.client.address,
          createdAt: debt.client.createdAt,
          updatedAt: debt.client.updatedAt,
        },
        debt: {
          id: debt.id,
          campaignId: debt.campaignId,
          campaignName: debt.campaign.name,
          amount: debt.amount.toNumber(),
          dueDate: debt.dueDate,
          promiseDate: debt.promiseDate,
          status: debt.status,
          linkOpenCount: debt.actionHistory.length,
          linkOpenTimes: debt.actionHistory.map((entry) => entry.timestamp),
          createdAt: debt.createdAt,
          updatedAt: debt.updatedAt,
        },
      })),
      pagination: {
        page: safePage,
        limit,
        total,
        totalPages,
      },
    }

  }

  async list(workspaceId: string, options: CustomerListOptions = {}) {
    const { search, limit = 50, offset = 0 } = options
    const safeLimit = Math.min(Math.max(limit, 1), 200)
    const safeOffset = Math.max(offset, 0)

    return this.prisma.client.findMany({
      where: {
        workspaceId,
        ...(search && {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
      orderBy: { fullName: 'asc' },
      take: safeLimit,
      skip: safeOffset,
    })
  }

  async getById(workspaceId: string, id: string) {
    const customer = await this.prisma.client.findUnique({
      where: { id },
    })

    if (!customer || customer.workspaceId !== workspaceId) {
      throw new HTTPException(404, { message: 'Customer not found or not in your workspace' })
    }

    return customer
  }

  async getByIdWithDetails(workspaceId: string, id: string): Promise<CustomerWithDetails> {
    const customer = await this.prisma.client.findFirst({
      where: {
        id,
        workspaceId,
      },
      include: {
        debts: {
          orderBy: {
            dueDate: 'asc',
          },
          include: {
            campaign: {
              select: {
                name: true,
              },
            },
            paymentPromises: {
              orderBy: {
                createdAt: 'desc',
              },
            },
          },
        },
        actionHistory: {
          orderBy: {
            timestamp: 'desc',
          },
        },
      },
    })

    if (!customer) {
      throw new HTTPException(404, { message: 'Customer not found or not in your workspace' })
    }

    return {
      id: customer.id,
      fullName: customer.fullName,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      debts: customer.debts.map((debt) => ({
        id: debt.id,
        campaignId: debt.campaignId,
        campaignName: debt.campaign.name,
        amount: debt.amount.toNumber(),
        dueDate: debt.dueDate,
        promiseDate: debt.promiseDate,
        status: debt.status,
        createdAt: debt.createdAt,
        updatedAt: debt.updatedAt,
        promises: debt.paymentPromises.map((promise) => ({
          id: promise.id,
          debtId: promise.debtId,
          promisedDate: promise.promisedDate,
          status: promise.status,
          createdAt: promise.createdAt,
          updatedAt: promise.updatedAt,
        })),
      })),
      actionHistory: customer.actionHistory.map((action) => ({
        id: action.id,
        debtId: action.debtId,
        customerId: action.customerId,
        actionType: action.actionType,
        timestamp: action.timestamp,
        performedBy: action.performedBy,
        metadata: action.metadata,
        createdAt: action.createdAt,
      })),
    }
  }

  async getCommunicationTracking(workspaceId: string, id: string): Promise<CustomerCommunicationTracking> {
    const customer = await this.prisma.client.findFirst({
      where: {
        id,
        workspaceId,
      },
      include: {
        debts: {
          orderBy: {
            dueDate: 'asc',
          },
          select: {
            id: true,
            campaignId: true,
            status: true,
            campaign: {
              select: {
                name: true,
              },
            },
          },
        },
        actionHistory: {
          orderBy: {
            timestamp: 'desc',
          },
          select: {
            id: true,
            debtId: true,
            actionType: true,
            timestamp: true,
            metadata: true,
          },
        },
      },
    })

    if (!customer) {
      throw new HTTPException(404, { message: 'Customer not found or not in your workspace' })
    }

    const trackingByDebtId = new Map<string, CustomerDebtTracking>()

    for (const debt of customer.debts) {
      trackingByDebtId.set(debt.id, {
        debtId: debt.id,
        campaignId: debt.campaignId,
        campaignName: debt.campaign.name,
        debtStatus: debt.status,
        sentCount: 0,
        deliveredCount: 0,
        openedCount: 0,
        clickedCount: 0,
        spamCount: 0,
        bouncedCount: 0,
        unsubscribedCount: 0,
        publicLinkVisitCount: 0,
        notSent: true,
        notSeen: false,
        status: 'SENT',
        lastEventAt: null,
        lastSeenAt: null,
        events: [],
      })
    }

    for (const action of customer.actionHistory) {
      if (!action.debtId) {
        continue
      }

      const debtTracking = trackingByDebtId.get(action.debtId)
      if (!debtTracking) {
        continue
      }

      const metadataRecord = toMetadataRecord(action.metadata)
      const eventName = getEventNameFromMetadata(metadataRecord)
      const channel = getChannelFromMetadata(metadataRecord)

      debtTracking.events.push({
        id: action.id,
        debtId: action.debtId,
        timestamp: action.timestamp,
        actionType: action.actionType,
        eventName,
        channel,
        metadata: action.metadata,
      })

      if (!debtTracking.lastEventAt || action.timestamp > debtTracking.lastEventAt) {
        debtTracking.lastEventAt = action.timestamp
      }

      if (isEmailSentEvent(action.actionType, eventName)) {
        debtTracking.sentCount += 1
      }

      if (isDeliveredEvent(eventName)) {
        debtTracking.deliveredCount += 1
      }

      const matchesOpenEvent = isOpenEvent(eventName)
      const matchesClickEvent = isClickEvent(action.actionType, eventName)

      // A click is a stronger engagement signal and should count toward opens for reporting.
      if (matchesOpenEvent || matchesClickEvent) {
        debtTracking.openedCount += 1
        if (!debtTracking.lastSeenAt || action.timestamp > debtTracking.lastSeenAt) {
          debtTracking.lastSeenAt = action.timestamp
        }
      }

      if (matchesClickEvent) {
        debtTracking.clickedCount += 1
        if (!debtTracking.lastSeenAt || action.timestamp > debtTracking.lastSeenAt) {
          debtTracking.lastSeenAt = action.timestamp
        }
      }

      if (isSpamEvent(eventName)) {
        debtTracking.spamCount += 1
      }

      if (isBounceEvent(eventName)) {
        debtTracking.bouncedCount += 1
      }

      if (isUnsubscribedEvent(eventName)) {
        debtTracking.unsubscribedCount += 1
      }

      if (isPublicLinkVisit(action.actionType, channel, eventName)) {
        debtTracking.publicLinkVisitCount += 1
      }
    }

    const debts = Array.from(trackingByDebtId.values()).map((debtTracking) => {
      debtTracking.notSent = debtTracking.sentCount === 0
      debtTracking.notSeen = debtTracking.sentCount > 0 && debtTracking.openedCount === 0 && debtTracking.clickedCount === 0
      debtTracking.status = resolveTrackingStatus(debtTracking)

      return debtTracking
    })

    let lastEventAt: Date | null = null
    for (const debt of debts) {
      if (debt.lastEventAt && (!lastEventAt || debt.lastEventAt > lastEventAt)) {
        lastEventAt = debt.lastEventAt
      }
    }

    return {
      customerId: customer.id,
      summary: {
        totalDebts: debts.length,
        sentDebts: debts.filter((debt) => debt.sentCount > 0 && debt.debtStatus !== DebtStatus.PAID).length,
        notSentDebts: debts.filter((debt) => debt.sentCount === 0 && debt.debtStatus !== DebtStatus.PAID).length,
        deliveredCount: debts.reduce((sum, debt) => sum + debt.deliveredCount, 0),
        openedCount: debts.reduce((sum, debt) => sum + debt.openedCount, 0),
        clickedCount: debts.reduce((sum, debt) => sum + debt.clickedCount, 0),
        spamCount: debts.reduce((sum, debt) => sum + debt.spamCount, 0),
        bouncedCount: debts.reduce((sum, debt) => sum + debt.bouncedCount, 0),
        unsubscribedCount: debts.reduce((sum, debt) => sum + debt.unsubscribedCount, 0),
        publicLinkVisitCount: debts.reduce((sum, debt) => sum + debt.publicLinkVisitCount, 0),
        lastEventAt,
      },
      debts,
    }
  }

  async create(workspaceId: string, data: CreateCustomerInput) {
    return this.prisma.client.create({
      data: {
        ...data,
        workspaceId,
      },
    })
  }

  async update(workspaceId: string, id: string, data: UpdateCustomerInput) {
    await this.getById(workspaceId, id)

    return this.prisma.client.update({
      where: { id },
      data,
    })
  }
}

function clampLimit(input?: number) {
  if (!input || Number.isNaN(input)) {
    return 25
  }

  return Math.min(Math.max(Math.floor(input), 1), 100)
}

function normalizeSearch(input?: string) {
  const trimmed = input?.trim()

  return trimmed && trimmed.length > 0 ? trimmed : undefined
}

function toMetadataRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function getEventNameFromMetadata(metadata: Record<string, unknown> | null): string | null {
  const value = metadata?.event
  return typeof value === 'string' && value.trim().length > 0 ? value.trim().toLowerCase() : null
}

function getChannelFromMetadata(metadata: Record<string, unknown> | null): string | null {
  const value = metadata?.channel
  return typeof value === 'string' && value.trim().length > 0 ? value.trim().toLowerCase() : null
}

function includesAny(value: string | null, needles: string[]): boolean {
  if (!value) {
    return false
  }

  return needles.some((needle) => value.includes(needle))
}

function isEmailSentEvent(actionType: CustomerActionHistoryEntry['actionType'], eventName: string | null): boolean {
  return actionType === 'EMAIL_SENT' || includesAny(eventName, ['sent'])
}

function isDeliveredEvent(eventName: string | null): boolean {
  return includesAny(eventName, ['deliver'])
}

function isOpenEvent(eventName: string | null): boolean {
  return includesAny(eventName, ['open'])
}

function isClickEvent(actionType: CustomerActionHistoryEntry['actionType'], eventName: string | null): boolean {
  return actionType === 'LINK_CLICKED' || includesAny(eventName, ['click'])
}

function isSpamEvent(eventName: string | null): boolean {
  return includesAny(eventName, ['spam', 'complaint'])
}

function isBounceEvent(eventName: string | null): boolean {
  return includesAny(eventName, ['bounce', 'blocked', 'invalid', 'deferred', 'error', 'dropped'])
}

function isUnsubscribedEvent(eventName: string | null): boolean {
  return includesAny(eventName, ['unsub'])
}

function isPublicLinkVisit(
  actionType: CustomerActionHistoryEntry['actionType'],
  channel: string | null,
  eventName: string | null,
): boolean {
  if (actionType !== 'LINK_CLICKED') {
    return false
  }

  if (channel === 'public_link') {
    return true
  }

  return includesAny(eventName, ['page_open', 'link_open'])
}

function resolveTrackingStatus(debtTracking: CustomerDebtTracking): CustomerTrackingStatus {
  if (debtTracking.spamCount > 0) {
    return 'SPAM'
  }

  if (debtTracking.clickedCount > 0) {
    return 'CLICKED'
  }

  return 'SENT'
}