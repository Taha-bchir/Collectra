import { createRoute, z } from '@hono/zod-openapi';

const CustomerSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
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
  description: 'Returns customers belonging to the authenticated user’s workspace. Supports optional search by name/email/phone.',
  request: {
    query: z.object({
      search: z.string().optional().describe('Search by name, email, or phone'),
    }),
  },
  responses: {
    200: {
      description: 'List of customers',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(CustomerSchema),
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
  summary: 'Get a single customer by ID',
  description: 'Returns the customer if it belongs to the current workspace.',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: 'Customer details',
      content: {
        'application/json': {
          schema: z.object({
            data: CustomerSchema,
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
  update: updateCustomerSchema,
};