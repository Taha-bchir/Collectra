import { OpenAPIHono } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'

import {
  getCampaignByIdSchema,
  getCampaignEmailStatsSchema,
  importCampaignCsvSchema,
  listCampaignsSchema,
} from '../../../schema/v1/index.js'
import { CampaignsService } from '../../../services/campaigns.js'
import type { Env } from '../../../types/index.js'
import { requireWorkspaceId, withRouteTryCatch } from '../../../utils/route-helpers.js'

const handler = new OpenAPIHono<Env>()

handler.openapi(
  listCampaignsSchema,
  withRouteTryCatch('campaigns.list', async (c) => {
    const workspaceId = requireWorkspaceId(c)
    const service = new CampaignsService(c.get('prisma'))
    const campaigns = await service.list(workspaceId)

    return c.json({
      data: campaigns.map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
        status: campaign.status,
        createdAt: campaign.createdAt.toISOString(),
        updatedAt: campaign.updatedAt.toISOString(),
        debtsCount: campaign.debtsCount,
      })),
    })
  })
)

// Keep compatibility with clients hitting /api/v1/campaigns (no trailing slash).
handler.get(
  '',
  withRouteTryCatch('campaigns.listNoSlash', async (c) => {
    const workspaceId = requireWorkspaceId(c)
    const service = new CampaignsService(c.get('prisma'))
    const campaigns = await service.list(workspaceId)

    return c.json({
      data: campaigns.map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
        status: campaign.status,
        createdAt: campaign.createdAt.toISOString(),
        updatedAt: campaign.updatedAt.toISOString(),
        debtsCount: campaign.debtsCount,
      })),
    })
  })
)

handler.openapi(
  getCampaignByIdSchema,
  withRouteTryCatch('campaigns.getById', async (c) => {
    const workspaceId = requireWorkspaceId(c)
    const { id } = c.req.valid('param')
    const { page, pageSize } = c.req.valid('query')
    const service = new CampaignsService(c.get('prisma'))
    const campaign = await service.getById(workspaceId, id, { page, pageSize })

    return c.json({
      data: {
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
        status: campaign.status,
        createdAt: campaign.createdAt.toISOString(),
        updatedAt: campaign.updatedAt.toISOString(),
        debtsCount: campaign.debtsCount,
        pagination: campaign.pagination,
        debts: campaign.debts.map((debt) => ({
          id: debt.id,
          amount: debt.amount,
          dueDate: debt.dueDate.toISOString(),
          status: debt.status,
          createdAt: debt.createdAt.toISOString(),
          updatedAt: debt.updatedAt.toISOString(),
          client: {
            id: debt.client.id,
            fullName: debt.client.fullName,
            email: debt.client.email,
            phone: debt.client.phone,
            address: debt.client.address,
          },
        })),
      },
    })
  })
)

handler.openapi(
  getCampaignEmailStatsSchema,
  withRouteTryCatch('campaigns.emailStats', async (c) => {
    const workspaceId = requireWorkspaceId(c)
    const { id: campaignId } = c.req.valid('param')
    const prisma = c.get('prisma')

    // Verify campaign exists and belongs to workspace
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true, workspaceId: true },
    })

    if (!campaign) {
      throw new HTTPException(404, { message: 'Campaign not found' })
    }

    if (campaign.workspaceId !== workspaceId) {
      throw new HTTPException(403, { message: 'Not authorized to access this campaign' })
    }

    // Get all action history for debts in this campaign
    const actionHistory = await prisma.customerActionHistory.findMany({
      where: {
        debt: {
          campaignId: campaignId,
        },
      },
      select: {
        id: true,
        actionType: true,
        timestamp: true,
        debtId: true,
        customerId: true,
      },
      orderBy: {
        timestamp: 'desc',
      },
    })

    // Aggregate stats
    const stats = {
      sent: 0,
      opened: 0,
      clicked: 0,
      other: 0,
    }

    const uniqueDebts = new Set<string>()
    const uniqueCustomers = new Set<string>()

    for (const action of actionHistory) {
      if (action.actionType === 'EMAIL_SENT') {
        stats.sent += 1
      } else if (action.actionType === 'LINK_CLICKED') {
        stats.opened += 1
      } else {
        stats.other += 1
      }

      if (action.debtId) {
        uniqueDebts.add(action.debtId)
      }
      uniqueCustomers.add(action.customerId)
    }

    const clickedCount = stats.opened
    stats.clicked = clickedCount

    // Get the most recent event timestamp
    const lastEventAt = actionHistory.length > 0 ? actionHistory[0].timestamp : null
    const lastEventAtString = lastEventAt !== null ? lastEventAt.toISOString() : null

    return c.json({
      data: {
        campaignId,
        stats: {
          sent: stats.sent,
          opened: stats.opened,
          clicked: stats.clicked,
          other: stats.other,
        },
        summary: {
          total: actionHistory.length,
          uniqueDebts: uniqueDebts.size,
          uniqueCustomers: uniqueCustomers.size,
        },
        lastEventAt: lastEventAtString,
      },
    })
  })
)

handler.openapi(
  importCampaignCsvSchema,
  withRouteTryCatch('campaigns.importCsv', async (c) => {
    const workspaceId = requireWorkspaceId(c)

    const body = await c.req.parseBody()

    const uploaded = body.file
    const file = Array.isArray(uploaded) ? uploaded[0] : uploaded

    if (!(file instanceof File)) {
      throw new HTTPException(400, { message: 'Missing CSV file in form-data field "file"' })
    }

    if (!file.name.toLowerCase().endsWith('.csv')) {
      throw new HTTPException(400, { message: 'Uploaded file must be a .csv file' })
    }

    const csvText = await file.text()

    const campaignNameValue = body.campaignName
    const descriptionValue = body.description

    const campaignName =
      typeof campaignNameValue === 'string' && campaignNameValue.trim().length > 0
        ? campaignNameValue
        : undefined

    const description =
      typeof descriptionValue === 'string' && descriptionValue.trim().length > 0
        ? descriptionValue
        : undefined

    const service = new CampaignsService(c.get('prisma'))
    const result = await service.importFromCsv(workspaceId, {
      campaignName,
      description,
      fileName: file.name,
      csvText,
    })

    return c.json(
      {
        data: {
          campaign: {
            id: result.campaign.id,
            name: result.campaign.name,
            description: result.campaign.description,
            status: result.campaign.status,
            createdAt: result.campaign.createdAt.toISOString(),
          },
          stats: result.stats,
          emailStats: result.emailStats,
          skippedRows: result.skippedRows,
          statusMapping: result.statusMapping,
        },
      },
      201
    )
  })
)

const routeModule = {
  path: '/api/v1/campaigns',
  handler,
}

export default routeModule
