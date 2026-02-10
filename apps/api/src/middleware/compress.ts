import { compress } from 'hono/compress'
import type { MiddlewareDefinition } from './types.js'

export const compression = compress({
  encoding: 'gzip',
})

const definition: MiddlewareDefinition = {
  name: 'compression',
  handler: compression,
  order: 40,
}

export default definition

