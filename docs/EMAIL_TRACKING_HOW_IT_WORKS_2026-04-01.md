# Email Tracking: How It Works

This document explains the current tracking flow in Collectra and includes key code snippets.

## 1. Send Phase (CSV Import)
When a campaign CSV is imported, emails are sent through Brevo API. For each successful send, the backend writes an `EMAIL_SENT` action to `CustomerActionHistory`.

Code reference:
- apps/api/src/services/campaigns.ts

```ts
const emailResult = await emailService.sendCsvImportedDebtEmails(importResult.debtEmailNotifications)
emailStats = emailResult

if (emailResult.sentDebtIds.length > 0) {
  const sentNotifications = importResult.debtEmailNotifications.filter((notification) =>
    emailResult.sentDebtIds.includes(notification.debtId)
  )

  if (sentNotifications.length > 0) {
    await this.prisma.customerActionHistory.createMany({
      data: sentNotifications.map((notification) => ({
        debtId: notification.debtId,
        customerId: notification.customerId,
        actionType: ActionType.EMAIL_SENT,
        metadata: {
          channel: 'brevo',
          source: 'csv-import',
          campaignId: importResult.campaign.id,
        },
      })),
    })
  }
}
```

Why this is important:
- Tracking starts with a reliable sent baseline.
- Engagement events can later be attached to the same debt/customer.

## 2. Webhook Ingestion Phase (Open/Click/Other)
Brevo posts events to `/api/v1/webhooks/brevo/events`. The route validates token, parses payload(s), maps event type to internal `ActionType`, resolves target debt/customer, and stores rows in `CustomerActionHistory`.

Code reference:
- apps/api/src/routes/v1/webhooks/brevo/actions.ts

```ts
handler.post('/events', async (c) => {
  const configuredToken = env.BREVO_WEBHOOK_TOKEN ?? env.BREVO_WEBHOOK_SECRET
  if (configuredToken) {
    const providedToken = c.req.query('token')
    if (!providedToken || providedToken !== configuredToken) {
      return c.json({ error: 'Unauthorized webhook token' }, 401)
    }
  }

  const events = Array.isArray(parsedBody) ? parsedBody : [parsedBody]
  ...

  const actionType = mapBrevoEventToActionType(eventName)
  const target = await resolveTargetFromPayload(prisma, payload, eventTimestamp)

  rowsToCreate.push({
    debtId: target.debtId,
    customerId: target.customerId,
    actionType,
    timestamp: eventTimestamp,
    metadata: toPrismaMetadata({
      provider: 'brevo',
      event: eventName,
      email,
      resolutionStrategy: target.strategy,
    }),
  })

  await prisma.customerActionHistory.createMany({ data: ... })
})
```

Why this is important:
- This is where opened/clicked/other metrics are actually persisted.
- Without this, dashboard engagement metrics stay at 0.

## 3. Event-to-Target Resolution Strategy
Most webhook payloads do not always include campaign/debt IDs. The resolver uses fallback strategies in this order:

1. `debt_hint` from tags/custom header
2. `customer_campaign_match` (if campaign hint exists)
3. `recent_email_sent` for same customer (most reliable fallback)
4. `latest_debt` for same customer

Code reference:
- apps/api/src/routes/v1/webhooks/brevo/actions.ts

```ts
type ResolvedEventTarget = {
  debtId: string
  customerId: string
  campaignId: string | null
  strategy: 'debt_hint' | 'customer_campaign_match' | 'recent_email_sent' | 'latest_debt'
}
```

Why this fixed the issue:
- Webhook events were arriving, but attribution was ambiguous.
- Using `recent_email_sent` connected clicks/opens to the same debt/campaign that sent the email.

## 4. Stats Aggregation Endpoint
Campaign stats are computed from `CustomerActionHistory` filtered by campaign debts.

Code reference:
- apps/api/src/routes/v1/campaigns/actions.ts

```ts
const actionHistory = await prisma.customerActionHistory.findMany({
  where: {
    debt: {
      campaignId: campaignId,
    },
  },
  orderBy: { timestamp: 'desc' },
})

const stats = { sent: 0, opened: 0, clicked: 0, other: 0 }

for (const action of actionHistory) {
  if (action.actionType === 'EMAIL_SENT' || action.actionType === 'LINK_SENT') {
    stats.sent += 1
  } else if (action.actionType === 'LINK_CLICKED') {
    stats.opened += 1
  } else {
    stats.other += 1
  }
}

stats.clicked = stats.opened
```

Notes:
- `clicked` currently mirrors `opened` because both map to `LINK_CLICKED` right now.
- `other` captures bounce/spam/unsubscribe/blocked/error-like events.

## 5. Frontend Display
Frontend fetches `/api/v1/campaigns/{id}/email-stats` and renders the four metrics.

Code reference:
- apps/web/components/campaign-email-stats.tsx

```tsx
useEffect(() => {
  async function fetchStats() {
    setLoading(true)
    setError(null)
    try {
      const result = await getCampaignEmailStats(campaignId)
      setStats(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load email stats')
    } finally {
      setLoading(false)
    }
  }

  fetchStats()
}, [campaignId])
```

## 6. Debug Mode (for troubleshooting)
Webhook supports `debug=1` query param. It returns:
- `skipReasons` counts
- `debugEvents` with mapping details and strategy

Example URL:

```text
https://collectra-api.vercel.app/api/v1/webhooks/brevo/events?token=YOUR_TOKEN&debug=1
```

This is useful to identify why a webhook event was skipped or where it was attributed.
