import type { Prisma } from '@repo/database'
import { DebtStatus, PrismaClient } from '@repo/database'
import { HTTPException } from 'hono/http-exception'

export type GetDashboardStatsOptions = {
  campaignId?: string
  includeRecentCampaigns?: boolean
  recentCampaignsLimit?: number
}

export type DashboardDebtStatusCounts = Record<DebtStatus, number>

export type DashboardRecentCampaignSummary<TDate = Date> = {
  id: string
  name: string
  createdAt: TDate
  debtsCount: number
  promisedCount: number
  paidCount: number
}

export type DashboardStatsResult<TDate = Date> = {
  scope: 'workspace' | 'campaign'
  campaignId: string | null
  statuses: DashboardDebtStatusCounts
  totalDebts: number
  totalOverdueAmount: number
  recentCampaigns?: DashboardRecentCampaignSummary<TDate>[]
}

export class StatsService {
  constructor(private readonly prisma: PrismaClient) {}

  async getDashboardStats(
    workspaceId: string,
    options: GetDashboardStatsOptions = {}
  ): Promise<DashboardStatsResult<Date>> {
    const { campaignId } = options
    const includeRecentCampaigns = options.includeRecentCampaigns === true && !campaignId
    const recentCampaignsLimit = clampRecentCampaignsLimit(options.recentCampaignsLimit)

    if (campaignId) {
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: campaignId },
        select: {
          id: true,
          workspaceId: true,
        },
      })

      if (!campaign || campaign.workspaceId !== workspaceId) {
        throw new HTTPException(404, {
          message: 'Campaign not found or not in your workspace',
        })
      }
    }

    const debtWhere: Prisma.DebtRecordWhereInput = {
      campaign: { workspaceId },
      ...(campaignId ? { campaignId } : {}),
    }

    const [groupedStatusCounts, overdueAggregate, recentCampaigns] = await Promise.all([
      this.prisma.debtRecord.groupBy({
        by: ['status'],
        where: debtWhere,
        _count: {
          _all: true,
        },
      }),
      this.prisma.debtRecord.aggregate({
        where: {
          ...debtWhere,
          status: DebtStatus.OVERDUE_AFTER_PROMISE,
        },
        _sum: {
          amount: true,
        },
      }),
      includeRecentCampaigns
        ? this.buildRecentCampaignsStats(workspaceId, recentCampaignsLimit)
        : Promise.resolve(undefined),
    ])

    const statuses = createEmptyStatusCounts()

    for (const grouped of groupedStatusCounts) {
      statuses[grouped.status] = grouped._count._all
    }

    const totalDebts = Object.values(statuses).reduce((sum, value) => sum + value, 0)

    return {
      scope: campaignId ? 'campaign' : 'workspace',
      campaignId: campaignId ?? null,
      statuses,
      totalDebts,
      totalOverdueAmount: Number(overdueAggregate._sum.amount ?? 0),
      ...(recentCampaigns ? { recentCampaigns } : {}),
    }
  }

  private async buildRecentCampaignsStats(
    workspaceId: string,
    limit: number
  ): Promise<DashboardRecentCampaignSummary<Date>[]> {
    const campaigns = await this.prisma.campaign.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: {
          select: {
            debts: true,
          },
        },
      },
    })

    if (!campaigns.length) {
      return []
    }

    const campaignIds = campaigns.map((campaign) => campaign.id)

    const groupedByCampaignAndStatus = await this.prisma.debtRecord.groupBy({
      by: ['campaignId', 'status'],
      where: {
        campaignId: {
          in: campaignIds,
        },
      },
      _count: {
        _all: true,
      },
    })

    const countsByCampaign = new Map<string, { promisedCount: number; paidCount: number }>()

    for (const grouped of groupedByCampaignAndStatus) {
      const previous = countsByCampaign.get(grouped.campaignId) ?? {
        promisedCount: 0,
        paidCount: 0,
      }

      if (grouped.status === DebtStatus.PROMISE_TO_PAY) {
        previous.promisedCount = grouped._count._all
      }

      if (grouped.status === DebtStatus.PAID) {
        previous.paidCount = grouped._count._all
      }

      countsByCampaign.set(grouped.campaignId, previous)
    }

    return campaigns.map((campaign) => {
      const counters = countsByCampaign.get(campaign.id) ?? {
        promisedCount: 0,
        paidCount: 0,
      }

      return {
        id: campaign.id,
        name: campaign.name,
        createdAt: campaign.createdAt,
        debtsCount: campaign._count.debts,
        promisedCount: counters.promisedCount,
        paidCount: counters.paidCount,
      }
    })
  }
}

function createEmptyStatusCounts(): DashboardDebtStatusCounts {
  return {
    [DebtStatus.IMPORTED]: 0,
    [DebtStatus.NOTIFIED]: 0,
    [DebtStatus.PROMISE_TO_PAY]: 0,
    [DebtStatus.PAID]: 0,
    [DebtStatus.OVERDUE_AFTER_PROMISE]: 0,
  }
}

function clampRecentCampaignsLimit(input?: number) {
  if (!input || Number.isNaN(input)) {
    return 5
  }

  return Math.min(Math.max(Math.floor(input), 1), 10)
}
