import type { MiddlewareHandler } from 'hono'
import type { Env } from '../types/index.js'

export interface MiddlewareDefinition {
  name: string
  handler: MiddlewareHandler<Env>
  pattern?: string
  order?: number
  applyByDefault?: boolean
}


