# Frontend + Backend Changes (2026-02-27)

This document summarizes the implemented changes across backend and frontend, with code excerpts.

---

## Backend Changes

### 1) Auth middleware now resolves tenant context (workspace) from backend sources

File: `apps/api/src/middleware/authorization.ts`

```ts
export async function attachTenantContext(
  c: Parameters<MiddlewareHandler<Env>>[0],
  user: AuthUserContext
) {
  const prisma = c.get('prisma')

  const workspaceCookie = getCookie(c, WORKSPACE_COOKIE_NAME) || null

  let membership = null

  if (workspaceCookie) {
    membership = await prisma.workspaceMember.findFirst({
      where: {
        userId: user.id,
        workspaceId: workspaceCookie,
      },
      select: {
        role: true,
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })
  }

  if (!membership?.workspace) {
    membership = await prisma.workspaceMember.findFirst({
      where: {
        userId: user.id,
      },
      select: {
        role: true,
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        joinedAt: 'desc',
      },
    })
  }

  if (!membership?.workspace) {
    throw new HTTPException(403, { message: 'No workspace found for user' })
  }

  c.set('currentWorkspace', {
    id: membership.workspace.id,
    name: membership.workspace.name,
  })

  c.set('currentUser', {
    id: user.id,
    email: user.email,
    role: membership.role,
  })
}
```

Result:
- Workspace selection/enforcement is backend-managed (cookie + membership fallback).
- Tenant-scoped routes use `currentWorkspace` set by middleware.

### 2) Workspace switch endpoint sets backend cookie

File: `apps/api/src/routes/v1/workspaces/actions.ts`

```ts
handler.openapi(setCurrentWorkspaceSchema, withRouteTryCatch('workspaces.setCurrent', async (c) => {
  const prisma = c.get("prisma");
  const userId = requireUserId(c);

  const payload = c.req.valid('json');

  const membership = await prisma.workspaceMember.findFirst({
    where: {
      userId,
      workspaceId: payload.workspaceId,
    },
    select: {
      workspace: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!membership?.workspace) {
    return c.json(
      { error: { message: "Workspace not found", code: "WORKSPACE_NOT_FOUND" } },
      404
    );
  }

  setWorkspaceCookie(c, membership.workspace.id);

  return c.json({ data: membership.workspace }, 200);
}));
```

Result:
- Frontend requests workspace switch via API.
- Backend persists selected workspace in cookie.

### 3) Debt personal-link endpoint (tenant-scoped)

File: `apps/api/src/routes/v1/debts/actions.ts`

```ts
const getPersonalLinkSchema = createRoute({
  method: 'get',
  path: '/{id}/personal-link',
  tags: ['debts'],
  summary: 'Get secure personal link for customer (debt view)',
  ...
});

handler.openapi(getPersonalLinkSchema, withRouteTryCatch('debts.personalLink', async (c) => {
  const workspaceId = requireWorkspaceId(c);

  const { id } = c.req.valid('param');

  const service = new DebtsService(c.get('prisma'));
  const link = await service.getPersonalLink(workspaceId, id);

  const debt = await service.getById(workspaceId, id);

  return c.json({
    data: {
      link,
      token: debt.customerToken,
      expiresAt: debt.tokenExpiresAt?.toISOString() || null,
    },
  });
}));
```

Result:
- Endpoint is mounted as `GET /api/v1/debts/{id}/personal-link`.
- Access is workspace-scoped and protected.

### 4) Token generation security in debt service

File: `apps/api/src/services/debts.ts`

```ts
async generateCustomerToken(workspaceId: string, debtId: string) {
  const debt = await this.getById(workspaceId, debtId)

  if (debt.customerToken) {
    return debt.customerToken
  }

  const token = randomUUID()
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  const updated = await this.prisma.debtRecord.update({
    where: { id: debtId },
    data: {
      customerToken: token,
      tokenExpiresAt: expiresAt,
    },
    select: { customerToken: true },
  })

  return updated.customerToken
}

async getPersonalLink(workspaceId: string, debtId: string) {
  const debt = await this.getById(workspaceId, debtId)

  if (!debt.customerToken) {
    return this.generateCustomerToken(workspaceId, debtId).then(token =>
      `${env.WEB_URL}/client/view?token=${token}`
    )
  }

  return `${env.WEB_URL}/client/view?token=${debt.customerToken}`
}
```

Result:
- UUID token generation is cryptographically secure.
- Link format: `${WEB_URL}/client/view?token=<uuid>`.
- Existing token remains stable on repeated calls.

---

## Frontend Changes / Integration

### 1) Workspace store uses backend endpoints (no workspace header management)

File: `apps/web/store/workspace-store.ts`

```ts
const { data } = await client.post<{ data: BackendWorkspace }>(
  WORKSPACE_ROUTES.setCurrent,
  { workspaceId }
)
set({ workspace: data.data, loading: false, error: null })
```

```ts
const { data } = await client.get<{ data: BackendWorkspace | null }>(
  WORKSPACE_ROUTES.current
)
set({ workspace: data.data ?? null, loading: false, error: null })
```

Result:
- Frontend asks backend to switch workspace via `/api/v1/workspaces/current`.
- Active workspace is retrieved from backend, not computed client-side.

### 2) UI workspace switch triggers backend flow

File: `apps/web/components/common/app-sidebar.tsx`

```tsx
const handleWorkspaceSelect = async (workspaceId: string) => {
  if (workspace?.id === workspaceId) return
  try {
    await setCurrentWorkspace(workspaceId)
    await fetchCurrentWorkspace()
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to switch workspace"
    setCreateError(message)
  }
}
```

Result:
- Workspace switch action in UI calls backend endpoint and refreshes current workspace.

### 3) Frontend route constants for workspace API

File: `apps/web/features/workspaces/services/workspace-service.ts`

```ts
export const WORKSPACE_ROUTES = {
  list: "/api/v1/workspaces",
  current: "/api/v1/workspaces/current",
  create: "/api/v1/workspaces",
  setCurrent: "/api/v1/workspaces/current",
} as const;
```

Result:
- Frontend and backend stay aligned on workspace endpoints.

---

## Tests Added / Updated

### 1) Tenant + auth smoke test

File: `apps/api/scripts/test-tenant-auth.ts`

Run:

```bash
pnpm --filter api run test:tenant-auth
```

Validates:
- protected routes return `401` without auth
- protected routes return `200` with valid auth
- backend workspace context resolution works for tenant routes

### 2) Token + workspace smoke test

File: `apps/api/scripts/test-token-workspace.ts`

Run:

```bash
pnpm --filter api run test:token-workspace
```

Validates:
- personal-link unauthorized access returns `401`
- workspace switch via backend (`POST /api/v1/workspaces/current`)
- debt list scoped to current workspace
- token format and stability on repeated calls
- cross-workspace personal-link access blocked (`404`)

---

## Related Docs

- `docs/DEBT_PERSONAL_LINK_SECURITY.md`
- `docs/API_REFACTOR_SUMMARY_2026-02-25.md`
