import { OpenAPIHono } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'

import {
  getCampaignByIdSchema,
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
