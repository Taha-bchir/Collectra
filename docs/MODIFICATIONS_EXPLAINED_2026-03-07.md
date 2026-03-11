# Modifications Explained (2026-03-07)

This document summarizes the implemented changes and shows the key code snippets.

## 1) Shared Auth Types (Monorepo)

File: `packages/types/src/auth.ts`

```ts
export type RegisterPayload = {
  email: string
  password: string
  fullName: string
  // Required for regular signup; optional when inviteToken is provided.
  workspaceName?: string
  website?: string
  // Optional token used for manager-driven onboarding without email infrastructure.
  inviteToken?: string
}
```

Why this change:

- Centralizes register DTO in the shared package.
- Supports two register modes:

1. Normal signup (`workspaceName` required logically).
2. Invite onboarding (`inviteToken` provided, workspace auto-assigned).

## 2) Register Request Validation (API Schema)

File: `apps/api/src/schema/v1/authentication.schema.ts`

```ts
const registerRequestSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8).max(72),
  })
  .extend(userProfileRequestSchema.shape)
  .extend({
    workspaceName: z.string().min(1).max(120).optional(),
    website: z.string().url().max(255).optional(),
    inviteToken: z.string().uuid().optional(),
  })
  .superRefine((value, ctx) => {
    // Regular signup needs a workspace; invite onboarding uses inviteToken instead.
    if (!value.inviteToken && !value.workspaceName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['workspaceName'],
        message: 'workspaceName is required when inviteToken is not provided',
      })
    }
  })
```

Why this change:

- Keeps API contract strict.
- Prevents invalid payloads where neither `inviteToken` nor `workspaceName` is provided.

## 3) Registration Service: Invite Token Consumption

File: `apps/api/src/services/authentication.ts`

### 3.1 Mode switch inside `registerUser`

```ts
const selectedWorkspace = payload.inviteToken
  ? await this.consumeInvitationOnRegister({
      userId: dbUser.id,
      userEmail: dbUser.email,
      inviteToken: payload.inviteToken,
    })
  : await this.createOwnedWorkspace(dbUser.id, payload.workspaceName, payload.website)
```

### 3.2 Invite validation + acceptance

```ts
if (!invitation || invitation.status !== InvitationStatus.PENDING || invitation.expiresAt < new Date()) {
  const error = new Error('Invitation is invalid or expired.')
  ;(error as { status?: number }).status = 404
  throw error
}

if (invitation.email.toLowerCase().trim() !== params.userEmail.toLowerCase().trim()) {
  const error = new Error('Invitation email does not match this account.')
  ;(error as { status?: number }).status = 403
  throw error
}

await tx.workspaceMember.upsert({
  where: {
    userId_workspaceId: {
      userId: params.userId,
      workspaceId: invitation.workspaceId,
    },
  },
  update: {
    role: membershipRole,
    status: WorkspaceMemberStatus.ACTIVE,
  },
  create: {
    userId: params.userId,
    workspaceId: invitation.workspaceId,
    role: membershipRole,
    status: WorkspaceMemberStatus.ACTIVE,
  },
})

await tx.workspaceInvitation.update({
  where: { id: invitation.id },
  data: { status: InvitationStatus.ACCEPTED },
})
```

Why this change:

- Makes onboarding via invite truly functional without mail infra.
- Enforces one-time token semantics and email matching.
- Auto-activates workspace membership in a transaction.

## 4) Register Route: Workspace Cookie + Better Error Status

File: `apps/api/src/routes/v1/authentication/actions.ts`

```ts
if (result.session) {
  setAuthCookies(c, result.session.accessToken, result.session.refreshToken, result.session.expiresIn)
  setWorkspaceCookie(c, result.workspace.id)
}
```

```ts
const status: 400 | 403 | 404 | 409 | 500 = isConflict
  ? 409
  : normalized.status >= 500
  ? 500
  : normalized.status === 403 || normalized.status === 404
  ? normalized.status
  : 400
```

Why this change:

- Ensures newly registered invited users immediately have an active workspace context.
- Preserves specific invite errors (`403` mismatch, `404` invalid/expired token) instead of returning generic `400`.

## 5) Signup UI: Invite Mode (2-Step Flow)

File: `apps/web/app/(public)/auth/sign-up/page.tsx`

### 5.1 Detect invite mode from query

```ts
const rawInviteToken = searchParams.get('inviteToken')?.trim() ?? ''
const inviteToken = isUuid(rawInviteToken) ? rawInviteToken : ''
const hasInviteToken = Boolean(inviteToken)
const finalStep = hasInviteToken ? 2 : 3
```

### 5.2 Submit payload per mode

```ts
const payload = {
  email,
  password,
  fullName,
  workspaceName: hasInviteToken ? undefined : workspaceName,
  website: hasInviteToken ? undefined : (website.trim() ? website.trim() : undefined),
  inviteToken: hasInviteToken ? inviteToken : undefined,
} as Parameters<typeof signUp>[0]
```

### 5.3 Redirect behavior fix

```ts
const redirectTo = hasInviteToken && redirectParam?.startsWith('/auth/accept-invite')
  ? '/overview'
  : (redirectParam || '/overview')
```

Why this change:

- Invite signup no longer asks for workspace creation.
- Prevents returning to the accept page after token was already consumed.
- Keeps normal signup unchanged (still 3 steps).

## 6) Team Management Hardening (Manager-only)

File: `apps/web/app/(dashboard)/team/page.tsx`

```ts
useEffect(() => {
  if (!loading && permissions && !permissions.canManageMembers) {
    toast.error('Only managers can access the Team page')
    router.replace('/overview')
  }
}, [loading, permissions, router])
```

```ts
if (!canManage) {
  toast.error('Only managers can invite members')
  return
}
```

```tsx
<TableHead>Last login</TableHead>
```

Why this change:

- Locks team management actions to manager/owner capability.
- Adds page-level guard and user feedback.
- Displays `lastLogin` column (currently nullable / fallback).

## 7) Sidebar Visibility for Team Menu

File: `apps/web/components/common/app-sidebar.tsx`

```ts
void listTeamMembers()
  .then(({ permissions }) => {
    setCanManageTeam(permissions.canManageMembers)
  })
  .catch(() => {
    setCanManageTeam(false)
  })

const visibleNavItems = navItems.filter((item) => {
  if (item.href === '/team') {
    return canManageTeam
  }
  return true
})
```

Why this change:

- Hides Team navigation from users that cannot manage members.
- Aligns UI visibility with backend permissions.

## 8) Build Verification

Executed commands:

```bash
pnpm --filter @repo/types build
pnpm --filter api build
pnpm --filter web build
```

Result:

- All builds passed successfully.
- Non-blocking warning: `baseline-browser-mapping` is outdated (does not break build).
