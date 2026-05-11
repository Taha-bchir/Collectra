import { OpenAPIHono } from '@hono/zod-openapi'
import { deleteCookie } from 'hono/cookie'
import type { AutoLoadRoute } from 'hono-autoload/types'

import { WorkspaceMemberStatus, WorkspaceRole } from '@repo/database'

import {
  createWorkspaceSchema,
  deleteWorkspaceSchema,
  getCurrentWorkspaceSchema,
  listWorkspacesSchema,
  setCurrentWorkspaceSchema,
  updateWorkspaceSchema,
} from '../../../schema/v1/index.js'
import { getCookieHelper, setWorkspaceCookie, WORKSPACE_COOKIE_NAME } from '../../../middleware/cookie.js'
import { requireUserId, withRouteTryCatch } from '../../../utils/route-helpers.js'
import type { Env } from '../../../types/index.js'

const handler = new OpenAPIHono<Env>()

handler.openapi(
  getCurrentWorkspaceSchema,
  withRouteTryCatch('workspaces.current', async (c) => {
    const prisma = c.get('prisma')
    const userId = requireUserId(c)
    const preferredWorkspaceId = getCookieHelper(c, WORKSPACE_COOKIE_NAME) || null

    let membership = preferredWorkspaceId
      ? await prisma.workspaceMember.findFirst({
          where: {
            userId,
            workspaceId: preferredWorkspaceId,
            status: WorkspaceMemberStatus.ACTIVE,
          },
          select: {
            workspace: {
              select: {
                id: true,
                name: true,
                website: true,
              },
            },
          },
        })
      : null

    if (!membership?.workspace) {
      membership = await prisma.workspaceMember.findFirst({
        where: { userId, status: WorkspaceMemberStatus.ACTIVE },
        select: {
          workspace: {
            select: {
              id: true,
              name: true,
              website: true,
            },
          },
        },
        orderBy: { joinedAt: 'desc' },
      })
    }

    const workspace = membership?.workspace ?? null

    if (workspace) {
      setWorkspaceCookie(c, workspace.id)
    }

    return c.json({ data: workspace }, 200)
  }),
)

handler.openapi(
  setCurrentWorkspaceSchema,
  withRouteTryCatch('workspaces.setCurrent', async (c) => {
    const prisma = c.get('prisma')
    const userId = requireUserId(c)
    const payload = c.req.valid('json')

    const membership = await prisma.workspaceMember.findFirst({
      where: {
        userId,
        workspaceId: payload.workspaceId,
        status: WorkspaceMemberStatus.ACTIVE,
      },
      select: {
        workspace: {
          select: {
            id: true,
            name: true,
            website: true,
          },
        },
      },
    })

    if (!membership?.workspace) {
      return c.json(
        { error: { message: 'Workspace not found', code: 'WORKSPACE_NOT_FOUND' } },
        404,
      )
    }

    setWorkspaceCookie(c, membership.workspace.id)

    return c.json({ data: membership.workspace }, 200)
  }),
)

handler.openapi(
  listWorkspacesSchema,
  withRouteTryCatch('workspaces.list', async (c) => {
    const prisma = c.get('prisma')
    const userId = requireUserId(c)

    const workspaces = await prisma.workspaceMember.findMany({
      where: { userId, status: WorkspaceMemberStatus.ACTIVE },
      select: {
        role: true,
        workspace: {
          select: {
            id: true,
            name: true,
            website: true,
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    })

    return c.json(
      {
        data: workspaces.map((entry: (typeof workspaces)[number]) => ({
          ...entry.workspace,
          role: entry.role,
        })),
      },
      200,
    )
  }),
)

handler.openapi(
  createWorkspaceSchema,
  withRouteTryCatch('workspaces.create', async (c) => {
    const prisma = c.get('prisma')
    const userId = requireUserId(c)
    const payload = c.req.valid('json')

    const name = payload.name?.trim()
    if (!name) {
      return c.json(
        { error: { message: 'Workspace name is required', code: 'WORKSPACE_NAME_REQUIRED' } },
        400,
      )
    }

    const website = payload.website?.trim() || null

    try {
      const workspace = await prisma.workspace.create({
        data: {
          name,
          website,
          createdByUserId: userId,
          members: {
            create: {
              userId,
              role: WorkspaceRole.OWNER,
            },
          },
        },
        select: {
          id: true,
          name: true,
          website: true,
        },
      })

      return c.json({ data: workspace }, 201)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Workspace creation failed'
      const isConflict = /unique|already|duplicate/i.test(message)

      return c.json(
        {
          error: {
            message: isConflict ? 'Workspace name already exists' : message,
            code: isConflict ? 'WORKSPACE_EXISTS' : 'WORKSPACE_CREATE_FAILED',
          },
        },
        isConflict ? 409 : 400,
      )
    }
  }),
)

handler.openapi(
  updateWorkspaceSchema,
  withRouteTryCatch('workspaces.update', async (c) => {
    const prisma = c.get('prisma')
    const userId = requireUserId(c)
    const { workspaceId } = c.req.valid('param')
    const payload = c.req.valid('json')

    const membership = await prisma.workspaceMember.findFirst({
      where: {
        userId,
        workspaceId,
        status: WorkspaceMemberStatus.ACTIVE,
        role: WorkspaceRole.OWNER,
      },
      select: {
        workspace: {
          select: {
            id: true,
          },
        },
      },
    })

    if (!membership?.workspace) {
      return c.json(
        { error: { message: 'Workspace not found or forbidden', code: 'WORKSPACE_FORBIDDEN' } },
        403,
      )
    }

    const workspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        name: payload.name.trim(),
        website: payload.website === undefined ? undefined : (payload.website?.trim() || null),
      },
      select: {
        id: true,
        name: true,
        website: true,
      },
    })

    if (getCookieHelper(c, WORKSPACE_COOKIE_NAME) === workspaceId) {
      setWorkspaceCookie(c, workspace.id)
    }

    return c.json({ data: workspace }, 200)
  }),
)

handler.openapi(
  deleteWorkspaceSchema,
  withRouteTryCatch('workspaces.delete', async (c) => {
    const prisma = c.get('prisma')
    const userId = requireUserId(c)
    const { workspaceId } = c.req.valid('param')

    const membership = await prisma.workspaceMember.findFirst({
      where: {
        userId,
        workspaceId,
        status: WorkspaceMemberStatus.ACTIVE,
        role: WorkspaceRole.OWNER,
      },
      select: {
        workspaceId: true,
      },
    })

    if (!membership) {
      return c.json(
        { error: { message: 'Workspace not found or forbidden', code: 'WORKSPACE_FORBIDDEN' } },
        403,
      )
    }

    await prisma.workspace.delete({
      where: { id: workspaceId },
    })

    const remainingWorkspace = await prisma.workspaceMember.findFirst({
      where: {
        userId,
        status: WorkspaceMemberStatus.ACTIVE,
      },
      select: {
        workspace: {
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        joinedAt: 'desc',
      },
    })

    if (remainingWorkspace?.workspace?.id) {
      setWorkspaceCookie(c, remainingWorkspace.workspace.id)
    } else {
      deleteCookie(c, WORKSPACE_COOKIE_NAME, { path: '/' })
    }

    return c.json({ data: { id: workspaceId } }, 200)
  }),
)

const routeModule: AutoLoadRoute = {
  path: '/api/v1/workspaces',
  handler: handler as unknown as AutoLoadRoute['handler'],
}

export default routeModule
