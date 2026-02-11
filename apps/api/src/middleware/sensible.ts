import { logger } from '../utils/logger.js'
import type { MiddlewareHandler } from 'hono'
import type { Env } from '../types/index.js'
import type { MiddlewareDefinition } from './types.js'

// Remove X-Powered-By header (security best practice)
export const removePoweredBy: MiddlewareHandler<Env> = async (c, next) => {
  // Remove X-Powered-By header
  await next()
  c.res.headers.delete('X-Powered-By')
}

// Request logging middleware
export const requestLogger: MiddlewareHandler<Env> = async (c, next) => {
  const start = Date.now()
  const method = c.req.method
  const path = c.req.path
  const requestId = c.get('requestId')

  await next()

  const duration = Date.now() - start
  const status = c.res.status

  logger.info(
    {
      requestId,
      method,
      path,
      status,
      duration,
      ip: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
    },
    `${method} ${path} ${status}`
  )
}

const definitions: MiddlewareDefinition[] = [
  {
    name: 'remove-powered-by',
    handler: removePoweredBy,
    order: 10,
  },
  {
    name: 'request-logger',
    handler: requestLogger,
    order: 80,
  },
]

export default definitions


