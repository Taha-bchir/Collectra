import { swaggerUI } from '@hono/swagger-ui'
import type { OpenAPIHono } from '@hono/zod-openapi'
import type { Env } from '../types/index.js'

export const mountSwaggerUI = (
  app: OpenAPIHono<Env>,
  options: { path?: string; documentPath?: string } = {}
) => {
  const { path = '/docs', documentPath = '/openapi.json' } = options
  app.get(path, swaggerUI({ url: documentPath }))
}

