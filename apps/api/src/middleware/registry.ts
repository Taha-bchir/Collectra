import type { MiddlewareDefinition } from './types.js'

import authorization from './authorization.js'
import compression from './compress.js'
import cookie from './cookie.js'
import cors from './cors.js'
import formBody from './formbody.js'
import helmet from './helmet.js'
import requestId from './request-id.js'
import sensible from './sensible.js'
import setRequestLanguage from './set-request-language.js'
import underPressure from './under-pressure.js'

type RegistryEntry = MiddlewareDefinition | MiddlewareDefinition[]

export const middlewareRegistry: RegistryEntry[] = [
  requestId,
  authorization,
  cors,
  helmet,
  compression,
  cookie,
  formBody,
  setRequestLanguage,
  underPressure,
  sensible,
]


