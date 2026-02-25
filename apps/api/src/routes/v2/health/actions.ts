import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { AutoLoadRoute } from 'hono-autoload/types'
import type { Env } from '../../../types/index.js'
import { performance } from 'node:perf_hooks'
import { withRouteTryCatch } from '../../../utils/route-helpers.js'

const handler = new OpenAPIHono<Env>()

const healthSchema = createRoute({
  method: 'get',
  path: '/',
  tags: ['Health'],
  summary: 'API v2 deep health probe',
  description: 'Extended diagnostics that surface runtime metrics for observability platforms.',
  responses: {
    200: {
      description: 'Extended service diagnostics',
      content: {
        'application/json': {
          schema: z.object({
            status: z.literal('ok'),
            version: z.string(),
            timestamp: z.string(),
            metrics: z.object({
              uptimeSeconds: z.number(),
              memoryMB: z.object({
                rss: z.number(),
                heapUsed: z.number(),
              }),
            }),
            checks: z.array(
              z.object({
                name: z.string(),
                status: z.enum(['pass', 'fail']),
                details: z
                  .object({
                    message: z.string().optional(),
                    durationMs: z.number().optional(),
                  })
                  .partial()
                  .optional(),
              })
            ),
          }),
        },
      },
    },
  },
})

handler.openapi(healthSchema, withRouteTryCatch('health.v2', async (c) => {
  const supabase = c.get('supabase')
  const prisma = c.get('prisma')
  const start = performance.now()

  // Placeholder for async readiness checks (extend with real queries over time)
  const checks = [
    {
      name: 'supabase',
      status: supabase ? 'pass' : 'fail',
      details: { message: supabase ? 'Client available' : 'Client missing' },
    },
    {
      name: 'prisma',
      status: prisma ? 'pass' : 'fail',
      details: { message: prisma ? 'Client available' : 'Client missing' },
    },
  ] as const

  const durationMs = performance.now() - start
  const memoryUsage = process.memoryUsage()

  return c.json({
    status: 'ok' as const,
    version: 'v2',
    timestamp: new Date().toISOString(),
    metrics: {
      uptimeSeconds: process.uptime(),
      memoryMB: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024),
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      },
    },
    checks: checks.map((check) => ({
      ...check,
      details: {
        ...check.details,
        durationMs,
      },
    })),
  })
}))

const routeModule: AutoLoadRoute = {
  path: '/api/v2/health',
  handler: handler as unknown as AutoLoadRoute['handler'],
}

export default routeModule

