import { createRoute, z } from '@hono/zod-openapi'
import { WorkspaceMemberStatus, WorkspaceRole } from '@repo/database'

const roleSchema = z.nativeEnum(WorkspaceRole)
const updatableRoleSchema = z.union([z.literal(WorkspaceRole.MANAGER), z.literal(WorkspaceRole.AGENT)])
const memberStatusSchema = z.nativeEnum(WorkspaceMemberStatus)

const errorResponseSchema = z.object({
  error: z.object({
    message: z.string(),
    code: z.string().optional(),
  }),
})

const internalUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().nullable(),
  role: roleSchema,
  status: memberStatusSchema,
  joinedAt: z.string().datetime(),
  // Optional until a dedicated source for auth last sign-in is wired.
  lastLogin: z.string().datetime().nullable().optional(),
})

export const listInternalUsersSchema = createRoute({
  method: 'get',
  path: '/',
  tags: ['internal-users'],
  summary: 'List workspace internal users',
  description: 'Returns users in the current workspace with role/status and management permissions.',
  responses: {
    200: {
      description: 'Internal users list',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(internalUserSchema),
            permissions: z.object({
              canManageMembers: z.boolean(),
              currentUserRole: roleSchema,
            }),
          }),
        },
      },
    },
  },
})

export const updateInternalUserRoleSchema = createRoute({
  method: 'patch',
  path: '/{memberId}/role',
  tags: ['internal-users'],
  summary: 'Update internal user role',
  description: 'Updates a workspace member role (MANAGER or AGENT).',
  request: {
    params: z.object({
      memberId: z.string().uuid(),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            role: updatableRoleSchema,
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Role updated',
      content: {
        'application/json': {
          schema: z.object({
            data: internalUserSchema,
          }),
        },
      },
    },
    400: {
      description: 'Invalid operation',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    403: {
      description: 'Forbidden',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    404: {
      description: 'Member not found',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
})

export const updateInternalUserStatusSchema = createRoute({
  method: 'patch',
  path: '/{memberId}/status',
  tags: ['internal-users'],
  summary: 'Update internal user status',
  description: 'Activates/deactivates a workspace member account.',
  request: {
    params: z.object({
      memberId: z.string().uuid(),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            status: memberStatusSchema,
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Status updated',
      content: {
        'application/json': {
          schema: z.object({
            data: internalUserSchema,
          }),
        },
      },
    },
    400: {
      description: 'Invalid operation',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    403: {
      description: 'Forbidden',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    404: {
      description: 'Member not found',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
})

export const deleteInternalUserSchema = createRoute({
  method: 'delete',
  path: '/{memberId}',
  tags: ['internal-users'],
  summary: 'Delete internal user from workspace',
  description: 'Removes a workspace member from the current workspace. Only managers and owners can perform this action.',
  request: {
    params: z.object({
      memberId: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: 'Member deleted',
      content: {
        'application/json': {
          schema: z.object({
            data: z.object({
              id: z.string().uuid(),
            }),
          }),
        },
      },
    },
    400: {
      description: 'Invalid operation',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    403: {
      description: 'Forbidden',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    404: {
      description: 'Member not found',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
})
