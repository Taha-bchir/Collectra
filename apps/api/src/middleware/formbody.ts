// Hono v4 has built-in body parsing, no need for separate middleware
// This is a placeholder that just passes through
import type { MiddlewareHandler } from 'hono'
import type { Env } from '../types/index.js'
import type { MiddlewareDefinition } from './types.js'

export const formBodyParser: MiddlewareHandler<Env> = async (c, next) => {
  // Hono automatically parses JSON and form bodies
  await next()
}

const definition: MiddlewareDefinition = {
  name: 'form-body',
  handler: formBodyParser,
  order: 60,
}

export default definition

