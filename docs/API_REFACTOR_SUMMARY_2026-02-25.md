# API Refactor Summary (Conversation Changes)

Date: 2026-02-25  
Scope: `apps/api` (middleware, routes, typing, testing, docs)

---

## 1) Main Goal Achieved

During this session, we consolidated tenant resolution into authorization, reduced duplicated route typing/logic, introduced reusable route utilities, and added a reproducible smoke test for auth + tenant behavior.

This was done **without removing API route schemas** (`zod-openapi`), because they are needed for:

- request validation (`c.req.valid(...)`)
- typed route contracts
- OpenAPI/Swagger docs

Prisma schema/types were reused where possible for database-side typing.

---

## 2) Middleware Changes

## 2.1 Authorization now resolves tenant context

Updated file: `apps/api/src/middleware/authorization.ts`

### What changed

- JWT auth remains in `authorization` middleware.
- Added tenant-aware resolution for tenant-scoped paths:
  - `/api/v1/customers...`
  - `/api/v1/debts...`
  - `/api/v1/actions...`
  - `/api/v1/test-tenant...`
- New helper: `attachTenantContext(...)`.
- Sets:
  - `c.set('currentWorkspace', { id, name })`
  - `c.set('currentUser', { id, email, role })`
- Header/cookie behavior:
  - if `x-workspace-id` is provided and invalid for user -> `403 Forbidden workspace`
  - else fallback to workspace cookie, then latest membership

### Key snippet

```ts
if (isTenantScopedPath(c.req.path)) {
  await attachTenantContext(c, {
    id: user.id,
    email: user.email ?? undefined,
  })
}
```

```ts
if (!membership?.workspace) {
  throw new HTTPException(403, { message: 'Forbidden workspace' })
}
```

## 2.2 Tenant middleware kept as compatibility wrapper

Updated file: `apps/api/src/middleware/tenant.ts`

- Replaced duplicated tenant lookup logic with delegation to `attachTenantContext(...)` from `authorization.ts`.
- This keeps backward compatibility while avoiding duplicated logic.

---

## 3) Type Context Alignment

Updated files:

- `apps/api/src/types/index.ts`
- `apps/api/src/types/hono.d.ts`

### What changed

Added/standardized context variables:

- `user?: { id: string; email?: string }`
- `currentWorkspace?: { id: string; name: string }`
- `currentUser?: { id: string; email?: string; role: WorkspaceRole | 'OWNER' | 'AGENT' }`

This aligns route typing with middleware behavior.

---

## 4) Route Layer Refactor

## 4.1 Removed ad-hoc request typing in handlers

Across `apps/api/src/routes/v1/**/actions.ts`:

- moved from manual body typing (`await c.req.json<...>()`) to schema-validated payloads:

```ts
const payload = c.req.valid('json')
const params = c.req.valid('param')
const query = c.req.valid('query')
```

This ensures route payload shape is always aligned with OpenAPI/Zod schemas.

## 4.2 Reduced duplicated local route types

Notable update in `apps/api/src/routes/v1/debts/actions.ts`:

- removed duplicated local entity DTO shapes
- replaced with service-derived typing for mapper input:

```ts
type DebtRouteEntity = Awaited<ReturnType<DebtsService['create']>> & {
  client?: { fullName: string; phone: string | null; email: string | null } | null
}
```

---

## 5) Shared Utilities Added

## 5.1 Route error/guard helper

New file: `apps/api/src/utils/route-helpers.ts`

Provides:

- `withRouteTryCatch(scope, handler)`
- `requireWorkspaceId(c, message?)`
- `requireUserId(c, message?)`

### Example usage

```ts
handler.openapi(listDebtsSchema, withRouteTryCatch('debts.list', async (c) => {
  const workspaceId = requireWorkspaceId(c)
  const { status } = c.req.valid('query')
  ...
}))
```

This standardized try/catch behavior and reduced repeated guards.

## 5.2 Metadata helper

New file: `apps/api/src/utils/metadata.ts`

Provides:

- `normalizeMetadata(value)`
- `toPrismaMetadata(value)`

Used in `routes/v1/actions/actions.ts` to remove repeated inline metadata normalization/casting.

---

## 6) Route-Wide Try/Catch Standardization

Applied `withRouteTryCatch(...)` pattern across route modules:

- `routes/v1/authentication/actions.ts`
- `routes/v1/users/actions.ts`
- `routes/v1/workspaces/actions.ts`
- `routes/v1/customers/actions.ts`
- `routes/v1/debts/actions.ts`
- `routes/v1/actions/actions.ts`
- `routes/v1/promises/actions.ts`
- `routes/v1/health/actions.ts`
- `routes/v1/test-tenant.ts`
- `routes/v2/health/actions.ts`

Notes:

- domain/validation errors still throw `HTTPException` directly
- unexpected errors are logged with route `scope` + request context and returned as 500

---

## 7) Testing Added

## 7.1 New smoke test script

New file: `apps/api/scripts/test-tenant-auth.ts`

Covers:

1. unauthenticated tenant routes -> `401`
2. authenticated access -> `200`
3. authenticated + invalid `x-workspace-id` -> `403`

Test creates temporary Supabase + DB records and cleans them up.

## 7.2 New npm script

Updated file: `apps/api/package.json`

```json
"test:tenant-auth": "node --import tsx ./scripts/test-tenant-auth.ts"
```

Command:

```bash
pnpm --filter api run test:tenant-auth
```

---

## 8) Documentation Updated

Updated file: `apps/api/README.md`

Added/updated:

- `Smoke Tests` section with `test:tenant-auth`
- standardized route pattern guidelines:
  - `withRouteTryCatch(...)`
  - `requireWorkspaceId(...)`
  - `c.req.valid('json'|'param'|'query')`
- guidance to avoid `c.req.json<...>()` when schema already defines body

---

## 9) Validation Performed

The following checks were executed during the session:

- `pnpm --filter api build`
- `pnpm --filter api run test:tenant-auth`

Result: passing after final fixes.

---

## 10) Important Design Decision

We did **not** remove `apps/api/src/schema/v1/*.schema.ts`.

Reason: Prisma/database schema cannot replace transport/API schema responsibilities (request parsing, validation, OpenAPI generation). The final architecture keeps both layers:

- **Prisma types/models** for persistence and DB-level typing
- **Zod/OpenAPI route schemas** for HTTP contracts and docs

---

## 11) Quick “How to Follow This Pattern”

For new endpoints:

1. define route schema with `createRoute`
2. use `handler.openapi(schema, withRouteTryCatch(scope, async (c) => { ... }))`
3. read validated inputs with `c.req.valid(...)`
4. use `requireWorkspaceId` / `requireUserId` when needed
5. throw `HTTPException` for domain errors
6. let wrapper + global error handler manage unexpected errors

---

If needed, this document can be split into:

- `docs/backend/middleware.md`
- `docs/backend/routing-guidelines.md`
- `docs/backend/testing.md`

for long-term maintainability.
