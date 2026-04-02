# Email Tracking Implementation (Campaign CSV Flow)

## Overview

This document explains how email tracking is implemented for campaign CSV imports, how statistics are calculated, and where each part lives in the codebase.

Current pipeline:

1. CSV import creates debts and prepares email notifications.
2. Brevo email service sends emails and returns which debt emails were sent successfully.
3. Successful sends are persisted in `CustomerActionHistory` as `EMAIL_SENT` actions.
4. Campaign stats endpoint aggregates action history into sent/opened/clicked/other metrics.
5. Frontend calls the stats endpoint and displays results in the campaign stats card.

What this gives you operationally:

- A single source of truth for campaign email metrics in `CustomerActionHistory`.
- Consistent stats across UI and API because both rely on persisted action rows.
- Better debugging: when stats look wrong, you can inspect action rows instead of guessing from logs.

## 1) Action Types Used For Tracking

**File:** `packages/database/prisma/schema.prisma`

```prisma
enum ActionType {
  LINK_SENT
  LINK_CLICKED
  PROMISE_MADE
  PROMISE_UPDATED
  PAYMENT_CONFIRMED
  STATUS_CHANGED
  NOTE_ADDED
  EMAIL_SENT
  SMS_SENT
  PHONE_CALL
  OTHER
}
```

Why this matters:

- `EMAIL_SENT` is used to count sent emails.
- `LINK_CLICKED` is used in stats aggregation for engagement.
- `LINK_SENT` is also counted as sent in the stats endpoint for compatibility.

Detailed behavior:

- `ActionType` is the normalized event vocabulary used across your system.
- Aggregation code should always compare against enum values, not free-text strings.
- If new providers are added later, map provider events into these existing action types to avoid changing dashboard logic.

## 2) API Contract For Email Stats Endpoint

**File:** `apps/api/src/schema/v1/campaigns.schema.ts`

```ts
export const getCampaignEmailStatsSchema = createRoute({
  method: 'get',
  path: '/{id}/email-stats',
  tags: ['campaigns'],
  summary: 'Get email campaign statistics',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            data: z.object({
              campaignId: z.string().uuid(),
              stats: z.object({
                sent: z.number().int().nonnegative(),
                opened: z.number().int().nonnegative(),
                clicked: z.number().int().nonnegative(),
                other: z.number().int().nonnegative(),
              }),
              summary: z.object({
                total: z.number().int().nonnegative(),
                uniqueDebts: z.number().int().nonnegative(),
                uniqueCustomers: z.number().int().nonnegative(),
              }),
              lastEventAt: z.string().datetime().nullable(),
            }),
          }),
        },
      },
    },
  },
})
```

Why this matters:

- Defines the exact API response consumed by frontend.
- Ensures endpoint behavior is typed and documented in OpenAPI.

Detailed behavior:

- `path: '/{id}/email-stats'` guarantees the endpoint is campaign-scoped.
- `id: z.string().uuid()` prevents invalid campaign IDs before handler logic runs.
- `nonnegative()` on numeric fields ensures clients never receive negative metrics.
- `lastEventAt` is nullable so empty campaigns return valid responses instead of errors.

## 3) CSV Import Prepares Email Notification Rows

**File:** `apps/api/src/services/campaigns.ts`

```ts
const debtEmailNotifications: Array<{
  toEmail: string
  fullName: string
  campaignName: string
  amount: number
  dueDate: Date
  debtId: string
  customerId: string
}> = []

...

if (row.email) {
  debtEmailNotifications.push({
    toEmail: row.email,
    fullName: row.fullName,
    campaignName: campaign.name,
    amount: row.amount,
    dueDate: row.dueDate,
    debtId,
    customerId: clientId,
  })
}
```

Why this matters:

- Captures both `debtId` and `customerId` so successful sends can later be persisted as tracked actions.

Detailed behavior:

- `debtId` links each email event to campaign debt records for aggregation.
- `customerId` links each event to a person, enabling unique-customer calculations.
- Rows without email are intentionally skipped for sending (and therefore for email sent tracking).

## 4) Brevo Sender Returns Successful Debt IDs

**File:** `apps/api/src/services/brevo-email.ts`

```ts
type SendBulkResult = {
  attempted: number
  sent: number
  failed: number
  skipped: number
  sentDebtIds: string[]
}

...

const results = await runWithConcurrency(payloads, 8, async (payload) => {
  try {
    const ok = await this.sendOne(payload)
    return { debtId: payload.debtId, ok }
  } catch {
    return { debtId: payload.debtId, ok: false }
  }
})

const sentDebtIds = results.filter((value) => value.ok).map((value) => value.debtId)

return {
  attempted: payloads.length,
  sent: sentDebtIds.length,
  failed: results.length - sentDebtIds.length,
  skipped: 0,
  sentDebtIds,
}
```

Why this matters:

- Makes tracking deterministic: only successfully sent emails are marked as sent actions.

Detailed behavior:

- The service returns both summary counts and exact IDs (`sentDebtIds`) for successful sends.
- This design avoids false positives: failed sends are never written as `EMAIL_SENT`.
- Concurrency (`runWithConcurrency`) improves throughput while preserving per-item outcomes.

## 5) Persist Successful Sends To Action History

**File:** `apps/api/src/services/campaigns.ts`

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

Why this matters:

- This is the core persistence step that powers the stats endpoint.
- Without this block, endpoint stats can remain zero even if emails were sent.

Detailed behavior:

- `createMany` writes tracked actions in bulk for better performance on large imports.
- Metadata (`channel`, `source`, `campaignId`) gives context for future analytics and audits.
- This persistence occurs after email sending, so only confirmed successes are stored.

## 6) Stats Endpoint Aggregation Logic

**File:** `apps/api/src/routes/v1/campaigns/actions.ts`

```ts
const actionHistory = await prisma.customerActionHistory.findMany({
  where: {
    debt: {
      campaignId: campaignId,
    },
  },
  select: {
    id: true,
    actionType: true,
    timestamp: true,
    debtId: true,
    customerId: true,
  },
  orderBy: {
    timestamp: 'desc',
  },
})

const stats = {
  sent: 0,
  opened: 0,
  clicked: 0,
  other: 0,
}

for (const action of actionHistory) {
  if (action.actionType === 'EMAIL_SENT' || action.actionType === 'LINK_SENT') {
    stats.sent += 1
  } else if (action.actionType === 'LINK_CLICKED') {
    stats.opened += 1
  } else {
    stats.other += 1
  }
}

const clickedCount = stats.opened
stats.clicked = clickedCount
```

Why this matters:

- Reads all campaign-related actions and computes dashboard totals.
- Compatibility behavior: `LINK_SENT` also contributes to sent count.
- Current behavior: `clicked` mirrors `opened` (same underlying action source).

Detailed behavior:

- Query filter `debt.campaignId = campaignId` ensures only current campaign activity is counted.
- `orderBy timestamp desc` makes `lastEventAt` easy to compute from the first row.
- `uniqueDebts` and `uniqueCustomers` are derived using sets, not raw counts, to avoid duplicates.
- Non-email action types are grouped under `other` to keep response stable as new action types appear.

## 7) Route Registration

**File:** `apps/api/src/routes/v1/campaigns/actions.ts`

```ts
handler.openapi(
  getCampaignEmailStatsSchema,
  withRouteTryCatch('campaigns.emailStats', async (c) => {
    ...
  })
)
```

Why this matters:

- Exposes the endpoint under the campaigns module path (`/api/v1/campaigns/{id}/email-stats`).

Detailed behavior:

- Route registration is mandatory; schema alone does not expose an endpoint.
- `withRouteTryCatch` centralizes error handling and consistent API error responses.

## 8) Frontend API Client Integration

**File:** `apps/web/features/campaigns/services/campaign-service.ts`

```ts
export const CAMPAIGN_ROUTES = {
  ...
  emailStats: (id: string) => `/api/v1/campaigns/${id}/email-stats`,
} as const

export async function getCampaignEmailStats(id: string): Promise<CampaignEmailStats> {
  const client = getCampaignsClient()
  const { data } = await client.get<{ data: CampaignEmailStats }>(CAMPAIGN_ROUTES.emailStats(id))
  return data.data
}
```

Why this matters:

- Ensures the frontend queries the correct backend endpoint and uses the typed response.

Detailed behavior:

- Centralized route constants reduce path typo regressions.
- Returning `data.data` keeps frontend callers focused on the business payload.
- Strong typing (`CampaignEmailStats`) protects UI from shape drift.

## 9) Frontend Display Component

**File:** `apps/web/components/campaign-email-stats.tsx`

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

Why this matters:

- Fetches and renders sent/opened/clicked/other stats for the selected campaign.

Detailed behavior:

- Fetch runs whenever `campaignId` changes, so switching campaigns refreshes stats automatically.
- Loading and error states avoid blank/ambiguous UI.
- Rates are derived from returned totals, so no extra API call is needed.

## End-to-End Flow Summary

1. Import CSV campaign.
2. Backend creates debts and sends emails via Brevo.
3. Successful sends are persisted as `EMAIL_SENT` in `CustomerActionHistory`.
4. Stats endpoint aggregates those actions by campaign.
5. Frontend requests `/api/v1/campaigns/{id}/email-stats` and renders metrics.

## Notes and Current Limitations

- Existing campaigns imported before persistence was added may show low/zero sent stats.
- `opened` and `clicked` currently come from the same action source (`LINK_CLICKED`) in this implementation.
- If you later add distinct open/click event ingestion, update aggregation to split them.

Recommended next improvements:

1. Add a backfill script to create `EMAIL_SENT` rows for historical campaigns if needed.
2. Ingest Brevo webhook open/click as distinct action types (or metadata-based split) for accurate rates.
3. Add integration tests for CSV import -> send -> action persistence -> stats endpoint.
4. Add an admin debug endpoint to inspect recent campaign action rows when investigating mismatches.
