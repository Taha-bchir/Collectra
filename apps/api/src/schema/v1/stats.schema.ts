import { createRoute, z } from '@hono/zod-openapi'

const ErrorResponse = z.object({
  error: z.object({
    message: z.string(),
  }),
})

const includeRecentCampaignsSchema = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value
  }

  const normalized = value.trim().toLowerCase()

  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true
  }

  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false
  }

  return value
}, z.boolean())

const DashboardStatusCountsSchema = z.object({
  IMPORTED: z.number().int().nonnegative(),
  NOTIFIED: z.number().int().nonnegative(),
  PROMISE_TO_PAY: z.number().int().nonnegative(),
  PAID: z.number().int().nonnegative(),
  OVERDUE_AFTER_PROMISE: z.number().int().nonnegative(),
})

const RecentCampaignStatsSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  createdAt: z.string().datetime(),
  debtsCount: z.number().int().nonnegative(),
  promisedCount: z.number().int().nonnegative(),
  paidCount: z.number().int().nonnegative(),
})

const DashboardStatsResponseSchema = z.object({
  data: z.object({
    scope: z.enum(['workspace', 'campaign']),
    campaignId: z.string().uuid().nullable(),
    statuses: DashboardStatusCountsSchema,
    totalDebts: z.number().int().nonnegative(),
    totalOverdueAmount: z.number().nonnegative(),
    recentCampaigns: z.array(RecentCampaignStatsSchema).optional(),
  }),
})

export const getDashboardStatsSchema = createRoute({
  method: 'get',
  path: '/',
  tags: ['stats'],
  summary: 'Get dashboard debt stats for current workspace',
  description:
    'Returns debt counts grouped by status for the authenticated workspace. Supports filtering by campaignId and optionally returning recent campaign summaries.',
  request: {
    query: z.object({
      campaignId: z.string().uuid().optional(),
      includeRecentCampaigns: includeRecentCampaignsSchema.optional(),
      recentCampaignsLimit: z.coerce.number().int().min(1).max(10).optional(),
    }),
  },
  responses: {
    200: {
      description: 'Dashboard stats',
      content: {
        'application/json': {
          schema: DashboardStatsResponseSchema,
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
      description: 'Campaign not found in current workspace',
      content: { 'application/json': { schema: ErrorResponse } },
    },
  },
})

