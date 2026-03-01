import { createRoute, z } from '@hono/zod-openapi'

const roleSchema = z.enum(['OWNER', 'MANAGER', 'AGENT'])
const updatableRoleSchema = z.enum(['MANAGER', 'AGENT'])
const memberStatusSchema = z.enum(['ACTIVE', 'INACTIVE'])

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
