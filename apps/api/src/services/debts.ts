import { PrismaClient } from '@repo/database'
import { HTTPException } from 'hono/http-exception'
import type { DebtStatus } from '@repo/database'

export type DebtListFilters = {
  status?: DebtStatus
  clientId?: string
  campaignId?: string
}

export type DebtListOptions = {
  limit?: number
  offset?: number
}

export type CreateDebtInput = {
  campaignId: string
  clientId: string
  amount: number
  dueDate: Date
  status?: DebtStatus
  promiseDate?: Date | null
}

export type UpdateDebtInput = Partial<{
  amount: number
  dueDate: Date
  status: DebtStatus
  promiseDate?: Date | null
}>

export class DebtsService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(
    workspaceId: string,
    filters: DebtListFilters = {},
    options: DebtListOptions = {},
  ) {
    const { status, clientId, campaignId } = filters
    const { limit = 100, offset = 0 } = options

    const safeLimit = Math.min(Math.max(limit, 1), 500)
    const safeOffset = Math.max(offset, 0)

    return this.prisma.debtRecord.findMany({
      where: {
        campaign: { workspaceId },
        ...(status && { status }),
        ...(clientId && { clientId }),
        ...(campaignId && { campaignId }),
      },
      include: { client: true },
      orderBy: { dueDate: 'asc' },
      take: safeLimit,
      skip: safeOffset,
    })
  }

  async getById(workspaceId: string, id: string) {
    const debt = await this.prisma.debtRecord.findUnique({
      where: { id },
      include: { client: true, campaign: true },
    })

    if (!debt || debt.campaign.workspaceId !== workspaceId) {
      throw new HTTPException(404, { message: 'Debt not found or not in your workspace' })
    }

    return debt
  }

  async create(workspaceId: string, data: CreateDebtInput) {
    // Verify campaign & client both belong to the workspace before creating the debt
    const [campaign, client] = await Promise.all([
      this.prisma.campaign.findUnique({
        where: { id: data.campaignId },
      }),
      this.prisma.client.findUnique({
        where: { id: data.clientId },
      }),
    ] as const)

    if (!campaign || campaign.workspaceId !== workspaceId) {
      throw new HTTPException(403, { message: 'Campaign not in your workspace' })
    }

    if (!client || client.workspaceId !== workspaceId) {
      throw new HTTPException(403, { message: 'Client not in your workspace' })
    }

    return this.prisma.debtRecord.create({ data })
  }

  async update(workspaceId: string, id: string, data: UpdateDebtInput) {
    // Reuse tenant check from getById to ensure isolation
    await this.getById(workspaceId, id)

    return this.prisma.debtRecord.update({
      where: { id },
      data,
      include: { client: true },
    })
  }
}