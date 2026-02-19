import { PrismaClient } from '@repo/database';
import { HTTPException } from 'hono/http-exception';
import type { DebtStatus } from '@repo/database';

export class DebtsService {
  constructor(private prisma: PrismaClient) {}

  async list(workspaceId: string, filters?: { status?: DebtStatus; clientId?: string; campaignId?: string }) {
    return this.prisma.debtRecord.findMany({
      where: {
        campaign: { workspaceId },
        ...(filters?.status && { status: filters.status }),
        ...(filters?.clientId && { clientId: filters.clientId }),
        ...(filters?.campaignId && { campaignId: filters.campaignId }),
      },
      include: { client: true },
      orderBy: { dueDate: 'asc' },
      take: 100,
    });
  }

  async getById(workspaceId: string, id: string) {
    const debt = await this.prisma.debtRecord.findUnique({
      where: { id },
      include: { client: true, campaign: true },
    });

    if (!debt || debt.campaign.workspaceId !== workspaceId) {
      throw new HTTPException(404, { message: 'Debt not found or not in your workspace' });
    }

    return debt;
  }

  async create(workspaceId: string, data: {
    campaignId: string;
    clientId: string;
    amount: number;
    dueDate: Date;
    status?: DebtStatus;
    promiseDate?: Date | null;
  }) {
    // Optional: verify campaign belongs to workspace
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: data.campaignId },
    });
    if (!campaign || campaign.workspaceId !== workspaceId) {
      throw new HTTPException(403, { message: 'Campaign not in your workspace' });
    }

    const client = await this.prisma.client.findUnique({
      where: { id: data.clientId },
    });
    if (!client || client.workspaceId !== workspaceId) {
      throw new HTTPException(403, { message: 'Client not in your workspace' });
    }

    return this.prisma.debtRecord.create({ data });
  }

  async update(workspaceId: string, id: string, data: Partial<{
    amount: number;
    dueDate: Date;
    status: DebtStatus;
    promiseDate?: Date | null;
  }>) {
    await this.getById(workspaceId, id);

    return this.prisma.debtRecord.update({
      where: { id },
      data,
    });
  }
}