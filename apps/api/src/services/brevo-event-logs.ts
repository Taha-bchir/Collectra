import { randomUUID } from 'node:crypto'

import { PrismaClient } from '@repo/database'
import { logger } from '../utils/logger.js'

export type BrevoEventLogStatus = 'created' | 'skipped'

export type BrevoEventLogInput = {
  provider: string
  source: string
  eventName: string
  status?: BrevoEventLogStatus
  email?: string | null
  messageId?: string | null
  debtId?: string | null
  customerId?: string | null
  campaignId?: string | null
  occurredAt?: Date | null
  payload?: unknown
  resolutionStrategy?: string | null
  skipReason?: string | null
}

export type CampaignBrevoStats = {
  sent: number
  opened: number
  clicked: number
  other: number
  total: number
  uniqueDebts: number
  uniqueCustomers: number
  lastEventAt: Date | null
}

type CustomerActionHistoryRow = {
  actionType: string
  debtId: string | null
  customerId: string
  timestamp: Date
  metadata: unknown
}

function buildEmptyStats(): CampaignBrevoStats {
  return {
    sent: 0,
    opened: 0,
    clicked: 0,
    other: 0,
    total: 0,
    uniqueDebts: 0,
    uniqueCustomers: 0,
    lastEventAt: null,
  }
}

function aggregateActionHistoryStats(rows: CustomerActionHistoryRow[]): CampaignBrevoStats {
  const stats = buildEmptyStats()
  const debts = new Set<string>()
  const customers = new Set<string>()

  stats.total = rows.length

  for (const row of rows) {
    const actionType = row.actionType.toUpperCase()
    const metadata = toMetadataObject(row.metadata)
    const eventName = getMetadataString(metadata.event)?.toLowerCase()
    const channel = getMetadataString(metadata.channel)?.toLowerCase()

    if (actionType === 'EMAIL_SENT' || actionType === 'LINK_SENT') {
      stats.sent += 1
    } else if (actionType === 'LINK_CLICKED' || eventName === 'link_clicked') {
      stats.clicked += 1
    } else {
      stats.other += 1
    }

    if (row.debtId) debts.add(row.debtId)
    if (row.customerId) customers.add(row.customerId)
    if (!stats.lastEventAt || row.timestamp > stats.lastEventAt) {
      stats.lastEventAt = row.timestamp
    }
  }

  stats.uniqueDebts = debts.size
  stats.uniqueCustomers = customers.size

  return stats
}

function isMissingBrevoEventLogInfra(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()
  const mentionsBrevoTable = message.includes('brevoeventlog')
  const isMissingTable = message.includes('does not exist') || message.includes('relation')
  const isMissingColumn = message.includes('column') && message.includes('does not exist')

  return mentionsBrevoTable && (isMissingTable || isMissingColumn)
}

function normalizeUuid(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  return isUuid(value) ? value : null
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function toMetadataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function getMetadataString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

async function getCampaignStatsFromActionHistory(
  prisma: PrismaClient,
  campaignId: string
): Promise<CampaignBrevoStats> {
  const rows = await prisma.customerActionHistory.findMany({
    where: {
      debt: {
        campaignId,
      },
    },
    select: {
      actionType: true,
      debtId: true,
      customerId: true,
      timestamp: true,
      metadata: true,
    },
    orderBy: {
      timestamp: 'desc',
    },
  })

  return aggregateActionHistoryStats(rows)
}

export async function logBrevoEvent(prisma: PrismaClient, input: BrevoEventLogInput) {
  const id = randomUUID()
  const payloadJson = JSON.stringify(input.payload ?? null)
  const occurredAt = input.occurredAt ?? new Date()
  const debtId = normalizeUuid(input.debtId)
  const customerId = normalizeUuid(input.customerId)
  const campaignId = normalizeUuid(input.campaignId)

  try {
    await prisma.$executeRaw`
      INSERT INTO "BrevoEventLog" (
        "id",
        "provider",
        "source",
        "status",
        "eventName",
        "email",
        "messageId",
        "debtId",
        "customerId",
        "campaignId",
        "occurredAt",
        "payload",
        "resolutionStrategy",
        "skipReason"
      ) VALUES (
        ${id}::uuid,
        ${input.provider},
        ${input.source},
        ${input.status ?? 'created'},
        ${input.eventName},
        ${input.email ?? null},
        ${input.messageId ?? null},
        ${debtId}::uuid,
        ${customerId}::uuid,
        ${campaignId}::uuid,
        ${occurredAt},
        ${payloadJson}::jsonb,
        ${input.resolutionStrategy ?? null},
        ${input.skipReason ?? null}
      )
    `
  } catch (error) {
    if (!isMissingBrevoEventLogInfra(error)) {
      throw error
    }

    logger.warn(
      {
        eventName: input.eventName,
        source: input.source,
        error,
      },
      'Skipping BrevoEventLog insert because BrevoEventLog infrastructure is unavailable'
    )
  }
}

export async function getCampaignBrevoStats(prisma: PrismaClient, campaignId: string): Promise<CampaignBrevoStats> {
  try {
    const rows = await prisma.$queryRaw<
      Array<{
        eventName: string
        debtId: string | null
        customerId: string | null
        occurredAt: Date
        source: string | null
      }>
    >`
      SELECT
        "eventName",
        "debtId",
        "customerId",
        "occurredAt",
        "source"
      FROM "BrevoEventLog"
      WHERE "campaignId" = ${campaignId}::uuid
        AND "status" = 'created'
    `

    const stats = buildEmptyStats()
    const debts = new Set<string>()
    const customers = new Set<string>()

    stats.total = rows.length

    for (const row of rows) {
      const event = row.eventName.toLowerCase()
      const source = row.source?.toLowerCase() ?? null

      if (event.includes('sent')) {
        stats.sent += 1
      } else if (event.includes('click') || source === 'public_link') {
        stats.clicked += 1
      } else {
        stats.other += 1
      }

      if (row.debtId) debts.add(row.debtId)
      if (row.customerId) customers.add(row.customerId)
      if (!stats.lastEventAt || row.occurredAt > stats.lastEventAt) {
        stats.lastEventAt = row.occurredAt
      }
    }

    stats.uniqueDebts = debts.size
    stats.uniqueCustomers = customers.size

    return stats
  } catch (error) {
    if (!isMissingBrevoEventLogInfra(error)) {
      throw error
    }

    logger.warn(
      {
        campaignId,
        error,
      },
      'BrevoEventLog is unavailable, falling back to CustomerActionHistory stats aggregation'
    )

    return getCampaignStatsFromActionHistory(prisma, campaignId)
  }
}