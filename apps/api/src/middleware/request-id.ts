import type { MiddlewareHandler } from 'hono'
import { randomUUID } from 'node:crypto'
import type { Env } from '../types/index.js'
import type { MiddlewareDefinition } from './types.js'

export const requestId: MiddlewareHandler<Env> = async (c, next) => {
  // Check if request ID already exists in header (for tracing across services)
  const id = c.req.header('X-Request-Id') || randomUUID()
  
  // Set request ID in context for logging
  c.set('requestId', id)
  
  // Add request ID to response headers
  c.header('X-Request-Id', id)
  
  await next()
}

const definition: MiddlewareDefinition = {
  name: 'request-id',
  handler: requestId,
  order: 5, // Early in the chain, before logging
}

export default definition

