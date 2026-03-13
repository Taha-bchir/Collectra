import { createRoute, z } from '@hono/zod-openapi'
import { DebtStatus } from '@repo/database'

const ErrorResponse = z.object({
  error: z.object({
    message: z.string(),
  }),
})

const PublicDebtViewSchema = z.object({
  debtId: z.string().uuid(),
  amount: z.number(),
  dueDate: z.string().datetime(),
  status: z.nativeEnum(DebtStatus),
  campaignName: z.string(),
  tokenExpiresAt: z.string().datetime(),
  customer: z.object({
    fullName: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
  }),
})

export const getPublicDebtByTokenSchema = createRoute({
  method: 'get',
  path: '/{token}',
  tags: ['public-debts'],
  summary: 'Get debt details by secure customer token',
  description:
    'Public endpoint used by debtor links. No authentication required. Returns minimal debt and customer details for a valid, non-expired token.',
  request: {
    params: z.object({
      token: z.string().min(1),
    }),
  },
  responses: {
    200: {
      description: 'Debt details for the token',
      content: {
        'application/json': {
          schema: z.object({
            data: PublicDebtViewSchema,
          }),
        },
      },
    },
    400: {
      description: 'Invalid token format',
      content: { 'application/json': { schema: ErrorResponse } },
    },
    404: {
      description: 'Token not found or expired',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
})
