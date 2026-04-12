import { createRoute, z } from '@hono/zod-openapi';
import { ActionType, DebtStatus, PromiseStatus } from '@repo/database';

const CustomerSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const CustomerDebtSummarySchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),
  campaignName: z.string(),
  amount: z.number(),
  dueDate: z.string().datetime(),
  promiseDate: z.string().datetime().nullable(),
  status: z.nativeEnum(DebtStatus),
  linkOpenCount: z.number().int().nonnegative(),
  linkOpenTimes: z.array(z.string().datetime()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const CustomerWithDebtSummarySchema = z.object({
  customer: CustomerSchema,
  debt: CustomerDebtSummarySchema,
});

const CustomerPromiseSchema = z.object({
  id: z.string().uuid(),
  debtId: z.string().uuid(),
  promisedDate: z.string().datetime(),
  status: z.nativeEnum(PromiseStatus),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const CustomerDebtDetailsSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),
  campaignName: z.string(),
  amount: z.number(),
  dueDate: z.string().datetime(),
  promiseDate: z.string().datetime().nullable(),
  status: z.nativeEnum(DebtStatus),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  promises: z.array(CustomerPromiseSchema),
});

const CustomerActionHistorySchema = z.object({
  id: z.string().uuid(),
  debtId: z.string().uuid().nullable(),
  customerId: z.string().uuid(),
  actionType: z.nativeEnum(ActionType),
  timestamp: z.string().datetime(),
  performedBy: z.string().uuid().nullable(),
  metadata: z.record(z.any()).nullable().optional(),
  createdAt: z.string().datetime(),
});

const CustomerDetailsSchema = CustomerSchema.extend({
  debts: z.array(CustomerDebtDetailsSchema),
  actionHistory: z.array(CustomerActionHistorySchema),
});

const CustomerTrackingStatusSchema = z.enum([
  'SENT',
  'CLICKED',
  'SPAM',
]);

const CustomerTrackingEventSchema = z.object({
  id: z.string().uuid(),
  debtId: z.string().uuid().nullable(),
  timestamp: z.string().datetime(),
  actionType: z.nativeEnum(ActionType),
  eventName: z.string().nullable(),
  channel: z.string().nullable(),
  metadata: z.record(z.any()).nullable().optional(),
});

const CustomerDebtTrackingSchema = z.object({
  debtId: z.string().uuid(),
  campaignId: z.string().uuid(),
  campaignName: z.string(),
  debtStatus: z.nativeEnum(DebtStatus),
  sentCount: z.number().int().nonnegative(),
  deliveredCount: z.number().int().nonnegative(),
  openedCount: z.number().int().nonnegative(),
  clickedCount: z.number().int().nonnegative(),
  spamCount: z.number().int().nonnegative(),
  bouncedCount: z.number().int().nonnegative(),
  unsubscribedCount: z.number().int().nonnegative(),
  publicLinkVisitCount: z.number().int().nonnegative(),
  notSent: z.boolean(),
  notSeen: z.boolean(),
  status: CustomerTrackingStatusSchema,
  lastEventAt: z.string().datetime().nullable(),
  lastSeenAt: z.string().datetime().nullable(),
  events: z.array(CustomerTrackingEventSchema),
});

const CustomerCommunicationTrackingSchema = z.object({
  customerId: z.string().uuid(),
  summary: z.object({
    totalDebts: z.number().int().nonnegative(),
    sentDebts: z.number().int().nonnegative(),
    notSentDebts: z.number().int().nonnegative(),
    deliveredCount: z.number().int().nonnegative(),
    openedCount: z.number().int().nonnegative(),
    clickedCount: z.number().int().nonnegative(),
    spamCount: z.number().int().nonnegative(),
    bouncedCount: z.number().int().nonnegative(),
    unsubscribedCount: z.number().int().nonnegative(),
    publicLinkVisitCount: z.number().int().nonnegative(),
    lastEventAt: z.string().datetime().nullable(),
  }),
  debts: z.array(CustomerDebtTrackingSchema),
});

const PaginationSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().positive(),
});

const ErrorResponse = z.object({
  error: z.object({
    message: z.string(),
  }),
});

// === List Customers ===
export const listCustomersSchema = createRoute({
  method: 'get',
  path: '/',
  tags: ['customers'],
  summary: 'List customers in current workspace',
  description:
    'Returns customers belonging to the authenticated user\'s workspace with one matching debt summary per row. Supports pagination, status filtering, search by name/email, and optional campaign scoping.',
  request: {
    query: z.object({
      status: z.nativeEnum(DebtStatus).optional(),
      search: z.string().trim().min(1).optional().describe('Search by customer name or email'),
      campaignId: z.string().uuid().optional(),
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    }),
  },
  responses: {
    200: {
      description: 'List of customers with debt summary and pagination',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(CustomerWithDebtSummarySchema),
            pagination: PaginationSchema,
          }),
        },
      },
    },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponse } } },
    403: { description: 'No workspace found', content: { 'application/json': { schema: ErrorResponse } } },
  },
});

// === Create Customer ===
export const createCustomerSchema = createRoute({
  method: 'post',
  path: '/',
  tags: ['customers'],
  summary: 'Create a new customer in current workspace',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            fullName: z.string().min(1).max(120),
            email: z.string().email().optional(),
            phone: z.string().min(8).max(20).optional(),
            address: z.string().max(255).optional(),
          }).strict(),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Customer created',
      content: {
        'application/json': {
          schema: z.object({
            data: CustomerSchema,
          }),
        },
      },
    },
    400: { description: 'Invalid input', content: { 'application/json': { schema: ErrorResponse } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponse } } },
    403: { description: 'No workspace found', content: { 'application/json': { schema: ErrorResponse } } },
  },
});

// === Get Customer by ID ===
export const getCustomerByIdSchema = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['customers'],
  summary: 'Get full customer details by ID',
  description:
    'Returns a tenant-scoped customer with all debts (including status and payment promises) and customer action history.',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: 'Customer details with debts, promises, and action history',
      content: {
        'application/json': {
          schema: z.object({
            data: CustomerDetailsSchema,
          }),
        },
      },
    },
    404: { description: 'Customer not found or not in workspace', content: { 'application/json': { schema: ErrorResponse } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponse } } },
  },
});

export const getCustomerTrackingSchema = createRoute({
  method: 'get',
  path: '/{id}/tracking',
  tags: ['customers'],
  summary: 'Get customer communication and link tracking',
  description:
    'Returns detailed per-debt tracking for email/link lifecycle including sent, clicked, spam, and link visits.',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: 'Detailed customer communication tracking',
      content: {
        'application/json': {
          schema: z.object({
            data: CustomerCommunicationTrackingSchema,
          }),
        },
      },
    },
    404: { description: 'Customer not found or not in workspace', content: { 'application/json': { schema: ErrorResponse } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponse } } },
  },
});

// === Update Customer by ID ===
export const updateCustomerSchema = createRoute({
  method: 'patch',
  path: '/{id}',
  tags: ['customers'],
  summary: 'Update a customer',
  description: 'Updates fields of a customer in the current workspace.',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            fullName: z.string().min(1).max(120).optional(),
            email: z.string().email().optional().nullable(),
            phone: z.string().optional().nullable(),
            address: z.string().optional().nullable(),
          }).strict(),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Customer updated',
      content: {
        'application/json': {
          schema: z.object({
            data: CustomerSchema,
          }),
        },
      },
    },
    404: { description: 'Customer not found or not in workspace', content: { 'application/json': { schema: ErrorResponse } } },
    400: { description: 'Invalid input', content: { 'application/json': { schema: ErrorResponse } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponse } } },
  },
});

export default {
  list: listCustomersSchema,
  create: createCustomerSchema,
  getById: getCustomerByIdSchema,
  tracking: getCustomerTrackingSchema,
  update: updateCustomerSchema,
};