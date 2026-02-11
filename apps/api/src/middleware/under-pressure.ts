import type { MiddlewareHandler } from 'hono'
import { logger } from '../utils/logger.js'
import type { Env } from '../types/index.js'
import type { MiddlewareDefinition } from './types.js'

let requestCount = 0
let lastReset = Date.now()
const RESET_INTERVAL = 60000 // 1 minute
const MAX_REQUESTS_PER_MINUTE = 1000

export const underPressure: MiddlewareHandler<Env> = async (c, next) => {
  const now = Date.now()
  
  // Reset counter every minute
  if (now - lastReset > RESET_INTERVAL) {
    requestCount = 0
    lastReset = now
  }

  requestCount++

  // Health check endpoint
  if (c.req.path === '/health') {
    const memoryUsage = process.memoryUsage()
    const uptime = process.uptime()
    
    return c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime,
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      },
      requests: {
        count: requestCount,
        maxPerMinute: MAX_REQUESTS_PER_MINUTE,
      },
    })
  }

  // Check if under pressure
  if (requestCount > MAX_REQUESTS_PER_MINUTE) {
    logger.warn({ requestCount }, 'Server under pressure')
    return c.json(
      {
        error: 'Service temporarily unavailable',
        retryAfter: Math.ceil((RESET_INTERVAL - (now - lastReset)) / 1000),
      },
      503
    )
  }

  await next()
}

const definition: MiddlewareDefinition = {
  name: 'under-pressure',
  handler: underPressure,
  order: 90,
}

export default definition

