import { HTTPException } from 'hono/http-exception'

import type { AppContext } from '../types/index.js'

type AuthenticatedUser = NonNullable<AppContext['var']['user']>

export function requireUser(c: AppContext): AuthenticatedUser {
  const user = c.get('user')

  if (!user) {
    throw new HTTPException(401, { message: 'Unauthorized' })
  }

  return user
}