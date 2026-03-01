import { OpenAPIHono } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'
import type { Context } from 'hono'
import type { AutoLoadRoute } from 'hono-autoload/types'
import type { Env } from '../../../types/index.js'
import {
  listInternalUsersSchema,
  updateInternalUserRoleSchema,
  updateInternalUserStatusSchema,
} from '../../../schema/v1/index.js'
import { requireWorkspaceId, requireUserId, withRouteTryCatch } from '../../../utils/route-helpers.js'

const handler = new OpenAPIHono<Env>()

function roleToString(role: unknown): 'OWNER' | 'MANAGER' | 'AGENT' {
  const normalized = String(role)
  if (normalized === 'OWNER' || normalized === 'MANAGER') return normalized
  return 'AGENT'
}

function statusToString(status: unknown): 'ACTIVE' | 'INACTIVE' {
  return String(status) === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE'
}

function ensureCanManageMembers(c: Context<Env>) {
  const role = roleToString(c.get('currentUser')?.role)
  if (role !== 'OWNER' && role !== 'MANAGER') {
    throw new HTTPException(403, {
      message: 'Only managers can manage workspace members',
    })
  }
}

handler.openapi(listInternalUsersSchema, withRouteTryCatch('internalUsers.list', async (c) => {
  const workspaceId = requireWorkspaceId(c)
  const userId = requireUserId(c)
  const prisma = c.get('prisma')

  type InternalUserListMember = {
    userId: string
    role: unknown
    status: unknown
    joinedAt: Date
    user: {
      email: string
      fullName: string | null
    }
  }

  const members: InternalUserListMember[] = await prisma.workspaceMember.findMany({
    where: {
      workspaceId,
    },
    select: {
      userId: true,
      role: true,
      status: true,
      joinedAt: true,
      user: {
        select: {
          email: true,
          fullName: true,
        },
      },
    },
    orderBy: {
      joinedAt: 'asc',
    },
  })

  const currentMember = members.find((member) => member.userId === userId)
  const currentUserRole = roleToString(currentMember?.role)

  return c.json(
    {
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
    },
    200,
  )
}))

handler.openapi(updateInternalUserRoleSchema, withRouteTryCatch('internalUsers.updateRole', async (c) => {
  const workspaceId = requireWorkspaceId(c)
  const userId = requireUserId(c)
  const prisma = c.get('prisma')

  ensureCanManageMembers(c)

  const { memberId } = c.req.valid('param')
  const payload = c.req.valid('json')

  const member = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      userId: memberId,
    },
    select: {
      userId: true,
      role: true,
      status: true,
      joinedAt: true,
      user: {
        select: {
          email: true,
          fullName: true,
        },
      },
    },
  })

  if (!member) {
    throw new HTTPException(404, {
      message: 'Member not found in current workspace',
    })
  }

  if (member.userId === userId) {
    return c.json(
      { error: { message: 'You cannot change your own role', code: 'SELF_ROLE_CHANGE_FORBIDDEN' } },
      400,
    )
  }

  if (roleToString(member.role) === 'OWNER') {
    return c.json(
      { error: { message: 'Owner role cannot be changed', code: 'OWNER_ROLE_CHANGE_FORBIDDEN' } },
      400,
    )
  }

  const updated = await prisma.workspaceMember.update({
    where: {
      userId_workspaceId: {
        userId: memberId,
        workspaceId,
      },
    },
    data: {
      role: payload.role,
    },
    select: {
      userId: true,
      role: true,
      status: true,
      joinedAt: true,
      user: {
        select: {
          email: true,
          fullName: true,
        },
      },
    },
  })

  return c.json(
    {
      data: {
        id: updated.userId,
        email: updated.user.email,
        fullName: updated.user.fullName ?? null,
        role: roleToString(updated.role),
        status: statusToString(updated.status),
        joinedAt: updated.joinedAt.toISOString(),
      },
    },
    200,
  )
}))

handler.openapi(updateInternalUserStatusSchema, withRouteTryCatch('internalUsers.updateStatus', async (c) => {
  const workspaceId = requireWorkspaceId(c)
  const userId = requireUserId(c)
  const prisma = c.get('prisma')

  ensureCanManageMembers(c)

  const { memberId } = c.req.valid('param')
  const payload = c.req.valid('json')

  const member = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      userId: memberId,
    },
    select: {
      userId: true,
      role: true,
      status: true,
      joinedAt: true,
      user: {
        select: {
          email: true,
          fullName: true,
        },
      },
    },
  })

  if (!member) {
    throw new HTTPException(404, {
      message: 'Member not found in current workspace',
    })
  }

  if (member.userId === userId && payload.status === 'INACTIVE') {
    return c.json(
      { error: { message: 'You cannot deactivate your own account', code: 'SELF_DEACTIVATE_FORBIDDEN' } },
      400,
    )
  }

  if (roleToString(member.role) === 'OWNER' && payload.status === 'INACTIVE') {
    return c.json(
      { error: { message: 'Owner account cannot be deactivated', code: 'OWNER_DEACTIVATE_FORBIDDEN' } },
      400,
    )
  }

  const updated = await prisma.workspaceMember.update({
    where: {
      userId_workspaceId: {
        userId: memberId,
        workspaceId,
      },
    },
    data: {
      status: payload.status,
    },
    select: {
      userId: true,
      role: true,
      status: true,
      joinedAt: true,
      user: {
        select: {
          email: true,
          fullName: true,
        },
      },
    },
  })

  return c.json(
    {
      data: {
        id: updated.userId,
        email: updated.user.email,
        fullName: updated.user.fullName ?? null,
        role: roleToString(updated.role),
        status: statusToString(updated.status),
        joinedAt: updated.joinedAt.toISOString(),
      },
    },
    200,
  )
}))

const routeModule: AutoLoadRoute = {
  path: '/api/v1/internal-users',
  handler: handler as unknown as AutoLoadRoute['handler'],
}

export default routeModule
