# Staff Customer-Link Generation Flow

This document explains how the system generates a customer debt link when a **staff member** clicks `Open` or `Copy` in the campaigns page.

## Purpose

Staff users can generate a shareable customer link for a specific debt record without storing a token in the database.

The generated link format is:

```text
{WEB_URL}/client/view?token=<jwt>
```

## End-to-End Flow

1. Staff opens `Campaigns` page and selects a campaign.
2. In the debt table, staff clicks `Open` or `Copy`.
3. Frontend calls `GET /api/v1/debts/{debtId}/personal-link` (authenticated cookie request).
4. API verifies workspace access for that staff user.
5. API service signs a JWT containing the debt ID and expiry.
6. API returns `{ link, token, expiresAt }`.
7. Frontend either opens the link in a new tab or copies it to clipboard.

## Frontend (Staff Action)

File: `apps/web/app/(dashboard)/campaigns/page.tsx`

```ts
const handleOpenCustomerLink = useCallback(async (debtId: string) => {
  setLinkLoadingDebtId(debtId)

  try {
    const result = await getDebtPersonalLink(debtId)
    window.open(result.link, '_blank', 'noopener,noreferrer')
    toast.success('Customer link opened in a new tab')
  } catch (error) {
    toast.error(getErrorMessage(error, 'Failed to generate customer link'))
  } finally {
    setLinkLoadingDebtId(null)
  }
}, [])

const handleCopyCustomerLink = useCallback(async (debtId: string) => {
  setLinkLoadingDebtId(debtId)

  try {
    const result = await getDebtPersonalLink(debtId)
    await navigator.clipboard.writeText(result.link)
    toast.success('Customer link copied to clipboard')
  } catch (error) {
    toast.error(getErrorMessage(error, 'Failed to copy customer link'))
  } finally {
    setLinkLoadingDebtId(null)
  }
}, [])
```

The call made by `getDebtPersonalLink`:

File: `apps/web/features/campaigns/services/campaign-service.ts`

```ts
export const CAMPAIGN_ROUTES = {
  debtPersonalLink: (debtId: string) => `/api/v1/debts/${debtId}/personal-link`,
} as const

export async function getDebtPersonalLink(debtId: string): Promise<DebtPersonalLinkResult> {
  const client = getCampaignsClient()
  const { data } = await client.get<{ data: DebtPersonalLinkResult }>(
    CAMPAIGN_ROUTES.debtPersonalLink(debtId)
  )
  return data.data
}
```

## API Route (Staff-Only)

File: `apps/api/src/routes/v1/debts/actions.ts`

```ts
handler.openapi(getPersonalLinkSchema, withRouteTryCatch('debts.personalLink', async (c) => {
  const workspaceId = requireWorkspaceId(c)
  const { id } = c.req.valid('param')

  const service = new DebtsService(c.get('prisma'))
  const { link, token, expiresAt } = await service.getPersonalLink(workspaceId, id)

  return c.json({
    data: {
      link,
      token,
      expiresAt: expiresAt.toISOString(),
    },
  })
}))
```

Why staff-only:

- Route is under `/api/v1/debts/*`, which is protected by API auth middleware.
- `requireWorkspaceId(c)` enforces tenant context.
- Service checks debt ownership against workspace.

## Service Logic (JWT Link Generation)

File: `apps/api/src/services/debts.ts`

```ts
async generateCustomerToken(workspaceId: string, debtId: string) {
  await this.getById(workspaceId, debtId) // ensures staff can access this debt in workspace
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
```

Important details:

- No token is stored in DB.
- Each call can generate a fresh signed JWT.
- Link is URL-encoded to avoid token formatting issues.

## JWT Signing Details

File: `apps/api/src/lib/customer-jwt.ts`

```ts
const EXPIRY_DAYS = 30
const AUDIENCE = 'collectra-customer'
const ISSUER = 'collectra-api'

export async function signCustomerToken(debtId: string): Promise<{ token: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000)

  const token = await new SignJWT({ sub: debtId })
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience(AUDIENCE)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getSecret())

  return { token, expiresAt }
}
```

Claims and security:

- `sub`: debt ID
- `exp`: expiration timestamp
- `aud`: `collectra-customer`
- `iss`: `collectra-api`
- Signature algorithm: `HS256`
- Secret source: `JWT_SECRET`

## Response Shape Returned To Staff UI

```json
{
  "data": {
    "link": "https://your-web-url/client/view?token=eyJ...",
    "token": "eyJ...",
    "expiresAt": "2026-04-12T10:15:30.000Z"
  }
}
```

## Summary

Staff link generation is a secure authenticated flow:

- Staff must be logged in and in a valid workspace.
- API verifies debt ownership.
- API signs JWT token server-side.
- Frontend receives the URL and either opens or copies it for sharing.
