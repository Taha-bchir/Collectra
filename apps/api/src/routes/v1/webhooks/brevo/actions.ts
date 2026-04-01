import { ActionType } from '@repo/database'
import { OpenAPIHono } from '@hono/zod-openapi'
import type { Env } from '../../../../types/index.js'
import { toPrismaMetadata } from '../../../../utils/metadata.js'
import { logger } from '../../../../utils/logger.js'
import { env } from '../../../../config/env.js'

const handler = new OpenAPIHono<Env>()

type BrevoEventPayload = Record<string, unknown>

type ResolvedEventTarget = {
  debtId: string
  customerId: string
}

handler.post('/events', async (c) => {
  const configuredToken = env.BREVO_WEBHOOK_TOKEN
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

  const rowsToCreate: Array<{
    debtId: string
    customerId: string
    actionType: ActionType
    timestamp?: Date
    metadata: ReturnType<typeof toPrismaMetadata>
  }> = []

  let processed = 0
  let skipped = 0

  for (const entry of events) {
    if (!entry || typeof entry !== 'object') {
      skipped += 1
      continue
    }

    const payload = entry as BrevoEventPayload
    const eventName = getEventName(payload)

    if (!eventName) {
      skipped += 1
      continue
    }

    const actionType = mapBrevoEventToActionType(eventName)
    if (!actionType) {
      // Ignore events that are not currently tracked in dashboard metrics.
      skipped += 1
      continue
    }

    const target = await resolveTargetFromPayload(prisma, payload)
    if (!target) {
      skipped += 1
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
        email: getEmail(payload),
        messageId: getString(payload['message-id']) ?? getString(payload.messageId),
        tags: getTags(payload),
      }),
    })

    processed += 1
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

  logger.info(
    {
      totalReceived: events.length,
      processed,
      skipped,
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
    },
  })
})

async function resolveTargetFromPayload(
  prisma: Env['Variables']['prisma'],
  payload: BrevoEventPayload
): Promise<ResolvedEventTarget | null> {
  const debtIdFromPayload = getDebtId(payload)
  const campaignIdFromPayload = getCampaignId(payload)

  if (debtIdFromPayload) {
    const debt = await prisma.debtRecord.findUnique({
      where: { id: debtIdFromPayload },
      select: { id: true, clientId: true },
    })

    if (debt) {
      return {
        debtId: debt.id,
        customerId: debt.clientId,
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
      }
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
  }
}

function getEventName(payload: BrevoEventPayload): string | null {
  const value = getString(payload.event) ?? getString(payload.type)
  return value ? value.toLowerCase() : null
}

function mapBrevoEventToActionType(eventName: string): ActionType | null {
  const value = eventName.toLowerCase()

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

  // Sent/delivered are already tracked at CSV import send-time.
  if (value.includes('sent') || value.includes('deliver')) {
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

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

const routeModule = {
  path: '/api/v1/webhooks/brevo',
  handler,
}

export default routeModule
