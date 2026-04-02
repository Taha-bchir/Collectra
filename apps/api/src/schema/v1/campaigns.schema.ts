import { CampaignStatus, DebtStatus } from '@repo/database'
import { createRoute, z } from '@hono/zod-openapi'

const ErrorResponse = z.object({
  error: z.object({
    message: z.string(),
  }),
})

const SkippedRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  reason: z.string(),
})

const CampaignSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  status: z.nativeEnum(CampaignStatus),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  debtsCount: z.number().int().nonnegative(),
})

const CampaignDebtDetailSchema = z.object({
  id: z.string().uuid(),
  amount: z.number(),
  dueDate: z.string().datetime(),
  promiseDate: z.string().datetime().nullable().optional(),
  status: z.nativeEnum(DebtStatus),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  client: z.object({
    id: z.string().uuid(),
    fullName: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    address: z.string().nullable(),
  }),
})

const CampaignDetailsSchema = CampaignSummarySchema.extend({
  debts: z.array(CampaignDebtDetailSchema),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().positive(),
  }),
})

const CampaignImportResponseSchema = z.object({
  data: z.object({
    campaign: CampaignSummarySchema.pick({
      id: true,
      name: true,
      description: true,
      status: true,
      createdAt: true,
    }),
    stats: z.object({
      totalRows: z.number().int().nonnegative(),
      importedRows: z.number().int().nonnegative(),
      skippedRows: z.number().int().nonnegative(),
    }),
    emailStats: z.object({
      attempted: z.number().int().nonnegative(),
      sent: z.number().int().nonnegative(),
      failed: z.number().int().nonnegative(),
      skipped: z.number().int().nonnegative(),
    }),
    skippedRows: z.array(SkippedRowSchema),
    statusMapping: z.record(z.nativeEnum(DebtStatus)),
  }),
})

export const importCampaignCsvSchema = createRoute({
  method: 'post',
  path: '/import-csv',
  tags: ['campaigns'],
  summary: 'Create a campaign by importing debts from a CSV file',
  description:
    'Creates one campaign per uploaded CSV file, then parses rows into customers and debts. Rows with invalid data are skipped and returned with reasons.',
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            campaignName: z.string().trim().min(1).max(120),
            description: z.string().max(500).optional(),
            // Accept runtime File objects while preserving binary OpenAPI docs.
            file: z
              .any()
              .openapi({
                type: 'string',
                format: 'binary',
                description: 'CSV file',
              }),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Campaign created and CSV imported',
      content: {
        'application/json': {
          schema: CampaignImportResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid CSV or invalid rows',
      content: { 'application/json': { schema: ErrorResponse } },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponse } },
    },
    403: {
      description: 'No active workspace',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
})

export const listCampaignsSchema = createRoute({
  method: 'get',
  path: '/',
  tags: ['campaigns'],
  summary: 'List campaigns in current workspace',
  responses: {
    200: {
      description: 'Campaign list',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(CampaignSummarySchema),
          }),
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponse } },
    },
    403: {
      description: 'No active workspace',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
})

export const getCampaignByIdSchema = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['campaigns'],
  summary: 'Get campaign by ID in current workspace',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
    query: z.object({
      page: z.coerce.number().int().min(1).optional(),
      pageSize: z.coerce.number().int().min(1).max(100).optional(),
    }),
  },
  responses: {
    200: {
      description: 'Campaign details',
      content: {
        'application/json': {
          schema: z.object({
            data: CampaignDetailsSchema,
          }),
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponse } },
    },
    403: {
      description: 'No active workspace',
      content: { 'application/json': { schema: ErrorResponse } },
    },
    404: {
      description: 'Campaign not found',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
})

export const getCampaignEmailStatsSchema = createRoute({
  method: 'get',
  path: '/{id}/email-stats',
  tags: ['campaigns'],
  summary: 'Get email campaign statistics',
  description: 'Get email statistics for a campaign including sent, opened, clicked, and other events',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: 'Email statistics',
      content: {
        'application/json': {
          schema: z.object({
            data: z.object({
              campaignId: z.string().uuid(),
              stats: z.object({
                sent: z.number().int().nonnegative(),
                opened: z.number().int().nonnegative(),
                clicked: z.number().int().nonnegative(),
                other: z.number().int().nonnegative(),
              }),
              summary: z.object({
                total: z.number().int().nonnegative(),
                uniqueDebts: z.number().int().nonnegative(),
                uniqueCustomers: z.number().int().nonnegative(),
              }),
              lastEventAt: z.string().datetime().nullable(),
            }),
          }),
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: { 'application/json': { schema: ErrorResponse } },
    },
    403: {
      description: 'No active workspace',
      content: { 'application/json': { schema: ErrorResponse } },
    },
    404: {
      description: 'Campaign not found',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
})
