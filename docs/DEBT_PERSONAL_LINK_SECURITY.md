# Debt Personal Link: Format, Security, and Workspace Enforcement

This document describes the current implementation of debt personal links and the related multi-tenant security behavior in the API.

## Link Format

- Format: `<WEB_URL>/client/view?token=<uuid-token>`
- Example: `https://app.collectra.com/client/view?token=550e8400-e29b-41d4-a716-446655440000`
- `WEB_URL` is read from environment configuration.

## Token Storage Model

Tokens are stored on debt records:

- `DebtRecord.customerToken` (`String? @unique`)
- `DebtRecord.tokenExpiresAt` (`DateTime?`)

Schema location:

- `packages/database/prisma/schema.prisma`

## Token Generation Rules

Implemented in backend service (`apps/api/src/services/debts.ts`):

- Uses `crypto.randomUUID()` (cryptographically secure UUID).
- Never derived from debt IDs, client IDs, timestamps, or other predictable values.
- Uniqueness is enforced by DB unique constraint on `customerToken`.
- When missing, token is generated lazily on first personal-link retrieval.
- Current behavior keeps token stable on repeated calls for the same debt.

## Company API Endpoint (Tenant-Scoped)

Endpoint used by authenticated company users:

- `GET /api/v1/debts/{id}/personal-link`

Behavior:

- Requires authentication.
- Requires an active workspace context.
- Workspace isolation is enforced in backend via debt ownership checks.
- Returns `404` when debt does not exist in current workspace.
- Returns `{ link, token, expiresAt }` for valid in-workspace debt.

Route location:

- `apps/api/src/routes/v1/debts/actions.ts`

## Workspace Selection & Tenant Isolation (Backend-Only)

Active workspace is resolved by backend middleware:

- Source of truth: workspace cookie (`workspace_id`) + membership fallback.
- No request-header override is used for workspace selection.
- Tenant context is attached by auth middleware (`currentWorkspace`, `currentUser`).
- Debt service enforces workspace ownership before returning personal links.

Relevant files:

- `apps/api/src/middleware/authorization.ts`
- `apps/api/src/routes/v1/workspaces/actions.ts`
- `apps/api/src/services/debts.ts`

## Smoke Tests (Validated)

Run:

```bash
pnpm --filter api run test:tenant-auth
pnpm --filter api run test:token-workspace
```

Coverage includes:

- Unauthorized personal-link access returns `401`.
- Backend workspace selection via `/api/v1/workspaces/current` cookie flow.
- Debt listing is scoped to active workspace.
- Personal-link token format is valid UUID.
- Token remains stable across repeated calls for same debt.
- Cross-workspace personal-link access is blocked (`404`).

Test scripts:

- `apps/api/scripts/test-tenant-auth.ts`
- `apps/api/scripts/test-token-workspace.ts`

## Security Assumptions

- Customer access is token-only (no customer auth in customer-facing flow).
- Token acts as bearer credential and must be treated as secret.
- Anyone possessing the token can access that debt customer view.
- All token links must be shared over HTTPS only.
- `tokenExpiresAt` is available for expiry enforcement policy.
