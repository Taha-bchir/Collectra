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
  promiseDate: z.string().datetime().nullable().optional(),
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

export const createPublicPromiseByTokenSchema = createRoute({
  method: 'post',
  path: '/{token}/promise',
  tags: ['public-debts'],
  summary: 'Submit a payment promise date by secure customer token',
  description:
    'Public endpoint used by debtor links to choose a promise date. The date must be between now and the debt due date.',
  request: {
    params: z.object({
      token: z.string().min(1),
    }),
    body: {
      content: {
        'application/json': {
          schema: z
            .object({
              promisedDate: z.string().datetime(),
            })
            .strict(),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Promise saved and debt updated',
      content: {
        'application/json': {
          schema: z.object({
            data: z.object({
              debtId: z.string().uuid(),
              status: z.nativeEnum(DebtStatus),
              promiseDate: z.string().datetime(),
            }),
          }),
        },
      },
    },
    400: {
      description: 'Invalid promise date',
      content: { 'application/json': { schema: ErrorResponse } },
    },
    404: {
      description: 'Token not found or expired',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
})

export const createPublicFakePaymentByTokenSchema = createRoute({
  method: 'post',
  path: '/{token}/fake-payment',
  tags: ['public-debts'],
  summary: 'Fake payment confirmation by secure customer token',
  description:
    'Demo-only endpoint. Marks debt as paid when the debt is currently in PROMISE_TO_PAY status.',
  request: {
    params: z.object({
      token: z.string().min(1),
    }),
  },
  responses: {
    200: {
      description: 'Debt marked as paid',
      content: {
        'application/json': {
          schema: z.object({
            data: z.object({
              debtId: z.string().uuid(),
              status: z.nativeEnum(DebtStatus),
            }),
          }),
        },
      },
    },
    400: {
      description: 'Debt is not eligible for fake payment',
      content: { 'application/json': { schema: ErrorResponse } },
    },
    404: {
      description: 'Token not found or expired',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
})
