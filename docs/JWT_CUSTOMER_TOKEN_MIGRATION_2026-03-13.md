# JWT Customer Token Migration

**Date:** 2026-03-13  
**Branch:** `master`  
**Scope:** Replace UUID-based customer debt tokens (stored in DB) with stateless signed JWTs

---

## Why This Change?

Previously, each `DebtRecord` stored a `customerToken` (UUID) and `tokenExpiresAt` (DateTime) directly in the database. This has several downsides:

| Problem | Impact | :
| Token stored in DB | Any DB read exposes all tokens — data at rest risk |
| Requires DB write to generate a link | Extra round-trip, mutation side-effect on a "read" action |
| Expiry checked manually in code | Easy to forget or bypass |
| Can't regenerate without changing the URL | Old links break silently |

**JWTs solve all of these:**

- Token is self-contained — contains `debtId` + expiry, signed with `HMAC-SHA256`
- No DB write on link generation
- Expiry is enforced by the JWT standard (`exp` claim) — impossible to bypass
- Tamper-proof: any modification to the payload invalidates the signature
- No token data stored in the database at all

---

## Environment Variable Required

Add to your `.env.development` (and all other environments):

```env
JWT_SECRET=your-strong-random-secret-at-least-32-chars
```

> The API will throw a clear error at link-generation time if `JWT_SECRET` is missing.

Generate a secure value with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## New Dependency

**Package:** [`jose`](https://github.com/panva/jose) — ESM-compatible, zero-dependency JWT library for Node.js  
**Added to:** `apps/api/package.json`

```json
"jose": "^5.10.0"
```

---

## Files Changed

### 1. `packages/database/prisma/schema.prisma` — Remove token columns

**Before:**

```prisma
model DebtRecord {
  id             String     @id @default(uuid()) @db.Uuid
  campaignId     String     @db.Uuid
  clientId       String     @db.Uuid
  amount         Decimal
  dueDate        DateTime
  status         DebtStatus @default(IMPORTED)
  promiseDate    DateTime?
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt
  customerToken  String?    @unique  // <-- stored UUID token
  tokenExpiresAt DateTime?           // <-- stored expiry
  ...
}
```

**After:**

```prisma
model DebtRecord {
  id          String     @id @default(uuid()) @db.Uuid
  campaignId  String     @db.Uuid
  clientId    String     @db.Uuid
  amount      Decimal
  dueDate     DateTime
  status      DebtStatus @default(IMPORTED)
  promiseDate DateTime?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  // no token fields — JWT is stateless
  ...
}
```

**DB change applied via:**

```bash
pnpm --filter @repo/database db:push
```

This **drops** `customerToken` and `tokenExpiresAt` columns from the `Debt` table.

---

### 2. `apps/api/src/lib/customer-jwt.ts` — New JWT utility (NEW FILE)

Centralises all JWT sign/verify logic for customer links.

```ts
import { SignJWT, jwtVerify } from 'jose'
import { env } from '../config/env.js'

const EXPIRY_DAYS = 30
const AUDIENCE = 'collectra-customer'
const ISSUER = 'collectra-api'

function getSecret(): Uint8Array {
  const secret = env.JWT_SECRET
  if (!secret) {
    throw new Error(
      'JWT_SECRET is not set. Add JWT_SECRET to your .env file to use customer token links.',
    )
  }
  return new TextEncoder().encode(secret)
}

/**
 * Signs a short-lived JWT for a customer debt link.
 * The token encodes the debtId in the `sub` claim — no DB storage needed.
 */
export async function signCustomerToken(
  debtId: string,
): Promise<{ token: string; expiresAt: Date }> {
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

/**
 * Verifies the customer JWT and returns the embedded debtId and expiry.
 * Throws if the token is invalid, tampered with, or expired.
 */
export async function verifyCustomerToken(
  token: string,
): Promise<{ debtId: string; expiresAt: Date }> {
  const { payload } = await jwtVerify(token, getSecret(), {
    audience: AUDIENCE,
    issuer: ISSUER,
  })

  if (!payload.sub) {
    throw new Error('Invalid customer token: missing subject')
  }

  return {
    debtId: payload.sub,
    expiresAt: new Date((payload.exp ?? 0) * 1000),
  }
}
```

**JWT structure:**

```bash
Header:  { alg: "HS256" }
Payload: { sub: "<debtId UUID>", aud: "collectra-customer", iss: "collectra-api", iat: ..., exp: ... }
```

---

### 3. `apps/api/src/services/debts.ts` — Replace UUID logic with JWT

**Before:**

```ts
import { randomUUID } from 'crypto'

async getByCustomerToken(token: string) {
  const debt = await this.prisma.debtRecord.findFirst({
    where: { customerToken: token },  // DB lookup by token
    include: { client: true, campaign: true },
  })

  if (!debt) throw new HTTPException(404, { ... })
  if (debt.tokenExpiresAt && debt.tokenExpiresAt < new Date()) {
    throw new HTTPException(404, { ... })  // manual expiry check
  }

  return debt
}

async generateCustomerToken(workspaceId: string, debtId: string) {
  const debt = await this.getById(workspaceId, debtId)

  if (debt.customerToken) return debt.customerToken  // reuse existing

  const token = randomUUID()
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  // DB write just to store a token
  const updated = await this.prisma.debtRecord.update({
    where: { id: debtId },
    data: { customerToken: token, tokenExpiresAt: expiresAt },
    select: { customerToken: true },
  })

  return updated.customerToken
}

async getPersonalLink(workspaceId: string, debtId: string) {
  const debt = await this.getById(workspaceId, debtId)
  if (!debt.customerToken) {
    return this.generateCustomerToken(workspaceId, debtId)
      .then(token => `${env.WEB_URL}/client/view?token=${token}`)
  }
  return `${env.WEB_URL}/client/view?token=${debt.customerToken}`
}
```

**After:**

```ts
import { signCustomerToken, verifyCustomerToken } from '../lib/customer-jwt.js'

async getByCustomerToken(token: string) {
  let debtId: string
  let tokenExpiresAt: Date

  try {
    const result = await verifyCustomerToken(token)  // JWT verify (no DB)
    debtId = result.debtId
    tokenExpiresAt = result.expiresAt
  } catch {
    throw new HTTPException(404, { message: 'Debt link is invalid or expired' })
  }

  const debt = await this.prisma.debtRecord.findUnique({
    where: { id: debtId },
    include: { client: true, campaign: true },
  })

  if (!debt) throw new HTTPException(404, { ... })

  return { debt, tokenExpiresAt }
}

async generateCustomerToken(workspaceId: string, debtId: string) {
  await this.getById(workspaceId, debtId)  // ownership check still enforced
  return signCustomerToken(debtId)         // no DB write
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

---

### 4. `apps/api/src/schema/v1/public-debts.schema.ts` — Update schema types

**Before:**

```ts
request: {
  params: z.object({
    token: z.string().uuid(),   // was UUID format
  }),
},
// response:
tokenExpiresAt: z.string().datetime().nullable(),  // could be null
```

**After:**

```ts
request: {
  params: z.object({
    token: z.string().min(1),   // JWT is not UUID format
  }),
},
// response:
tokenExpiresAt: z.string().datetime(),  // always present (in JWT exp claim)
```

---

### 5. `apps/api/src/routes/v1/public-debts/actions.ts` — Use new return shape

**Before:**

```ts
const debt = await service.getByCustomerToken(token)

return c.json({
  data: {
    ...
    tokenExpiresAt: debt.tokenExpiresAt?.toISOString() ?? null,  // from DB field
  },
})
```

**After:**

```ts
const { debt, tokenExpiresAt } = await service.getByCustomerToken(token)

return c.json({
  data: {
    ...
    tokenExpiresAt: tokenExpiresAt.toISOString(),  // from JWT exp claim
  },
})
```

---

### 6. `apps/api/src/routes/v1/debts/actions.ts` — Update personal-link route schema

**Before:**

```ts
schema: z.object({
  data: z.object({
    link: z.string().url(),
    token: z.string().uuid(),              // UUID format
    expiresAt: z.string().datetime().nullable(),  // nullable
  }),
}),

// Handler:
const link = await service.getPersonalLink(workspaceId, id)  // returned plain string
const debt = await service.getById(workspaceId, id)          // extra DB fetch

return c.json({
  data: {
    link,
    token: debt.customerToken,                 // from DB column
    expiresAt: debt.tokenExpiresAt?.toISOString() || null,
  },
})
```

**After:**

```ts
schema: z.object({
  data: z.object({
    link: z.string().url(),
    token: z.string(),           // JWT (no format constraint)
    expiresAt: z.string().datetime(),  // non-nullable
  }),
}),

// Handler:
const { link, token, expiresAt } = await service.getPersonalLink(workspaceId, id)
// no extra DB fetch needed

return c.json({
  data: {
    link,
    token,                       // JWT
    expiresAt: expiresAt.toISOString(),
  },
})
```

---

### 7. `apps/web/features/campaigns/services/campaign-service.ts` — Update type

**Before:**

```ts
export type DebtPersonalLinkResult = {
  link: string
  token: string | null    // could be null if not generated yet
  expiresAt: string | null
}
```

**After:**

```ts
export type DebtPersonalLinkResult = {
  link: string
  token: string     // always present (JWT generated on demand)
  expiresAt: string
}
```

---

## Security Notes

- The JWT **payload is base64-encoded, not encrypted** — `debtId` is visible to anyone who decodes it. This is acceptable because `debtId` alone is not sensitive, and the signature prevents forging.
- If you need to hide `debtId` entirely from the URL, consider encrypting the payload (JWE) — but this adds complexity without meaningful security gain for this use case.
- **Revocation**: JWTs cannot be revoked before expiry without a blocklist. If a debt is deleted or paid and you want to invalidate existing links immediately, you would need a short TTL or a token blocklist table. Currently, expired links return 404, and valid tokens always return the current debt state from the DB.

---

## Build Verification

Both packages built successfully after all changes:

```bash
pnpm --filter api build   → tsc exit 0, no errors
pnpm --filter web build   → ✓ Compiled successfully, 17/17 pages, no TS errors
```
