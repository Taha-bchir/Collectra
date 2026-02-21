import { createRoute, z } from '@hono/zod-openapi';

const ActionTypeSchema = z.enum([
  'LINK_SENT',
  'LINK_CLICKED',
  'PROMISE_MADE',
  'PROMISE_UPDATED',
  'PAYMENT_CONFIRMED',
  'STATUS_CHANGED',
  'NOTE_ADDED',
  'EMAIL_SENT',
  'SMS_SENT',
  'PHONE_CALL',
  'OTHER',
]);

const ActionSchema = z.object({
  id: z.string().uuid(),
  debtId: z.string().uuid().nullable(),
  customerId: z.string().uuid(),
  actionType: ActionTypeSchema,
  timestamp: z.string().datetime(),
  performedBy: z.string().uuid().nullable(),
  metadata: z.record(z.any()).nullable().optional(),
});

const ErrorResponse = z.object({
  error: z.object({ message: z.string() }),
});

// === List Actions for a Debt ===
export const listDebtActionsSchema = createRoute({
  method: 'get',
  path: '/debts/{debtId}/actions',
  tags: ['actions'],
  summary: 'List action history for a specific debt',
  request: {
    params: z.object({
      debtId: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: 'Action timeline for debt',
      content: { 'application/json': { schema: z.object({ data: z.array(ActionSchema) }) } },
    },
    404: { description: 'Debt not found or not in workspace', content: { 'application/json': { schema: ErrorResponse } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponse } } },
  },
});

// === List Actions for a Customer ===
export const listCustomerActionsSchema = createRoute({
  method: 'get',
  path: '/customers/{customerId}/actions',
  tags: ['actions'],
  summary: 'List action history for a customer (across all debts)',
  request: {
    params: z.object({
      customerId: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: 'Action timeline for customer',
      content: { 'application/json': { schema: z.object({ data: z.array(ActionSchema) }) } },
    },
    404: { description: 'Customer not found or not in workspace', content: { 'application/json': { schema: ErrorResponse } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponse } } },
  },
});

// === Record a New Action ===
export const recordActionSchema = createRoute({
  method: 'post',
  path: '/actions',
  tags: ['actions'],
  summary: 'Record a new customer/debt action (internal use)',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            customerId: z.string().uuid(),
            debtId: z.string().uuid().optional(),
            actionType: ActionTypeSchema,
            metadata: z.record(z.any()).optional(),
          }).strict(),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Action recorded',
      content: { 'application/json': { schema: z.object({ data: ActionSchema }) } },
    },
    400: { description: 'Invalid input', content: { 'application/json': { schema: ErrorResponse } } },
    404: { description: 'Customer or debt not found in workspace', content: { 'application/json': { schema: ErrorResponse } } },
    403: { description: 'No active workspace', content: { 'application/json': { schema: ErrorResponse } } },
  },
});