import { PrismaClient } from '@repo/database'
import { HTTPException } from 'hono/http-exception'

import { env } from '../config/env.js'
import { logBrevoEvent } from './brevo-event-logs.js'

const BREVO_TRANSACTIONAL_LOGS_API_URL = 'https://api.brevo.com/v3/smtp/log'
const DEFAULT_LOOKBACK_DAYS = 90
const DEFAULT_PAGE_SIZE = 100
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

type BrevoTransactionalLogRow = Record<string, unknown>

type ResolveBrevoLogTarget = {
  campaignId: string | null
  debtId: string | null
  customerId: string | null
  strategy: 'debt_hint' | 'campaign_email_match' | 'campaign_only' | 'unresolved'
}

export type SyncBrevoCampaignLogsOptions = {
  lookbackDays?: number
  pageSize?: number
}

export type SyncBrevoCampaignLogsResult = {
  campaignId: string
  lookbackDays: number
  pageSize: number
  emailsScanned: number
  pagesFetched: number
  rowsFetched: number
  created: number
  deduplicated: number
  unresolved: number
}

export class BrevoTransactionalLogsService {
  constructor(private readonly prisma: PrismaClient) {}

  async syncCampaignLogs(
    campaignId: string,
    options: SyncBrevoCampaignLogsOptions = {}
  ): Promise<SyncBrevoCampaignLogsResult> {
    if (!env.BREVO_API_KEY) {
      throw new HTTPException(400, { message: 'BREVO_API_KEY is required to sync Brevo logs' })
    }

    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        workspaceId: true,
      },
    })

    if (!campaign) {
      throw new HTTPException(404, { message: 'Campaign not found' })
    }

    const lookbackDays = clampInteger(options.lookbackDays, 1, DEFAULT_LOOKBACK_DAYS, DEFAULT_LOOKBACK_DAYS)
    const pageSize = clampInteger(options.pageSize, 1, DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZE)

    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - lookbackDays * MILLISECONDS_PER_DAY)

    const debts = await this.prisma.debtRecord.findMany({
      where: {
        campaignId,
        client: {
          email: {
            not: null,
          },
        },
      },
      select: {
        id: true,
        createdAt: true,
        client: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    const emailIndex = buildEmailIndex(debts)
    const existingSignatures = await this.loadExistingSignatures(campaignId, startDate)

    let pagesFetched = 0
    let rowsFetched = 0
    let created = 0
    let deduplicated = 0
    let unresolved = 0

    for (const email of emailIndex.keys()) {
      let offset = 0

      while (true) {
        const page = await this.fetchTransactionalLogs({
          email,
          startDate,
          endDate,
          limit: pageSize,
          offset,
        })

        pagesFetched += 1

        const rows = normalizeLogRows(page)
        if (rows.length === 0) {
          break
        }

        rowsFetched += rows.length

        for (const row of rows) {
          const eventName = getEventName(row)
          const occurredAt = getEventTimestamp(row)
          const emailValue = getEmail(row)
          const messageId = getMessageId(row)
          const target = resolveTargetForCampaign(row, emailIndex, campaignId)

          if (!eventName || !emailValue || !occurredAt) {
            unresolved += 1
            continue
          }

          if (target.campaignId && target.campaignId !== campaignId) {
            unresolved += 1
            continue
          }

          const signature = buildSignature({
            provider: 'brevo',
            source: 'transactional_logs_api',
            eventName,
            email: emailValue,
            messageId,
            occurredAt,
            debtId: target.debtId,
            customerId: target.customerId,
            campaignId: target.campaignId,
          })

          if (existingSignatures.has(signature)) {
            deduplicated += 1
            continue
          }

          if (!target.campaignId) {
            unresolved += 1
            continue
          }

          existingSignatures.add(signature)

          await logBrevoEvent(this.prisma, {
            provider: 'brevo',
            source: 'transactional_logs_api',
            eventName,
            status: 'created',
            email: emailValue,
            messageId,
            debtId: target.debtId,
            customerId: target.customerId,
            campaignId: target.campaignId,
            occurredAt,
            payload: row,
            resolutionStrategy: target.strategy,
          })

          created += 1
        }

        if (rows.length < pageSize) {
          break
        }

        offset += rows.length
      }
    }

    return {
      campaignId,
      lookbackDays,
      pageSize,
      emailsScanned: emailIndex.size,
      pagesFetched,
      rowsFetched,
      created,
      deduplicated,
      unresolved,
    }
  }

  private async fetchTransactionalLogs(options: {
    email: string
    startDate: Date
    endDate: Date
    limit: number
    offset: number
  }): Promise<unknown> {
    const url = new URL(BREVO_TRANSACTIONAL_LOGS_API_URL)
    url.searchParams.set('email', options.email)
    url.searchParams.set('startDate', options.startDate.toISOString())
    url.searchParams.set('endDate', options.endDate.toISOString())
    url.searchParams.set('limit', String(options.limit))
    url.searchParams.set('offset', String(options.offset))

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'api-key': env.BREVO_API_KEY as string,
      },
    })

    if (!response.ok) {
      const body = await safeReadText(response)
      throw new HTTPException(response.status as any, {
        message: `Failed to fetch Brevo transactional logs: ${body || response.statusText}`,
      })
    }

    return response.json()
  }

  private async loadExistingSignatures(campaignId: string, startDate: Date): Promise<Set<string>> {
    const rows = await this.prisma.brevoEventLog.findMany({
      where: {
        campaignId,
        occurredAt: {
          gte: startDate,
        },
      },
      select: {
        provider: true,
        source: true,
        eventName: true,
        email: true,
        messageId: true,
        debtId: true,
        customerId: true,
        campaignId: true,
        occurredAt: true,
      },
    })

    const signatures = new Set<string>()
    for (const row of rows) {
      signatures.add(
        buildSignature({
          provider: row.provider,
          source: row.source,
          eventName: row.eventName,
          email: row.email,
          messageId: row.messageId,
          occurredAt: row.occurredAt,
          debtId: row.debtId,
          customerId: row.customerId,
          campaignId: row.campaignId,
        })
      )
    }

    return signatures
  }
}

function buildEmailIndex(
  debts: Array<{
    id: string
    createdAt: Date
    client: {
      id: string
      email: string | null
    }
  }>
): Map<string, Array<{ debtId: string; customerId: string }>> {
  const index = new Map<string, Array<{ debtId: string; customerId: string }>>()

  for (const debt of debts) {
    const email = debt.client.email?.trim().toLowerCase()
    if (!email) {
      continue
    }

    const entries = index.get(email) ?? []
    entries.push({
      debtId: debt.id,
      customerId: debt.client.id,
    })
    index.set(email, entries)
  }

  return index
}

function resolveTargetForCampaign(
  row: BrevoTransactionalLogRow,
  emailIndex: Map<string, Array<{ debtId: string; customerId: string }>>,
  requestedCampaignId: string
): ResolveBrevoLogTarget {
  const campaignIdFromPayload = getCampaignId(row)
  const debtIdFromPayload = getDebtId(row)
  const email = getEmail(row)?.toLowerCase()

  if (campaignIdFromPayload && campaignIdFromPayload !== requestedCampaignId) {
    return {
      campaignId: campaignIdFromPayload,
      debtId: null,
      customerId: null,
      strategy: 'campaign_only',
    }
  }

  if (debtIdFromPayload) {
    return {
      campaignId: campaignIdFromPayload ?? requestedCampaignId,
      debtId: debtIdFromPayload,
      customerId: null,
      strategy: 'debt_hint',
    }
  }

  if (email) {
    const candidates = emailIndex.get(email)
    if (candidates && candidates.length > 0) {
      const firstCandidate = candidates[0]!
      return {
        campaignId: campaignIdFromPayload ?? requestedCampaignId,
        debtId: firstCandidate.debtId,
        customerId: firstCandidate.customerId,
        strategy: 'campaign_email_match',
      }
    }
  }

  return {
    campaignId: campaignIdFromPayload ?? requestedCampaignId,
    debtId: null,
    customerId: null,
    strategy: 'campaign_only',
  }
}

function normalizeLogRows(payload: unknown): BrevoTransactionalLogRow[] {
  if (Array.isArray(payload)) {
    return payload.filter((value): value is BrevoTransactionalLogRow => Boolean(value) && typeof value === 'object')
  }

  if (!payload || typeof payload !== 'object') {
    return []
  }

  const candidate = payload as Record<string, unknown>
  const rows = candidate.data ?? candidate.logs ?? candidate.items ?? candidate.smtpLogs ?? candidate.smtpLogsList

  if (Array.isArray(rows)) {
    return rows.filter((value): value is BrevoTransactionalLogRow => Boolean(value) && typeof value === 'object')
  }

  return []
}

function getEventName(row: BrevoTransactionalLogRow): string | null {
  return getString(row.event) ?? getString(row.type) ?? getString(row.eventName) ?? 'unknown'
}

function getEventTimestamp(row: BrevoTransactionalLogRow): Date | null {
  const ts = row.ts ?? row.ts_event ?? row.timestamp ?? row.date

  if (typeof ts === 'number' && Number.isFinite(ts)) {
    return new Date(ts * 1000)
  }

  if (typeof ts === 'string') {
    const numeric = Number(ts)
    if (Number.isFinite(numeric) && numeric > 0) {
      return new Date(numeric * 1000)
    }

    const parsed = new Date(ts)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }

  return null
}

function getEmail(row: BrevoTransactionalLogRow): string | null {
  return getString(row.email) ?? getString(row.recipient) ?? getString(row.to)
}

function getMessageId(row: BrevoTransactionalLogRow): string | null {
  return (
    getString(row.messageId) ??
    getString(row['message-id']) ??
    getString(row.message_id) ??
    getString(row.id)
  )
}

function getCampaignId(row: BrevoTransactionalLogRow): string | null {
  const tags = getTags(row)
  for (const tag of tags) {
    const lower = tag.toLowerCase()
    if (lower.startsWith('campaign:')) {
      const maybeCampaignId = tag.slice(9)
      if (isUuid(maybeCampaignId)) {
        return maybeCampaignId
      }
    }
  }

  const directCampaignId = getString(row.campaignId) ?? getString(row.campaign_id)
  return directCampaignId && isUuid(directCampaignId) ? directCampaignId : null
}

function getDebtId(row: BrevoTransactionalLogRow): string | null {
  const tags = getTags(row)
  for (const tag of tags) {
    const lower = tag.toLowerCase()
    if (lower.startsWith('debt:')) {
      const maybeDebtId = tag.slice(5)
      if (isUuid(maybeDebtId)) {
        return maybeDebtId
      }
    }
  }

  const directDebtId = getString(row.debtId) ?? getString(row.debt_id)
  return directDebtId && isUuid(directDebtId) ? directDebtId : null
}

function getTags(row: BrevoTransactionalLogRow): string[] {
  const values: string[] = []
  const tagsValue = row.tags

  if (Array.isArray(tagsValue)) {
    for (const tag of tagsValue) {
      if (typeof tag === 'string' && tag.trim().length > 0) {
        values.push(tag.trim())
      }
    }
  }

  const tagValue = row.tag
  if (typeof tagValue === 'string' && tagValue.trim().length > 0) {
    values.push(...tagValue.split(',').map((value) => value.trim()).filter(Boolean))
  }

  const customHeader = getString(row['X-Mailin-custom']) ?? getString(row['x-mailin-custom'])
  if (customHeader) {
    for (const pair of customHeader.split(/[|,;&]/)) {
      const [rawKey, rawValue] = pair.split('=')
      if (!rawKey || !rawValue) {
        continue
      }

      const key = rawKey.trim().toLowerCase()
      const value = rawValue.trim()

      if (key === 'campaign_id' || key === 'campaignid' || key === 'debt_id' || key === 'debtid') {
        values.push(key.startsWith('campaign') ? `campaign:${value}` : `debt:${value}`)
      }
    }
  }

  return values
}

function buildSignature(input: {
  provider: string
  source: string
  eventName: string
  email: string | null
  messageId: string | null
  occurredAt: Date
  debtId: string | null
  customerId: string | null
  campaignId: string | null
}): string {
  return [
    input.provider,
    input.source,
    input.eventName.toLowerCase(),
    input.email ?? '',
    input.messageId ?? '',
    input.occurredAt.toISOString(),
    input.debtId ?? '',
    input.customerId ?? '',
    input.campaignId ?? '',
  ].join('|')
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function clampInteger(value: number | undefined, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback
  }

  const rounded = Math.floor(value as number)
  return Math.min(Math.max(rounded, min), max)
}

async function safeReadText(response: Response): Promise<string | null> {
  try {
    const text = await response.text()
    return text.trim().length > 0 ? text.trim() : null
  } catch {
    return null
  }
}