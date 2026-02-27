import { PrismaClient } from '@repo/database'
import { HTTPException } from 'hono/http-exception'
import type { DebtStatus } from '@repo/database'
import { randomUUID } from 'crypto';
import { env } from '../config/env.js'


/**
 * SECURITY & LINK FORMAT – CUSTOMER PERSONAL LINKS
 *
 * Format: https://app.collectra.com/client/view?token=<uuid-token>
 *
 * - Token is a cryptographically secure UUID (crypto.randomUUID())
 * - Token is unique per debt and stored in DebtRecord.customerToken
 * - Link requires NO authentication – pure token-based access
 * - Token is unguessable (128-bit random) and scoped to one debt
 * - Optional expiry: enforced by tokenExpiresAt field (future middleware)
 * - NEVER expose raw debt IDs or predictable patterns in links
 * - Customer actions (view, promise, confirm) are logged anonymously
 */

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


  async generateCustomerToken(workspaceId: string, debtId: string) {
  const debt = await this.getById(workspaceId, debtId); // ensures ownership

  if (debt.customerToken) {
    // Already exists → return existing (or regenerate if you want)
    return debt.customerToken;
  }

  const token = randomUUID(); // cryptographically secure UUID
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  const updated = await this.prisma.debtRecord.update({
    where: { id: debtId },
    data: {
      customerToken: token,
      tokenExpiresAt: expiresAt,
    },
    select: { customerToken: true },
  });

  return updated.customerToken;
}

async getPersonalLink(workspaceId: string, debtId: string) {
  const debt = await this.getById(workspaceId, debtId); // ownership check

  if (!debt.customerToken) {
    // Auto-generate if missing (optional – or force generation via separate endpoint)
    return this.generateCustomerToken(workspaceId, debtId).then(token => 
      `${env.WEB_URL}/client/view?token=${token}`
    );
  }

  return `${env.WEB_URL}/client/view?token=${debt.customerToken}`;
}

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