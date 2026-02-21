import { createRoute, z } from '@hono/zod-openapi';
import { PromiseStatus } from '@repo/database';

const PromiseSchema = z.object({
  id: z.string().uuid(),
  debtId: z.string().uuid(),
  promisedDate: z.string().datetime(),
  status: z.nativeEnum(PromiseStatus),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const ErrorResponse = z.object({
  error: z.object({ message: z.string() }),
});

// === List Promises for a Debt ===
export const listPromisesSchema = createRoute({
  method: 'get',
  path: '/debts/{debtId}/promises',
  tags: ['promises'],
  summary: 'List payment promises for a specific debt',
  description: 'Returns all promises made for the given debt in the current workspace.',
  request: {
    params: z.object({
      debtId: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: 'List of payment promises',
      content: { 'application/json': { schema: z.object({ data: z.array(PromiseSchema) }) } },
    },
    404: { description: 'Debt not found or not in workspace', content: { 'application/json': { schema: ErrorResponse } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorResponse } } },
    403: { description: 'No active workspace', content: { 'application/json': { schema: ErrorResponse } } },
  },
});

// === Create Payment Promise ===
export const createPromiseSchema = createRoute({
  method: 'post',
  path: '/debts/{debtId}/promises',
  tags: ['promises'],
  summary: 'Create a new payment promise for a debt',
  request: {
    params: z.object({
      debtId: z.string().uuid(),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            promisedDate: z.string().datetime(),
            status: z.nativeEnum(PromiseStatus).optional().default('ACTIVE'),
          }).strict(),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Promise created',
      content: { 'application/json': { schema: z.object({ data: PromiseSchema }) } },
    },
    400: { description: 'Invalid input', content: { 'application/json': { schema: ErrorResponse } } },
    404: { description: 'Debt not found or not in workspace', content: { 'application/json': { schema: ErrorResponse } } },
    403: { description: 'No active workspace', content: { 'application/json': { schema: ErrorResponse } } },
  },
});