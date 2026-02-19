import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { Context, MiddlewareHandler } from 'hono'
import { errorHandler } from './middleware/error-handler.js'
import { setupSwagger } from './middleware/swagger.js'
import { mountSwaggerUI } from './middleware/swagger-ui.js'
import { getSupabaseClient } from './lib/supabase.js'
import { getPrismaClient } from './lib/prisma.js'
import type { Env } from './types/index.js'
import { registerGlobalMiddlewares, registerAutoRoutes } from './middleware/autoloader.js'

const supabase = getSupabaseClient()
const prisma = getPrismaClient()

const app = new OpenAPIHono<Env>({
  strict: false,
})

const servicesMiddleware: MiddlewareHandler<Env> = async (c, next) => {
  c.set('supabase', supabase)
  c.set('prisma', prisma)
  await next()
}

app.use('*', servicesMiddleware)

await registerGlobalMiddlewares(app)

await registerAutoRoutes(app)

const rootRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['Root'],
  responses: {
    200: {
      description: 'API root',
      content: {
        'application/json': {
          schema: z.object({
            message: z.string(),
            version: z.string(),
            docs: z.string(),
          }),
        },
      },
    },
  },
})

app.openapi(rootRoute, (c: Context<Env>) => {
  return c.json({
    message: 'Welcome to the API',
    version: '1.0.0',
    docs: '/docs',
  })
})

setupSwagger(app)
mountSwaggerUI(app)

app.notFound((c: Context<Env>) => {
  return c.json({ error: 'Not Found' }, 404)
})

app.onError(errorHandler)

export default app


