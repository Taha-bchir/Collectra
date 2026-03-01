import { createRoute, z } from '@hono/zod-openapi'

const inviteRoleSchema = z.enum(['MANAGER', 'AGENT'])

const invitationResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    role: inviteRoleSchema,
    token: z.string().uuid(),
    inviteLink: z.string().url().nullable(),
    expiresAt: z.string().datetime(),
    status: z.enum(['PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED']),
  }),
  message: z.string(),
})

const errorResponseSchema = z.object({
  error: z.object({
    message: z.string(),
    code: z.string().optional(),
  }),
})

export const createInvitationSchema = createRoute({
  method: 'post',
  path: '/',
  tags: ['invitations'],
  summary: 'Create workspace member invitation',
  description: 'Creates an invitation token/link for joining the current workspace as MANAGER or AGENT.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            email: z.string().email(),
            role: inviteRoleSchema.default('AGENT'),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Invitation created',
      content: {
        'application/json': {
          schema: invitationResponseSchema,
        },
      },
    },
    400: {
      description: 'Validation or business rule error',
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
    409: {
      description: 'Already a member',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
})

export const acceptInvitationSchema = createRoute({
  method: 'post',
  path: '/accept',
  tags: ['invitations'],
  summary: 'Accept workspace invitation',
  description: 'Accepts a pending invitation token for the authenticated user and joins the workspace.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            token: z.string().uuid(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Invitation accepted',
      content: {
        'application/json': {
          schema: z.object({
            data: z.object({
              workspace: z.object({
                id: z.string().uuid(),
                name: z.string(),
              }),
              role: inviteRoleSchema,
            }),
            message: z.string(),
          }),
        },
      },
    },
    400: {
      description: 'Invitation cannot be accepted',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    403: {
      description: 'Invitation email mismatch',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
    404: {
      description: 'Invitation not found or expired',
      content: {
        'application/json': {
          schema: errorResponseSchema,
        },
      },
    },
  },
})
