import { OpenAPIHono } from '@hono/zod-openapi'
import { randomUUID } from 'node:crypto'
import type { AutoLoadRoute } from 'hono-autoload/types'
import type { Env } from '../../../types/index.js'
import { createInvitationSchema, acceptInvitationSchema } from '../../../schema/v1/index.js'
import { env } from '../../../config/env.js'
import { requireUserId, requireWorkspaceId, withRouteTryCatch } from '../../../utils/route-helpers.js'
import { setWorkspaceCookie } from '../../../middleware/cookie.js'

const handler = new OpenAPIHono<Env>()

function roleToString(role: unknown): 'OWNER' | 'MANAGER' | 'AGENT' {
  const normalized = String(role)
  if (normalized === 'OWNER' || normalized === 'MANAGER') return normalized
  return 'AGENT'
}

function ensureCanInvite(currentRole: unknown) {
  const role = roleToString(currentRole)
  return role === 'OWNER' || role === 'MANAGER'
}

handler.openapi(createInvitationSchema, withRouteTryCatch('invitations.create', async (c) => {
  const workspaceId = requireWorkspaceId(c)
  const invitedByUserId = requireUserId(c)
  const prisma = c.get('prisma')

  if (!ensureCanInvite(c.get('currentUser')?.role)) {
    return c.json(
      {
        error: {
          message: 'Only managers can invite members',
          code: 'INVITE_FORBIDDEN',
        },
      },
      403,
    )
  }

  const payload = c.req.valid('json')
  const normalizedEmail = payload.email.trim().toLowerCase()

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  })

  if (existingUser) {
    const existingMembership = await prisma.workspaceMember.findFirst({
      where: {
        userId: existingUser.id,
        workspaceId,
      },
      select: { userId: true },
    })

    if (existingMembership) {
      return c.json(
        {
          error: {
            message: 'This user is already a member of the workspace',
            code: 'MEMBER_ALREADY_EXISTS',
          },
        },
        409,
      )
    }
  }

  await prisma.workspaceInvitation.updateMany({
    where: {
      workspaceId,
      email: normalizedEmail,
      status: 'PENDING',
    },
    data: {
      status: 'REVOKED',
    },
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
    select: {
      id: true,
      email: true,
      role: true,
      token: true,
      expiresAt: true,
      status: true,
    },
  })

  const baseUrl = env.WEB_URL ?? c.req.header('origin') ?? null
  const inviteLink = baseUrl
    ? `${baseUrl.replace(/\/$/, '')}/auth/accept-invite?token=${encodeURIComponent(invitation.token)}`
    : null

  return c.json(
    {
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
    },
    201,
  )
}))

handler.openapi(acceptInvitationSchema, withRouteTryCatch('invitations.accept', async (c) => {
  const userId = requireUserId(c)
  const userEmail = c.get('user')?.email?.toLowerCase().trim()
  const prisma = c.get('prisma')

  const payload = c.req.valid('json')

  const invitation = await prisma.workspaceInvitation.findUnique({
    where: { token: payload.token },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      workspaceId: true,
      workspace: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  if (!invitation || invitation.status !== 'PENDING' || invitation.expiresAt < new Date()) {
    return c.json(
      {
        error: {
          message: 'Invitation not found or expired',
          code: 'INVITATION_INVALID',
        },
      },
      404,
    )
  }

  if (!userEmail || invitation.email.toLowerCase().trim() !== userEmail) {
    return c.json(
      {
        error: {
          message: 'This invitation was issued for a different email account',
          code: 'INVITATION_EMAIL_MISMATCH',
        },
      },
      403,
    )
  }

  const membershipRole = roleToString(invitation.role) === 'OWNER' ? 'MANAGER' : roleToString(invitation.role)

  await prisma.workspaceMember.upsert({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId: invitation.workspaceId,
      },
    },
    update: {
      role: membershipRole,
      status: 'ACTIVE',
    },
    create: {
      userId,
      workspaceId: invitation.workspaceId,
      role: membershipRole,
      status: 'ACTIVE',
    },
  })

  await prisma.workspaceInvitation.update({
    where: {
      id: invitation.id,
    },
    data: {
      status: 'ACCEPTED',
    },
  })

  setWorkspaceCookie(c, invitation.workspace.id)

  return c.json(
    {
      data: {
        workspace: invitation.workspace,
        role: membershipRole,
      },
      message: 'Invitation accepted successfully',
    },
    200,
  )
}))

const routeModule: AutoLoadRoute = {
  path: '/api/v1/invitations',
  handler: handler as unknown as AutoLoadRoute['handler'],
}

export default routeModule
