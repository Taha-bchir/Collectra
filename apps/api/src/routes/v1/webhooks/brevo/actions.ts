import { ActionType } from '@repo/database'
import { OpenAPIHono } from '@hono/zod-openapi'
import type { Env } from '../../../../types/index.js'
import { toPrismaMetadata } from '../../../../utils/metadata.js'
import { logger } from '../../../../utils/logger.js'
import { env } from '../../../../config/env.js'
import { verifyCustomerToken } from '../../../../lib/customer-jwt.js'
import { logBrevoEvent } from '../../../../services/brevo-event-logs.js'

const handler = new OpenAPIHono<Env>()

type BrevoEventPayload = Record<string, unknown>

type ResolvedEventTarget = {
  debtId: string
  customerId: string
  campaignId: string | null
  strategy:
    | 'debt_hint'
    | 'token_url'
    | 'customer_campaign_match'
    | 'recent_email_sent'
    | 'latest_debt'
}

type SkipReason =
  | 'invalid_payload'
  | 'missing_event_name'
  | 'ignored_event_type'
  | 'unable_to_resolve_target'

type DebugEventResult = {
  index: number
  eventName: string | null
  email: string | null
  debtIdHint: string | null
  campaignIdHint: string | null
  mappedActionType: ActionType | null
  status: 'created' | 'skipped'
  resolvedDebtId?: string
  resolvedCampaignId?: string | null
  resolutionStrategy?: ResolvedEventTarget['strategy']
  reason?: SkipReason
}

handler.post('/events', async (c) => {
  const configuredToken = env.BREVO_WEBHOOK_TOKEN ?? env.BREVO_WEBHOOK_SECRET
  if (configuredToken) {
    const providedToken = c.req.query('token')

    if (!providedToken || providedToken !== configuredToken) {
      return c.json({ error: 'Unauthorized webhook token' }, 401)
    }
  }

  const rawBody = await c.req.text()

  let parsedBody: unknown
  try {
    parsedBody = JSON.parse(rawBody)
  } catch {
    return c.json({ error: 'Invalid JSON payload' }, 400)
  }

  const events = Array.isArray(parsedBody) ? parsedBody : [parsedBody]
  const prisma = c.get('prisma')
  const debugEnabled = c.req.query('debug') === '1'

  const rowsToCreate: Array<{
    debtId: string
    customerId: string
    actionType: ActionType
    timestamp?: Date
    metadata: ReturnType<typeof toPrismaMetadata>
  }> = []
  const brevoLogsToCreate: Array<Parameters<typeof logBrevoEvent>[1]> = []

  let processed = 0
  let skipped = 0
  const skipReasons: Record<SkipReason, number> = {
    invalid_payload: 0,
    missing_event_name: 0,
    ignored_event_type: 0,
    unable_to_resolve_target: 0,
  }
  const debugEvents: DebugEventResult[] = []

  for (let index = 0; index < events.length; index += 1) {
    const entry = events[index]

    if (!entry || typeof entry !== 'object') {
      skipped += 1
      skipReasons.invalid_payload += 1
      brevoLogsToCreate.push({
        provider: 'brevo',
        source: 'webhook',
        eventName: 'invalid_payload',
        status: 'skipped',
        payload: entry,
        skipReason: 'invalid_payload',
      })
      if (debugEnabled) {
        debugEvents.push({
          index,
          eventName: null,
          email: null,
          debtIdHint: null,
          campaignIdHint: null,
          mappedActionType: null,
          status: 'skipped',
          reason: 'invalid_payload',
        })
      }
      continue
    }

    const payload = entry as BrevoEventPayload
    const eventName = getEventName(payload)
    const email = getEmail(payload)
    const debtIdHint = getDebtId(payload)
    const campaignIdHint = getCampaignId(payload)

    if (!eventName) {
      skipped += 1
      skipReasons.missing_event_name += 1
      brevoLogsToCreate.push({
        provider: 'brevo',
        source: 'webhook',
        eventName: 'missing_event_name',
        status: 'skipped',
        email,
        debtId: debtIdHint,
        campaignId: campaignIdHint,
        payload,
        skipReason: 'missing_event_name',
      })
      if (debugEnabled) {
        debugEvents.push({
          index,
          eventName,
          email,
          debtIdHint,
          campaignIdHint,
          mappedActionType: null,
          status: 'skipped',
          reason: 'missing_event_name',
        })
      }
      continue
    }

    const actionType = mapBrevoEventToActionType(eventName)
    if (!actionType) {
      // Ignore events that are not currently tracked in dashboard metrics.
      skipped += 1
      skipReasons.ignored_event_type += 1
      brevoLogsToCreate.push({
        provider: 'brevo',
        source: 'webhook',
        eventName,
        status: 'skipped',
        email,
        debtId: debtIdHint,
        campaignId: campaignIdHint,
        payload,
        skipReason: 'ignored_event_type',
      })
      if (debugEnabled) {
        debugEvents.push({
          index,
          eventName,
          email,
          debtIdHint,
          campaignIdHint,
          mappedActionType: null,
          status: 'skipped',
          reason: 'ignored_event_type',
        })
      }
      continue
    }

    const eventTimestamp = getEventTimestamp(payload)
    const target = await resolveTargetFromPayload(prisma, payload, eventTimestamp)
    if (!target) {
      skipped += 1
      skipReasons.unable_to_resolve_target += 1
      brevoLogsToCreate.push({
        provider: 'brevo',
        source: 'webhook',
        eventName,
        status: 'skipped',
        email,
        debtId: debtIdHint,
        campaignId: campaignIdHint,
        payload,
        skipReason: 'unable_to_resolve_target',
      })
      if (debugEnabled) {
        debugEvents.push({
          index,
          eventName,
          email,
          debtIdHint,
          campaignIdHint,
          mappedActionType: actionType,
          status: 'skipped',
          reason: 'unable_to_resolve_target',
        })
      }
      continue
    }

    rowsToCreate.push({
      debtId: target.debtId,
      customerId: target.customerId,
      actionType,
      timestamp: getEventTimestamp(payload),
      metadata: toPrismaMetadata({
        provider: 'brevo',
        event: eventName,
        email,
        messageId: getString(payload['message-id']) ?? getString(payload.messageId),
        tags: getTags(payload),
        resolutionStrategy: target.strategy,
        rawPayload: sanitizePayload(payload),
      }),
    })

    brevoLogsToCreate.push({
      provider: 'brevo',
      source: 'webhook',
      eventName,
      status: 'created',
      email,
      messageId: getString(payload['message-id']) ?? getString(payload.messageId),
      debtId: target.debtId,
      customerId: target.customerId,
      campaignId: target.campaignId,
      occurredAt: eventTimestamp ?? undefined,
      payload,
      resolutionStrategy: target.strategy,
    })

    processed += 1

    if (debugEnabled) {
      debugEvents.push({
        index,
        eventName,
        email,
        debtIdHint,
        campaignIdHint,
        mappedActionType: actionType,
        status: 'created',
        resolvedDebtId: target.debtId,
        resolvedCampaignId: target.campaignId,
        resolutionStrategy: target.strategy,
      })
    }
  }

  if (rowsToCreate.length > 0) {
    await prisma.customerActionHistory.createMany({
      data: rowsToCreate.map((row) => ({
        debtId: row.debtId,
        customerId: row.customerId,
        actionType: row.actionType,
        timestamp: row.timestamp,
        metadata: row.metadata,
      })),
    })
  }

  if (brevoLogsToCreate.length > 0) {
    const logResults = await Promise.allSettled(brevoLogsToCreate.map((row) => logBrevoEvent(prisma, row)))
    const failedLogCount = logResults.filter((result) => result.status === 'rejected').length

    if (failedLogCount > 0) {
      logger.warn(
        {
          failedLogCount,
          attemptedLogCount: brevoLogsToCreate.length,
          scope: 'webhooks.brevo.events.logBrevoEvent',
        },
        'Some Brevo webhook event logs failed to persist'
      )
    }
  }

  logger.info(
    {
      totalReceived: events.length,
      processed,
      skipped,
      skipReasons,
      created: rowsToCreate.length,
      scope: 'webhooks.brevo.events',
    },
    'Processed Brevo webhook events'
  )

  return c.json({
    data: {
      received: events.length,
      created: rowsToCreate.length,
      skipped,
      skipReasons,
      ...(debugEnabled ? { debugEvents } : {}),
    },
  })
})

async function resolveTargetFromPayload(
  prisma: Env['Variables']['prisma'],
  payload: BrevoEventPayload,
  eventTimestamp?: Date
): Promise<ResolvedEventTarget | null> {
  const debtIdFromPayload = getDebtId(payload)
  const campaignIdFromPayload = getCampaignId(payload)

  if (debtIdFromPayload) {
    const debt = await prisma.debtRecord.findUnique({
      where: { id: debtIdFromPayload },
      select: { id: true, clientId: true },
    })

    if (debt) {
      const debtWithCampaign = await prisma.debtRecord.findUnique({
        where: { id: debt.id },
        select: { campaignId: true },
      })

      return {
        debtId: debt.id,
        customerId: debt.clientId,
        campaignId: debtWithCampaign?.campaignId ?? null,
        strategy: 'debt_hint',
      }
    }
  }

  const debtIdFromUrlToken = await resolveDebtIdFromPayloadUrls(payload)
  if (debtIdFromUrlToken) {
    const debt = await prisma.debtRecord.findUnique({
      where: { id: debtIdFromUrlToken },
      select: {
        id: true,
        clientId: true,
        campaignId: true,
      },
    })

    if (debt) {
      return {
        debtId: debt.id,
        customerId: debt.clientId,
        campaignId: debt.campaignId,
        strategy: 'token_url',
      }
    }
  }

  const email = getEmail(payload)
  if (!email) {
    return null
  }

  const customer = await prisma.client.findFirst({
    where: {
      email: {
        equals: email,
        mode: 'insensitive',
      },
    },
    select: { id: true },
  })

  if (!customer) {
    return null
  }

  if (campaignIdFromPayload) {
    const campaignDebt = await prisma.debtRecord.findFirst({
      where: {
        clientId: customer.id,
        campaignId: campaignIdFromPayload,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        clientId: true,
      },
    })

    if (campaignDebt) {
      return {
        debtId: campaignDebt.id,
        customerId: campaignDebt.clientId,
        campaignId: campaignIdFromPayload,
        strategy: 'customer_campaign_match',
      }
    }
  }

  const recentSentAction = await prisma.customerActionHistory.findFirst({
    where: {
      customerId: customer.id,
      actionType: ActionType.EMAIL_SENT,
      ...(eventTimestamp
        ? {
            timestamp: {
              lte: eventTimestamp,
            },
          }
        : {}),
    },
    orderBy: {
      timestamp: 'desc',
    },
    select: {
      debtId: true,
      customerId: true,
      debt: {
        select: {
          campaignId: true,
        },
      },
    },
  })

  if (recentSentAction?.debtId) {
    return {
      debtId: recentSentAction.debtId,
      customerId: recentSentAction.customerId,
      campaignId: recentSentAction.debt?.campaignId ?? null,
      strategy: 'recent_email_sent',
    }
  }

  const latestDebt = await prisma.debtRecord.findFirst({
    where: {
      clientId: customer.id,
    },
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
      clientId: true,
    },
  })

  if (!latestDebt) {
    return null
  }

  return {
    debtId: latestDebt.id,
    customerId: latestDebt.clientId,
    campaignId: null,
    strategy: 'latest_debt',
  }
}

function getEventName(payload: BrevoEventPayload): string | null {
  const value = getString(payload.event) ?? getString(payload.type)
  return value ? value.toLowerCase() : null
}

function mapBrevoEventToActionType(eventName: string): ActionType | null {
  const value = eventName.toLowerCase()

  if (value.includes('deliver')) {
    return ActionType.OTHER
  }

  if (value.includes('click') || value.includes('open')) {
    return ActionType.LINK_CLICKED
  }

  if (
    value.includes('bounce') ||
    value.includes('blocked') ||
    value.includes('spam') ||
    value.includes('unsub') ||
    value.includes('invalid') ||
    value.includes('deferred') ||
    value.includes('error') ||
    value.includes('dropped')
  ) {
    return ActionType.OTHER
  }

  // Sent is already tracked at CSV import send-time.
  if (value.includes('sent')) {
    return null
  }

  return ActionType.OTHER
}

function getEventTimestamp(payload: BrevoEventPayload): Date | undefined {
  const ts = payload.ts ?? payload.ts_event

  if (typeof ts === 'number' && Number.isFinite(ts)) {
    return new Date(ts * 1000)
  }

  if (typeof ts === 'string') {
    const tsAsNumber = Number(ts)
    if (Number.isFinite(tsAsNumber) && tsAsNumber > 0) {
      return new Date(tsAsNumber * 1000)
    }
  }

  const rawDate = getString(payload.date)
  if (rawDate) {
    const parsed = new Date(rawDate)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }

  return undefined
}

function getEmail(payload: BrevoEventPayload): string | null {
  return (
    getString(payload.email) ??
    getString(payload.recipient) ??
    getString(payload.to) ??
    null
  )
}

function getDebtId(payload: BrevoEventPayload): string | null {
  const tags = getTags(payload)

  for (const tag of tags) {
    const lower = tag.toLowerCase()
    if (lower.startsWith('debt:')) {
      const maybeId = tag.slice(5)
      if (isUuid(maybeId)) {
        return maybeId
      }
    }

    if (isUuid(tag)) {
      return tag
    }
  }

  const directDebtId =
    getString(payload.debtId) ??
    getString(payload.debt_id) ??
    getString(payload['debt-id'])

  if (directDebtId && isUuid(directDebtId)) {
    return directDebtId
  }

  const customHeader = getString(payload['X-Mailin-custom']) ?? getString(payload['x-mailin-custom'])
  if (customHeader) {
    const pairs = customHeader.split(/[|,;&]/)
    for (const pair of pairs) {
      const [rawKey, rawValue] = pair.split('=')
      if (!rawKey || !rawValue) {
        continue
      }
      const key = rawKey.trim().toLowerCase()
      const value = rawValue.trim()
      if ((key === 'debtid' || key === 'debt_id' || key === 'debt-id') && isUuid(value)) {
        return value
      }
    }
  }

  return null
}

function getCampaignId(payload: BrevoEventPayload): string | null {
  const tags = getTags(payload)

  for (const tag of tags) {
    const lower = tag.toLowerCase()
    if (lower.startsWith('campaign:')) {
      const maybeId = tag.slice(9)
      if (isUuid(maybeId)) {
        return maybeId
      }
    }
  }

  const directCampaignId =
    getString(payload.campaignId) ??
    getString(payload.campaign_id) ??
    getString(payload['campaign-id'])

  if (directCampaignId && isUuid(directCampaignId)) {
    return directCampaignId
  }

  const customHeader = getString(payload['X-Mailin-custom']) ?? getString(payload['x-mailin-custom'])
  if (customHeader) {
    const pairs = customHeader.split(/[|,;&]/)
    for (const pair of pairs) {
      const [rawKey, rawValue] = pair.split('=')
      if (!rawKey || !rawValue) {
        continue
      }
      const key = rawKey.trim().toLowerCase()
      const value = rawValue.trim()
      if ((key === 'campaignid' || key === 'campaign_id' || key === 'campaign-id') && isUuid(value)) {
        return value
      }
    }
  }

  return null
}

function getTags(payload: BrevoEventPayload): string[] {
  const tagsValue = payload.tags
  const tagValue = payload.tag

  const values: string[] = []

  if (Array.isArray(tagsValue)) {
    for (const tag of tagsValue) {
      if (typeof tag === 'string' && tag.trim().length > 0) {
        values.push(tag.trim())
        continue
      }

      if (typeof tag === 'object' && tag !== null) {
        const nestedName = getString((tag as Record<string, unknown>).name)
        if (nestedName) {
          values.push(nestedName)
        }
      }
    }
  }

  if (typeof tagValue === 'string' && tagValue.trim().length > 0) {
    values.push(...tagValue.split(',').map((value) => value.trim()).filter((value) => value.length > 0))
  }

  return values
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

async function resolveDebtIdFromPayloadUrls(payload: BrevoEventPayload): Promise<string | null> {
  const urlCandidates = getUrlCandidates(payload)

  for (const candidate of urlCandidates) {
    const token = extractTokenFromUrl(candidate)
    if (!token) {
      continue
    }

    try {
      const verified = await verifyCustomerToken(token)
      return verified.debtId
    } catch {
      // Ignore invalid tokens and continue checking other URL fields.
    }
  }

  return null
}

function getUrlCandidates(payload: BrevoEventPayload): string[] {
  const directCandidates = [
    payload.url,
    payload.link,
    payload.href,
    payload.clickedUrl,
    payload.clicked_url,
    payload['clicked-url'],
  ]

  const values = directCandidates
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter((value) => value.length > 0)

  const urlInMessage = getString(payload.message)
  if (urlInMessage) {
    const matches = urlInMessage.match(/https?:\/\/[^\s)\]>"']+/gi) ?? []
    values.push(...matches)
  }

  return Array.from(new Set(values))
}

function extractTokenFromUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl)
    const token = parsed.searchParams.get('token')
    return token && token.trim().length > 0 ? token.trim() : null
  } catch {
    return null
  }
}

function sanitizePayload(payload: BrevoEventPayload) {
  const clone: Record<string, unknown> = { ...payload }

  // Keep auth-like values out of stored metadata.
  delete clone.authorization
  delete clone.Authorization
  delete clone.apiKey
  delete clone.api_key

  return clone
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

const routeModule = {
  path: '/api/v1/webhooks/brevo',
  handler,
}

export default routeModule
