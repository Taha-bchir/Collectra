# Team / Members Management Implementation (2026-03-01)

## Goal implemented

Provide full UI controls on Team/Members so a Manager can:

- invite members
- change roles (MANAGER / AGENT)
- deactivate/reactivate accounts

All actions are wired to backend APIs with tenant-scoped checks and role-based restrictions.

---

## What was done

### 1) Backend APIs added

- `GET /api/v1/internal-users` — list members in current workspace + permissions
- `PATCH /api/v1/internal-users/{memberId}/role` — change member role
- `PATCH /api/v1/internal-users/{memberId}/status` — deactivate/reactivate member
- `POST /api/v1/invitations` — create invite token/link

Files:

- `apps/api/src/routes/v1/internal-users/actions.ts`
- `apps/api/src/routes/v1/invitations/actions.ts`
- `apps/api/src/schema/v1/internal-users.schema.ts`
- `apps/api/src/schema/v1/invitations.schema.ts`
- `apps/api/src/schema/v1/index.ts` (exports added)

### 2) Tenant + auth enforcement extended

Updated auth middleware so new endpoints are protected and tenant-scoped.

File:

- `apps/api/src/middleware/authorization.ts`

### 3) Data model updated

Added:

- `WorkspaceRole.MANAGER`
- `WorkspaceMember.status` (`ACTIVE | INACTIVE`)
- `WorkspaceInvitation` model

Files:

- `packages/database/prisma/schema.prisma`
- `packages/database/prisma/migrations/20260301123000_team_member_management/migration.sql`

### 4) Team page fully wired

Replaced placeholder API usage with real service calls.

Files:

- `apps/web/features/team/services/team-service.ts`
- `apps/web/app/(dashboard)/team/page.tsx`

UI behavior implemented:

- invite form + success output with shareable link/token and expiry next steps
- role change action with confirmation dialog flow
- deactivate/reactivate action with confirmation dialog
- immediate table updates after successful API responses
- manager-only controls via backend-provided permissions

### 5) Workspace selection behavior hardened

Current/list/set workspace endpoints now consider only active memberships.

File:

- `apps/api/src/routes/v1/workspaces/actions.ts`

---

## Key backend code

### `internal-users` route (core logic)

```ts
handler.openapi(listInternalUsersSchema, withRouteTryCatch('internalUsers.list', async (c) => {
  const workspaceId = requireWorkspaceId(c)
  const userId = requireUserId(c)
  const prisma = c.get('prisma')

  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    select: {
      userId: true,
      role: true,
      status: true,
      joinedAt: true,
      user: { select: { email: true, fullName: true } },
    },
    orderBy: { joinedAt: 'asc' },
  })

  const currentMember = members.find((member) => member.userId === userId)
  const currentUserRole = roleToString(currentMember?.role)

  return c.json({
    data: members.map((member) => ({
      id: member.userId,
      email: member.user.email,
      fullName: member.user.fullName ?? null,
      role: roleToString(member.role),
      status: statusToString(member.status),
      joinedAt: member.joinedAt.toISOString(),
    })),
    permissions: {
      canManageMembers: currentUserRole === 'OWNER' || currentUserRole === 'MANAGER',
      currentUserRole,
    },
  }, 200)
}))
```

```ts
handler.openapi(updateInternalUserRoleSchema, withRouteTryCatch('internalUsers.updateRole', async (c) => {
  const workspaceId = requireWorkspaceId(c)
  const userId = requireUserId(c)
  ensureCanManageMembers(c)

  const { memberId } = c.req.valid('param')
  const payload = c.req.valid('json')

  const member = await prisma.workspaceMember.findFirst({
    where: { workspaceId, userId: memberId },
    select: { userId: true, role: true, status: true, joinedAt: true, user: { select: { email: true, fullName: true } } },
  })

  if (!member) throw new HTTPException(404, { message: 'Member not found in current workspace' })
  if (member.userId === userId) return c.json({ error: { message: 'You cannot change your own role', code: 'SELF_ROLE_CHANGE_FORBIDDEN' } }, 400)
  if (roleToString(member.role) === 'OWNER') return c.json({ error: { message: 'Owner role cannot be changed', code: 'OWNER_ROLE_CHANGE_FORBIDDEN' } }, 400)

  const updated = await prisma.workspaceMember.update({
    where: { userId_workspaceId: { userId: memberId, workspaceId } },
    data: { role: payload.role },
    select: { userId: true, role: true, status: true, joinedAt: true, user: { select: { email: true, fullName: true } } },
  })

  return c.json({
    data: {
      id: updated.userId,
      email: updated.user.email,
      fullName: updated.user.fullName ?? null,
      role: roleToString(updated.role),
      status: statusToString(updated.status),
      joinedAt: updated.joinedAt.toISOString(),
    },
  }, 200)
}))
```

### `invitations` route (core logic)

```ts
handler.openapi(createInvitationSchema, withRouteTryCatch('invitations.create', async (c) => {
  const workspaceId = requireWorkspaceId(c)
  const invitedByUserId = requireUserId(c)
  const prisma = c.get('prisma')

  if (!ensureCanInvite(c.get('currentUser')?.role)) {
    return c.json({ error: { message: 'Only managers can invite members', code: 'INVITE_FORBIDDEN' } }, 403)
  }

  const payload = c.req.valid('json')
  const normalizedEmail = payload.email.trim().toLowerCase()

  const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } })
  if (existingUser) {
    const existingMembership = await prisma.workspaceMember.findFirst({
      where: { userId: existingUser.id, workspaceId },
      select: { userId: true },
    })
    if (existingMembership) {
      return c.json({ error: { message: 'This user is already a member of the workspace', code: 'MEMBER_ALREADY_EXISTS' } }, 409)
    }
  }

  await prisma.workspaceInvitation.updateMany({
    where: { workspaceId, email: normalizedEmail, status: 'PENDING' },
    data: { status: 'REVOKED' },
  })

  const token = randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const invitation = await prisma.workspaceInvitation.create({
    data: {
      workspaceId,
      invitedByUserId,
      email: normalizedEmail,
      role: payload.role,
      token,
      expiresAt,
      status: 'PENDING',
    },
    select: { id: true, email: true, role: true, token: true, expiresAt: true, status: true },
  })

  const baseUrl = env.WEB_URL ?? c.req.header('origin') ?? null
  const inviteLink = baseUrl ? `${baseUrl.replace(/\/$/, '')}/auth/accept-invite?token=${encodeURIComponent(invitation.token)}` : null

  return c.json({
    data: {
      id: invitation.id,
      email: invitation.email,
      role: roleToString(invitation.role) === 'OWNER' ? 'MANAGER' : roleToString(invitation.role),
      token: invitation.token,
      inviteLink,
      expiresAt: invitation.expiresAt.toISOString(),
      status: invitation.status,
    },
    message: inviteLink
      ? 'Invitation created. Share the invite link with the new member.'
      : 'Invitation created. Share the token with the new member to complete onboarding.',
  }, 201)
}))
```

### Authorization/tenant scope extension

```ts
const PROTECTED_PATTERNS = [
  '/api/v1/users/*',
  '/api/v1/workspaces/*',
  '/api/v1/internal-users',
  '/api/v1/internal-users/*',
  '/api/v1/invitations',
  '/api/v1/invitations/*',
  // ...
] as const

const TENANT_SCOPED_PREFIXES = [
  '/api/v1/internal-users',
  '/api/v1/invitations',
  // ...
] as const
```

```ts
membership = await prisma.workspaceMember.findFirst({
  where: {
    userId: user.id,
    workspaceId: workspaceCookie,
    status: 'ACTIVE',
  },
  // ...
})
```

---

## Key frontend code

### Team API client service

```ts
export const TEAM_ROUTES = {
  listMembers: '/api/v1/internal-users',
  updateRole: (memberId: string) => `/api/v1/internal-users/${memberId}/role`,
  updateStatus: (memberId: string) => `/api/v1/internal-users/${memberId}/status`,
  invite: '/api/v1/invitations',
} as const

export async function listTeamMembers() {
  const client = getTeamClient()
  const { data } = await client.get(TEAM_ROUTES.listMembers)
  return { members: data.data, permissions: data.permissions }
}

export async function inviteTeamMember(payload: InviteMemberPayload) {
  const client = getTeamClient()
  const { data } = await client.post(TEAM_ROUTES.invite, payload)
  return { ...data.data, message: data.message }
}
```

### Team page actions

```tsx
const handleInvite = async () => {
  if (!inviteEmail.trim()) return toast.error('Email is required')

  setInviteLoading(true)
  try {
    const result = await inviteTeamMember({ email: inviteEmail.trim(), role: inviteRole })
    setInviteResult({
      inviteLink: result.inviteLink,
      token: result.token,
      message: result.message,
      expiresAt: result.expiresAt,
    })
    setInviteEmail('')
    toast.success('Invitation created successfully')
  } catch (error) {
    toast.error(getErrorMessage(error, 'Failed to send invitation'))
  } finally {
    setInviteLoading(false)
  }
}
```

```tsx
const handleChangeRole = async () => {
  if (!selectedMember) return

  setRoleLoading(true)
  try {
    const updated = await updateTeamMemberRole(selectedMember.id, newRole)
    setMembers((prev) => prev.map((member) => (member.id === selectedMember.id ? updated : member)))
    toast.success('Role updated successfully')
    setSelectedMember(null)
    setRoleDialogOpen(false)
  } catch (error) {
    toast.error(getErrorMessage(error, 'Failed to update role'))
  } finally {
    setRoleLoading(false)
  }
}
```

```tsx
const handleToggleStatus = async (member: TeamMember) => {
  const newStatus = member.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
  setStatusLoading(member.id)

  try {
    const updated = await updateTeamMemberStatus(member.id, newStatus)
    setMembers((prev) => prev.map((item) => (item.id === member.id ? updated : item)))
    toast.success(`Member ${newStatus.toLowerCase()} successfully`)
  } catch (error) {
    toast.error(getErrorMessage(error, 'Failed to update status'))
  } finally {
    setStatusLoading(null)
  }
}
```

---

## Prisma model and migration code

### Prisma schema additions

```prisma
enum WorkspaceRole {
  OWNER
  MANAGER
  AGENT
}

enum WorkspaceMemberStatus {
  ACTIVE
  INACTIVE
}

model WorkspaceMember {
  userId      String                @db.Uuid
  workspaceId String                @db.Uuid
  role        WorkspaceRole
  status      WorkspaceMemberStatus @default(ACTIVE)
  joinedAt    DateTime              @default(now())

  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@id([userId, workspaceId])
}

model WorkspaceInvitation {
  id              String           @id @default(uuid()) @db.Uuid
  workspaceId     String           @db.Uuid
  invitedByUserId String           @db.Uuid
  email           String
  role            WorkspaceRole    @default(AGENT)
  token           String           @unique
  expiresAt       DateTime
  status          InvitationStatus @default(PENDING)
  createdAt       DateTime         @default(now())

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  invitedBy User      @relation(fields: [invitedByUserId], references: [id], onDelete: Cascade)

  @@index([workspaceId, status])
  @@index([email])
}
```

### Migration SQL

```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'WorkspaceRole' AND e.enumlabel = 'MANAGER'
  ) THEN
    ALTER TYPE "WorkspaceRole" ADD VALUE 'MANAGER';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WorkspaceMemberStatus') THEN
    CREATE TYPE "WorkspaceMemberStatus" AS ENUM ('ACTIVE', 'INACTIVE');
  END IF;
END $$;

ALTER TABLE "WorkspaceMember"
ADD COLUMN IF NOT EXISTS "status" "WorkspaceMemberStatus" NOT NULL DEFAULT 'ACTIVE';

CREATE TABLE IF NOT EXISTS "WorkspaceInvitation" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspaceId" UUID NOT NULL,
  "invitedByUserId" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "role" "WorkspaceRole" NOT NULL DEFAULT 'AGENT',
  "token" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WorkspaceInvitation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkspaceInvitation_token_key" UNIQUE ("token"),
  CONSTRAINT "WorkspaceInvitation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WorkspaceInvitation_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "WorkspaceInvitation_workspaceId_status_idx"
ON "WorkspaceInvitation"("workspaceId", "status");

CREATE INDEX IF NOT EXISTS "WorkspaceInvitation_email_idx"
ON "WorkspaceInvitation"("email");
```

---

## Validation done

- `pnpm --filter @repo/database run db:generate` ✅
- `pnpm --filter api exec tsc --noEmit` ✅
- `pnpm --filter web exec tsc --noEmit` ✅

Migration status currently indicates pending migration:

- `20260301123000_team_member_management`

---

## Full code locations (source of truth)

- `apps/api/src/routes/v1/internal-users/actions.ts`
- `apps/api/src/routes/v1/invitations/actions.ts`
- `apps/api/src/schema/v1/internal-users.schema.ts`
- `apps/api/src/schema/v1/invitations.schema.ts`
- `apps/api/src/middleware/authorization.ts`
- `apps/api/src/routes/v1/workspaces/actions.ts`
- `apps/web/features/team/services/team-service.ts`
- `apps/web/app/(dashboard)/team/page.tsx`
- `packages/database/prisma/schema.prisma`
- `packages/database/prisma/migrations/20260301123000_team_member_management/migration.sql`
