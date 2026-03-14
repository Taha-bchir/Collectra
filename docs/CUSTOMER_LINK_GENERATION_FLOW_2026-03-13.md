# Customer Link Generation Flow

This document explains how a customer debt link is generated and how the customer can open it without login.

## Link Format

Generated link format:

```text
{WEB_URL}/client/view?token=<jwt-token>
```

Example:

```text
https://collectra-web.com/client/view?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## High-Level Flow

1. Staff clicks `Open` or `Copy` on a debt row.
2. Frontend calls `GET /api/v1/debts/{id}/personal-link`.
3. Backend verifies debt belongs to staff workspace.
4. Backend signs a JWT token (30 days expiry).
5. Backend returns `link`, `token`, `expiresAt`.
6. Staff shares the link with the customer.
7. Customer opens `/client/view?token=...` with no authentication.
8. Public API validates token and returns debt details.

## 1) Where The Link Is Generated

File: `apps/api/src/services/debts.ts`

```ts
async generateCustomerToken(workspaceId: string, debtId: string) {
  await this.getById(workspaceId, debtId) // ownership check
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

Key points:

- Token is generated on demand.
- No token is stored in the database.
- `encodeURIComponent` is used for safe URL query formatting.

## 2) How JWT Is Signed

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

JWT content and protections:

- `sub`: debt ID
- `exp`: expiry timestamp
- `aud`: `collectra-customer`
- `iss`: `collectra-api`
- signed with `HS256` using `JWT_SECRET`

## 3) Staff API Route That Returns The Link

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

This route is protected (staff/auth required).

## 4) Customer Accesses Link Without Login

### Public API token validation

File: `apps/api/src/services/debts.ts`

```ts
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
```

### Public endpoint used by customer page

File: `apps/api/src/routes/v1/public-debts/actions.ts`

```ts
handler.openapi(getPublicDebtByTokenSchema, withRouteTryCatch('publicDebts.getByToken', async (c) => {
  const { token } = c.req.valid('param')

  const service = new DebtsService(c.get('prisma'))
  const { debt, tokenExpiresAt } = await service.getByCustomerToken(token)

  return c.json({
    data: {
      debtId: debt.id,
      amount: debt.amount.toNumber(),
      dueDate: debt.dueDate.toISOString(),
      status: debt.status,
      campaignName: debt.campaign.name,
      tokenExpiresAt: tokenExpiresAt.toISOString(),
      customer: {
        fullName: debt.client.fullName,
        email: debt.client.email,
        phone: debt.client.phone,
      },
    },
  })
}))
```

## 5) Customer Page Rendering

File: `apps/web/app/(public)/client/view/page.tsx`

The page reads `token` from the query string and calls the public API:

```ts
const token = useMemo(() => searchParams.get('token')?.trim() ?? '', [searchParams])

const details = await getPublicDebtByToken(token)
setDebt(details)
```

If token is missing/invalid/expired, an error state is shown. If valid, debt details are displayed.

## 6) Security Characteristics

- No customer login required.
- Token is signed and tamper-proof.
- Token has built-in expiry (`exp`).
- Token verification checks issuer and audience.
- Backend returns 404 for invalid/expired tokens.
- Link generation is staff-only and workspace-scoped.

## 7) Response Returned To Staff When Link Is Generated

```json
{
  "data": {
    "link": "https://your-web-url/client/view?token=eyJ...",
    "token": "eyJ...",
    "expiresAt": "2026-04-12T10:15:30.000Z"
  }
}
```

This `link` is what gets opened or copied and sent to the customer.
