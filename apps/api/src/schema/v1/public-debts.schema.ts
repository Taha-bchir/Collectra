import { createRoute, z } from '@hono/zod-openapi'
import { DebtStatus } from '@repo/database'

const ErrorResponse = z.object({
  error: z.object({
    message: z.string(),
  }),
})

/** Calendar date from the debtor UI (`YYYY-MM-DD`) or ISO datetime. */
const promisedDateInputSchema = z.union([
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  z.string().datetime(),
])

const PublicDebtViewSchema = z.object({
  debtId: z.string().uuid(),
  amount: z.number(),
  currency: z.string(),
  dueDate: z.string().datetime(),
  promiseDate: z.string().datetime().nullable().optional(),
  status: z.nativeEnum(DebtStatus),
  campaignName: z.string(),
  workspaceName: z.string().nullable().optional(),
  invoiceNumber: z.string().nullable().optional(),
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
    'Public endpoint used by debtor links to choose a promise date. The date must be today or later; if the due date has not passed, the promise date cannot be after the due date.',
  request: {
    params: z.object({
      token: z.string().min(1),
    }),
    body: {
      content: {
        'application/json': {
          schema: z
            .object({
              promisedDate: promisedDateInputSchema,
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

export const createPublicStripeCheckoutSessionByTokenSchema = createRoute({
  method: 'post',
  path: '/{token}/stripe/checkout-session',
  tags: ['public-debts'],
  summary: 'Create Stripe Checkout session by secure customer token',
  description:
    'Public endpoint used by debtor links to open Stripe Checkout for unpaid debts. A promise date is not required.',
  request: {
    params: z.object({
      token: z.string().min(1),
    }),
  },
  responses: {
    201: {
      description: 'Stripe checkout session created',
      content: {
        'application/json': {
          schema: z.object({
            data: z.object({
              sessionId: z.string(),
              checkoutUrl: z.string().url(),
            }),
          }),
        },
      },
    },
    400: {
      description: 'Debt is not eligible for Stripe payment',
      content: { 'application/json': { schema: ErrorResponse } },
    },
    404: {
      description: 'Token not found or expired',
      content: { 'application/json': { schema: ErrorResponse } },
    },
    503: {
      description: 'Stripe integration is not configured',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
})

export const createPublicTrackOpenByTokenSchema = createRoute({
  method: 'post',
  path: '/{token}/track-open',
  tags: ['public-debts'],
  summary: 'Track customer opening a personal debt link',
  description:
    'Public endpoint used by the client page to record link-open/click analytics for campaign performance.',
  request: {
    params: z.object({
      token: z.string().min(1),
    }),
  },
  responses: {
    201: {
      description: 'Link open tracked',
      content: {
        'application/json': {
          schema: z.object({
            data: z.object({
              debtId: z.string().uuid(),
              tracked: z.literal(true),
            }),
          }),
        },
      },
    },
    404: {
      description: 'Token not found or expired',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
})

export const createPublicTrackClickByTokenSchema = createRoute({
  method: 'get',
  path: '/{token}/track-click',
  tags: ['public-debts'],
  summary: 'Track customer clicking a personal debt link',
  description: 'Public endpoint used by the client page to record the actual email link click.',
  request: {
    params: z.object({
      token: z.string().min(1),
    }),
  },
  responses: {
    302: {
      description: 'Link click tracked and redirected to the customer view',
    },
    404: {
      description: 'Token not found or expired',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
})

export const trackPublicEmailOpenSchema = createRoute({
  method: 'get',
  path: '/{debtId}/open.gif',
  tags: ['public-debts'],
  summary: 'Track email open pixel',
  description: '1x1 transparent pixel used to record actual email opens from Brevo campaigns.',
  request: {
    params: z.object({
      debtId: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: 'Tracking pixel',
    },
    404: {
      description: 'Debt not found',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
})

export const verifyStripePaymentByTokenSchema = createRoute({
  method: 'get',
  path: '/{token}/verify-payment',
  tags: ['public-debts'],
  summary: 'Verify Stripe payment status by secure customer token',
  description:
    'Public endpoint to verify if a payment has been confirmed for a debt. Useful for polling after redirecting from Stripe checkout.',
  request: {
    params: z.object({
      token: z.string().min(1),
    }),
  },
  responses: {
    200: {
      description: 'Payment status verified',
      content: {
        'application/json': {
          schema: z.object({
            data: z.object({
              debtId: z.string().uuid(),
              debtStatus: z.nativeEnum(DebtStatus),
              isPaid: z.boolean(),
            }),
          }),
        },
      },
    },
    404: {
      description: 'Token not found or expired',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
})

export const createPublicInvoiceByTokenSchema = createRoute({
  method: 'get',
  path: '/{token}/invoice',
  tags: ['public-debts'],
  summary: 'Get a printable invoice for a paid debt',
  description:
    'Public endpoint used by the customer link to download or print an invoice after payment has been confirmed.',
  request: {
    params: z.object({
      token: z.string().min(1),
    }),
    query: z.object({
      download: z.enum(['1']).optional(),
    }),
  },
  responses: {
    200: {
      description: 'Printable invoice HTML',
      content: {
        'text/html': {
          schema: z.string(),
        },
      },
    },
    400: {
      description: 'Debt is not yet paid or invoice is unavailable',
      content: { 'application/json': { schema: ErrorResponse } },
    },
    404: {
      description: 'Token not found or expired',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
})
