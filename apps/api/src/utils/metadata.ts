import type { Prisma } from '@repo/database'

export function normalizeMetadata(value: unknown) {
  return typeof value === 'object' && value !== null ? value : null
}

export function toPrismaMetadata(value: unknown): Prisma.InputJsonValue | undefined {
  return value as Prisma.InputJsonValue | undefined
}
