import { createRoute, z } from '@hono/zod-openapi';
import { DebtStatus } from '@repo/database';

const DebtSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),
  clientId: z.string().uuid(),
  amount: z.number(),
  dueDate: z.string().datetime(),
  status: z.nativeEnum(DebtStatus),
  promiseDate: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  // Optional: include client name if joined
  client: z.object({
    fullName: z.string(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
  }).optional(),
});

const ErrorResponse = z.object({
  error: z.object({
    message: z.string(),
  }),
});

// === List Debts ===
export const listDebtsSchema = createRoute({
  method: 'get',
  path: '/',
  tags: ['debts'],
  summary: 'List debts in current workspace',
  description: 'Returns debts from campaigns in the authenticated user’s workspace. Supports filtering by status and client.',
  request: {
    query: z.object({
      status: z.nativeEnum(DebtStatus).optional(),
      clientId: z.string().uuid().optional(),
      campaignId: z.string().uuid().optional(),
    }),
  },
  responses: {
    200: {
      description: 'List of debts',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(DebtSchema),
          }),
        },
      },
    },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponse } } },
    403: { description: 'No workspace found', content: { 'application/json': { schema: ErrorResponse } } },
  },
});

// === Create Debt ===
export const createDebtSchema = createRoute({
  method: 'post',
  path: '/',
  tags: ['debts'],
  summary: 'Create a new debt in a campaign',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            campaignId: z.string().uuid(),
            clientId: z.string().uuid(),
            amount: z.number().positive(),
            dueDate: z.string().datetime(),
            status: z.nativeEnum(DebtStatus).optional().default('IMPORTED'),
            promiseDate: z.string().datetime().optional().nullable(),
          }).strict(),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Debt created',
      content: {
        'application/json': {
          schema: z.object({
            data: DebtSchema,
          }),
        },
      },
    },
    400: { description: 'Invalid input', content: { 'application/json': { schema: ErrorResponse } } },
    403: { description: 'Campaign not in workspace or unauthorized', content: { 'application/json': { schema: ErrorResponse } } },
    404: { description: 'Campaign or client not found', content: { 'application/json': { schema: ErrorResponse } } },
  },
});

// === Get Debt by ID ===
export const getDebtByIdSchema = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['debts'],
  summary: 'Get a single debt by ID',
  description: 'Returns the debt if it belongs to a campaign in the current workspace.',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: 'Debt details',
      content: {
        'application/json': {
          schema: z.object({
            data: DebtSchema,
          }),
        },
      },
    },
    404: { description: 'Debt not found or not in workspace', content: { 'application/json': { schema: ErrorResponse } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponse } } },
  },
});

// === Update Debt by ID ===
export const updateDebtSchema = createRoute({
  method: 'patch',
  path: '/{id}',
  tags: ['debts'],
  summary: 'Update a debt',
  description: 'Updates fields of a debt in the current workspace.',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            amount: z.number().positive().optional(),
            dueDate: z.string().datetime().optional(),
            status: z.nativeEnum(DebtStatus).optional(),
            promiseDate: z.string().datetime().nullable().optional(),
          }).strict(),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Debt updated',
      content: {
        'application/json': {
          schema: z.object({
            data: DebtSchema,
          }),
        },
      },
    },
    404: { description: 'Debt not found or not in workspace', content: { 'application/json': { schema: ErrorResponse } } },
    400: { description: 'Invalid input', content: { 'application/json': { schema: ErrorResponse } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponse } } },
  },
});

export default {
  list: listDebtsSchema,
  create: createDebtSchema,
  getById: getDebtByIdSchema,
  update: updateDebtSchema,
};