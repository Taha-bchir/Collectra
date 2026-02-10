import type { ErrorHandler, Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { ZodError } from 'zod'
import { logger } from '../utils/logger.js'
import type { Env } from '../types/index.js'
import { resolveCorsOrigin } from './cors.js'

function applyCorsHeadersForError(c: Context<Env>, res: Response): Response {
  const originHeader = c.req.header('Origin')
  const allowedOrigin = resolveCorsOrigin(originHeader)

  if (allowedOrigin) {
    res.headers.set('Access-Control-Allow-Origin', allowedOrigin)
    res.headers.set('Vary', 'Origin')
    res.headers.set('Access-Control-Allow-Credentials', 'true')
  }

  return res
}

export const errorHandler: ErrorHandler<Env> = (err, c) => {
  const requestId = c.get('requestId')

  logger.error(
    {
      requestId,
      error: err.message,
      stack: err.stack,
      path: c.req.path,
      method: c.req.method,
    },
    'Request error'
  )

  if (err instanceof HTTPException) {
    const res = err.getResponse()
    return applyCorsHeadersForError(c, res)
  }

  // Handle validation errors
  if (err instanceof ZodError) {
    const res = c.json(
      {
        error: 'Validation error',
        details: err.issues,
      },
      400
    )
    return applyCorsHeadersForError(c, res)
  }

  // Default error response
  const statusCode = err instanceof HTTPException ? err.status : 500
  const message =
    statusCode === 500 && process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message

  const res = c.json(
    {
      error: message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
    statusCode
  )

  return applyCorsHeadersForError(c, res)
}

