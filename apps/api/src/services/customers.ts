import { PrismaClient } from '@repo/database';
import { HTTPException } from 'hono/http-exception';

export class CustomersService {
  constructor(private prisma: PrismaClient) {}

  async list(workspaceId: string, search?: string) {
    return this.prisma.client.findMany({
      where: {
        workspaceId,
        ...(search && {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
      orderBy: { fullName: 'asc' },
      take: 50, // pagination later
    });
  }

  async getById(workspaceId: string, id: string) {
    const customer = await this.prisma.client.findUnique({
      where: { id },
    });

    if (!customer || customer.workspaceId !== workspaceId) {
      throw new HTTPException(404, { message: 'Customer not found or not in your workspace' });
    }

    return customer;
  }

  async create(workspaceId: string, data: { fullName: string; email?: string; phone?: string; address?: string }) {
    return this.prisma.client.create({
      data: {
        ...data,
        workspaceId,
      },
    });
  }

  async update(
    workspaceId: string,
    id: string,
    data: Partial<{ fullName: string; email?: string | null; phone?: string | null; address?: string | null }>,
  ) {
    await this.getById(workspaceId, id);

    return this.prisma.client.update({
      where: { id },
      data,
    });
  }
}