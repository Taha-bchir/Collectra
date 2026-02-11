import type { MiddlewareHandler } from 'hono'
import type { Env } from '../types/index.js'

export const urlData: MiddlewareHandler<Env> = async (c, next) => {
  // URL data is automatically parsed by Hono
  // This middleware can be used for additional URL processing if needed
  await next()
}

