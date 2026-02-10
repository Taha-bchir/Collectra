import type { OpenAPIHono } from '@hono/zod-openapi'
import type { Env } from '../types/index.js'
import { env } from '../config/env.js'

export const setupSwagger = (app: OpenAPIHono<Env>) => {
  const servers = [env.API_URL]
    .filter((url): url is string => typeof url === 'string' && url.length > 0)
    .map((url) => ({ url }))

  app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  })

  app.doc('/openapi.json', {
    openapi: '3.1.0',
    info: {
      title: 'Aqeel API',
      version: '1.0.0',
      description: 'REST API powered by Hono, Supabase, and Prisma',
    },
    servers: servers.length ? servers : undefined,
  })
}

