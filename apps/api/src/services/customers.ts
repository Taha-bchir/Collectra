import { PrismaClient } from '@repo/database'
import { HTTPException } from 'hono/http-exception'

export type CustomerListOptions = {
  search?: string
  limit?: number
  offset?: number
}

export type CreateCustomerInput = {
  fullName: string
  email?: string
  phone?: string
  address?: string
}

export type UpdateCustomerInput = Partial<{
  fullName: string
  email?: string | null
  phone?: string | null
  address?: string | null
}>

export class CustomersService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(workspaceId: string, options: CustomerListOptions = {}) {
    const { search, limit = 50, offset = 0 } = options
    const safeLimit = Math.min(Math.max(limit, 1), 200)
    const safeOffset = Math.max(offset, 0)

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
      take: safeLimit,
      skip: safeOffset,
    })
  }

  async getById(workspaceId: string, id: string) {
    const customer = await this.prisma.client.findUnique({
      where: { id },
    })

    if (!customer || customer.workspaceId !== workspaceId) {
      throw new HTTPException(404, { message: 'Customer not found or not in your workspace' })
    }

    return customer
  }

  async create(workspaceId: string, data: CreateCustomerInput) {
    return this.prisma.client.create({
      data: {
        ...data,
        workspaceId,
      },
    })
  }

  async update(workspaceId: string, id: string, data: UpdateCustomerInput) {
    await this.getById(workspaceId, id)

    return this.prisma.client.update({
      where: { id },
      data,
    })
  }
}