import { HTTPException } from 'hono/http-exception'
import type { Context } from 'hono'

import type { Env } from '../types/index.js'
import { logger } from './logger.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withRouteTryCatch<THandler extends (c: any) => any>(
  scope: string,
  handler: THandler
): THandler {
  return (async (c: Parameters<THandler>[0]): Promise<Awaited<ReturnType<THandler>>> => {

    try {
      return await handler(c)
    } catch (error) {
      if (error instanceof HTTPException) {
        throw error
      }

      const context = c as unknown as Context<Env>

      logger.error(
        {
          error,
          scope,
          path: context.req.path,
          method: context.req.method,
          requestId: context.get('requestId'),
        },
        'Unhandled route error'
      )

      throw new HTTPException(500, { message: 'Internal server error' })
    }
  }) as THandler
}

export function requireWorkspaceId(c: Context<Env>, message = 'No active workspace') {
  const workspaceId = c.get('currentWorkspace')?.id

  if (!workspaceId) {
    throw new HTTPException(403, { message })
  }

  return workspaceId
}

export function requireUserId(c: Context<Env>, message = 'Unauthorized') {
  const userId = c.get('user')?.id

  if (!userId) {
    throw new HTTPException(401, { message })
  }

  return userId
}
