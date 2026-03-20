import { OpenAPIHono } from '@hono/zod-openapi'

import { getDashboardStatsSchema } from '../../../schema/v1/index.js'
import { StatsService } from '../../../services/stats.js'
import type { Env } from '../../../types/index.js'
import { requireWorkspaceId, withRouteTryCatch } from '../../../utils/route-helpers.js'

const handler = new OpenAPIHono<Env>()

handler.openapi(
  getDashboardStatsSchema,
  withRouteTryCatch('stats.getDashboard', async (c) => {
    const workspaceId = requireWorkspaceId(c)
    const { campaignId, includeRecentCampaigns, recentCampaignsLimit } = c.req.valid('query')

    const service = new StatsService(c.get('prisma'))
    const stats = await service.getDashboardStats(workspaceId, {
      campaignId,
      includeRecentCampaigns,
      recentCampaignsLimit,
    })

    return c.json({
      data: {
        ...stats,
        ...(stats.recentCampaigns
          ? {
              recentCampaigns: stats.recentCampaigns.map((campaign) => ({
                ...campaign,
                createdAt: campaign.createdAt.toISOString(),
              })),
            }
          : {}),
      },
    })
  })
)

const routeModule = {
  path: '/api/v1/stats',
  handler,
}

export default routeModule
