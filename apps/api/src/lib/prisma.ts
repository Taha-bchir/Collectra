import { prisma } from '@repo/database'

export const getPrismaClient = () => prisma

export type { PrismaClient } from '@repo/database'

