import type { MiddlewareHandler } from 'hono'
import type { Env } from '../types/index.js'
import type { MiddlewareDefinition } from './types.js'
import type { Database } from '@repo/types'
import { getCookie } from 'hono/cookie'
import { getSupabaseClient } from '../lib/supabase.js'
import { logger } from '../utils/logger.js'
import { AUTH_COOKIE_NAMES } from './cookie.js'

/** Path patterns that require a valid JWT. Only these receive the authorization middleware. */
const PROTECTED_PATTERNS = [
  '/api/v1/users/*',
  '/api/v1/workspaces/*',
  '/api/v1/customers',
  '/api/v1/customers/*',
  '/api/v1/debts',
  '/api/v1/debts/*',
  '/api/v1/authentication/reset-password',
] as const

export const authorization: MiddlewareHandler<Env> = async (c, next) => {
  return enforceAuth(c, next)
}

/**
 * Role-based authorization helper - DEPRECATED.
 * The new schema uses workspace-based roles via WorkspaceMember.
 */
export function requireRole(roles: string[]): MiddlewareHandler<Env> {
  return async (c, next) => {
    const user = c.get('user')

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    // Note: User roles are now managed at workspace level via WorkspaceMember
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
    logger.warn(
      { 
        path: c.req.path,
        hasCookie: !!cookieToken,
        hasAuthHeader: !!authHeader,
        headers: Object.fromEntries(c.req.raw.headers.entries?.() ?? [])
      },
      '[authorization] No token found in cookie or Authorization header'
    )
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    const supabase = getSupabaseClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token)

    if (error || !user) {
      logger.warn({ error }, '[authorization] Token validation failed')
      return c.json({ error: 'Unauthorized' }, 401)
    }

    c.set('user', {
      id: user.id,
      email: user.email ?? undefined,
    })

    await next()
  } catch (err) {
    logger.error({ err }, 'Authorization error')
    return c.json({ error: 'Authorization failed' }, 401)
  }
}
