import { serve } from '@hono/node-server'
import app from './app.js'
import { env } from './config/env.js'
import { logger } from './utils/logger.js'

const port = Number.parseInt(env.PORT, 10)

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    logger.info(`Loaded env file: ${env.NODE_ENV}`)
    logger.info(`Server running on http://localhost:${info.port}`)
    logger.info(`Documentation available on http://localhost:${info.port}/docs`)
})
