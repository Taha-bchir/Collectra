import type { MiddlewareHandler } from 'hono'
import type { Env } from '../types/index.js'

export const multipart: MiddlewareHandler<Env> = async (c, next) => {
  // Hono v4 handles multipart automatically via c.req.parseBody()
  // This middleware is a placeholder for custom multipart handling if needed
  await next()
}

