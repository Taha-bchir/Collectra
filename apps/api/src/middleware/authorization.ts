/**
 * Authorization middleware
 *
 * Validates the request using the JWT (from cookie or Authorization header), attaches the
 * current user to the context, and returns 401 when the request is unauthenticated.
 *
 * ## Current API routes (reference)
 *
 * | Path pattern                         | Auth required | Notes                    |
 * |-------------------------------------|---------------|--------------------------|
 * | GET/PUT/DELETE /api/v1/users/me     | Yes           | Protected by this middleware |
 * | POST /api/v1/authentication/reset-password | Yes   | Needs valid token        |
 * | POST /api/v1/authentication/* (rest) | No            | login, register, refresh, etc. |
 * | GET /api/v1/health, /api/v2/health  | No            | Health checks            |
 *
 * ## Token resolution (priority)
 *
 * 1. Cookie: `access_token` (httpOnly, set by login/refresh).
 * 2. Header: `Authorization: Bearer <token>`.
 *
 * If neither is present or the token is invalid, the response is 401 Unauthorized.
 *
 * ## Context after successful auth
 *
 * `c.set('user', { id, email, role })` where:
 * - `id`: Supabase auth user id (UUID).
 * - `email`: User email.
 * - `role`: From JWT `user_metadata.role` (synced from DB on login/refresh). One of USER | ADMIN | DEMO.
 *
 * ## Protected patterns
 *
 * This middleware is applied only to the paths listed in `PROTECTED_PATTERNS` below.
 * Add or remove patterns there to match your routes; keep this list in sync with actual route modules.
 *
 * ## Role-based access
 *
 * Use the exported `requireRole(roles)` helper in route handlers when a route must be
 * restricted to certain roles (e.g. admin-only). It expects `c.get('user')` to be set
 * (i.e. this authorization middleware must have run first).
 */

import type { MiddlewareHandler } from 'hono'
import type { Env } from '../types/index.js'
import type { MiddlewareDefinition } from './types.js'
import { getCookie } from 'hono/cookie'
import { getSupabaseClient } from '../lib/supabase.js'
import { logger } from '../utils/logger.js'
import { AUTH_COOKIE_NAMES } from './cookie.js'

/** Path patterns that require a valid JWT. Only these receive the authorization middleware. */
const PROTECTED_PATTERNS = [
  '/api/v1/users/*',
  '/api/v1/authentication/reset-password',
] as const

export const authorization: MiddlewareHandler<Env> = async (c, next) => {
  return enforceAuth(c, next)
}

/**
 * Role-based authorization helper. Use after the main authorization middleware.
 * Returns 401 if no user, 403 if user's role is not in the allowed list.
 *
 * @example
 *   app.get('/admin/settings', requireRole(['ADMIN']), (c) => c.json({ ... }))
 */
export function requireRole(roles: string[]): MiddlewareHandler<Env> {
  return async (c, next) => {
    const user = c.get('user')

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    if (!roles.includes(user.role ?? '')) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    await next()
  }
}

const definitions: MiddlewareDefinition[] = PROTECTED_PATTERNS.map((pattern, index) => ({
  name: `authorization:${index}`,
  handler: authorization,
  pattern,
  order: 50,
}))

export default definitions

async function enforceAuth(c: Parameters<MiddlewareHandler<Env>>[0], next: () => Promise<void>) {
  const cookieToken = getCookie(c, AUTH_COOKIE_NAMES.accessToken)
  const authHeader = c.req.header('Authorization')
  const token =
    cookieToken ?? (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null)

  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    const supabase = getSupabaseClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)

    if (error || !user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    c.set('user', {
      id: user.id,
      email: user.email ?? undefined,
      role: user.user_metadata?.role as string | undefined,
    })

    await next()
  } catch (err) {
    logger.error({ err }, 'Authorization error')
    return c.json({ error: 'Authorization failed' }, 401)
  }
}
