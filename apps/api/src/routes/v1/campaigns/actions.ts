import { OpenAPIHono } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'

import {
  deleteCampaignSchema,
  getCampaignByIdSchema,
  getCampaignEmailStatsSchema,
  importCampaignCsvSchema,
  listCampaignsSchema,
  syncCampaignBrevoLogsSchema,
  updateCampaignDueDateSchema,
  updateCampaignStatusSchema,
} from '../../../schema/v1/index.js'
import { getCampaignBrevoStats } from '../../../services/brevo-event-logs.js'
import { CampaignsService } from '../../../services/campaigns.js'
import { BrevoTransactionalLogsService } from '../../../services/brevo-transactional-logs.js'
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
    const userId = c.get('currentUser')?.id
    const { id } = c.req.valid('param')
    const { page, pageSize } = c.req.valid('query')
    const service = new CampaignsService(c.get('prisma'))

    let campaign
    try {
      campaign = await service.getById(workspaceId, id, { page, pageSize })
    } catch (error) {
      if (!(error instanceof HTTPException) || error.status !== 404 || !userId) {
        throw error
      }

      const prisma = c.get('prisma')
      const accessibleWorkspace = await prisma.workspaceMember.findFirst({
        where: {
          userId,
          status: 'ACTIVE',
          workspace: {
            campaigns: {
              some: {
                id,
              },
            },
          },
        },
        select: {
          workspaceId: true,
        },
      })

      if (!accessibleWorkspace?.workspaceId || accessibleWorkspace.workspaceId === workspaceId) {
        throw error
      }

      campaign = await service.getById(accessibleWorkspace.workspaceId, id, { page, pageSize })
    }

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
          promiseDate: debt.promiseDate ? debt.promiseDate.toISOString() : null,
          status: debt.status,
          emailStatus: debt.emailStatus,
          linkOpenCount: debt.linkOpenCount,
          linkOpenTimes: debt.linkOpenTimes.map((value) => value.toISOString()),
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
  updateCampaignDueDateSchema,
  withRouteTryCatch('campaigns.updateDueDate', async (c) => {
    const workspaceId = requireWorkspaceId(c)
    const { id: campaignId } = c.req.valid('param')
    const { dueDate } = c.req.valid('json')

    const service = new CampaignsService(c.get('prisma'))
    const result = await service.updateCampaignDueDateLimit(workspaceId, campaignId, new Date(dueDate))

    return c.json(
      {
        data: {
          campaignId: result.campaignId,
          dueDate: result.dueDate.toISOString(),
          updatedCount: result.updatedCount,
        },
      },
      200
    )
  })
)

handler.openapi(
  updateCampaignStatusSchema,
  withRouteTryCatch('campaigns.updateStatus', async (c) => {
    const workspaceId = requireWorkspaceId(c)
    const { id: campaignId } = c.req.valid('param')
    const { status } = c.req.valid('json')

    const service = new CampaignsService(c.get('prisma'))
    const result = await service.updateStatus(workspaceId, campaignId, status)

    return c.json({
      data: {
        id: result.id,
        name: result.name,
        description: result.description,
        status: result.status,
        createdAt: result.createdAt.toISOString(),
        updatedAt: result.updatedAt.toISOString(),
        debtsCount: result.debtsCount,
      },
    })
  })
)

handler.openapi(
  deleteCampaignSchema,
  withRouteTryCatch('campaigns.delete', async (c) => {
    const workspaceId = requireWorkspaceId(c)
    const { id: campaignId } = c.req.valid('param')

    const service = new CampaignsService(c.get('prisma'))
    const result = await service.delete(workspaceId, campaignId)

    return c.json({ data: result })
  })
)

handler.openapi(
  getCampaignEmailStatsSchema,
  withRouteTryCatch('campaigns.emailStats', async (c) => {
    const workspaceId = requireWorkspaceId(c)
    const { id: campaignId } = c.req.valid('param')
    const prisma = c.get('prisma')

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

    const stats = await getCampaignBrevoStats(prisma, campaignId)

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
          total: stats.total,
          uniqueDebts: stats.uniqueDebts,
          uniqueCustomers: stats.uniqueCustomers,
        },
        lastEventAt: stats.lastEventAt ? stats.lastEventAt.toISOString() : null,
      },
    })
  })
)

handler.openapi(
  syncCampaignBrevoLogsSchema,
  withRouteTryCatch('campaigns.syncBrevoLogs', async (c) => {
    const workspaceId = requireWorkspaceId(c)
    const { id: campaignId } = c.req.valid('param')
    const { lookbackDays, pageSize } = c.req.valid('json')
    const prisma = c.get('prisma')

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

    const service = new BrevoTransactionalLogsService(prisma)
    const result = await service.syncCampaignLogs(campaignId, {
      lookbackDays,
      pageSize,
    })

    return c.json({
      data: result,
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

    const campaignName = typeof campaignNameValue === 'string' ? campaignNameValue.trim() : ''

    if (!campaignName) {
      throw new HTTPException(400, { message: 'Missing required form-data field "campaignName"' })
    }

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