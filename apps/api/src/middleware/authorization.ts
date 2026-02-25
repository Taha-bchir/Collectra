import type { MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { Env } from '../types/index.js'
import type { MiddlewareDefinition } from './types.js'
import type { Database } from '@repo/types'
import { getCookie } from 'hono/cookie'
import { getSupabaseClient } from '../lib/supabase.js'
import { logger } from '../utils/logger.js'
import { AUTH_COOKIE_NAMES, WORKSPACE_COOKIE_NAME } from './cookie.js'

/** Path patterns that require a valid JWT. Only these receive the authorization middleware. */
const PROTECTED_PATTERNS = [
  '/api/v1/users/*',
  '/api/v1/workspaces/*',
  '/api/v1/customers',
  '/api/v1/customers/*',
  '/api/v1/debts',
  '/api/v1/debts/*',
  '/api/v1/actions',
  '/api/v1/actions/*',
  '/api/v1/authentication/reset-password',
  '/api/v1/test-tenant',
  '/api/v1/test-tenant/*',
] as const

const TENANT_SCOPED_PREFIXES = [
  '/api/v1/customers',
  '/api/v1/debts',
  '/api/v1/actions',
  '/api/v1/test-tenant',
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

    if (isTenantScopedPath(c.req.path)) {
      await attachTenantContext(c, {
        id: user.id,
        email: user.email ?? undefined,
      })
    }

    await next()
  } catch (err) {
    if (err instanceof HTTPException) {
      throw err
    }

    logger.error({ err }, 'Authorization error')
    return c.json({ error: 'Authorization failed' }, 401)
  }
}

function isTenantScopedPath(path: string) {
  return TENANT_SCOPED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

type AuthUserContext = {
  id: string
  email?: string
}

export async function attachTenantContext(
  c: Parameters<MiddlewareHandler<Env>>[0],
  user: AuthUserContext
) {
  const prisma = c.get('prisma')

  const workspaceHeader = c.req.header('x-workspace-id')?.trim() || null
  const workspaceCookie = getCookie(c, WORKSPACE_COOKIE_NAME) || null

  let membership = null

  if (workspaceHeader) {
    membership = await prisma.workspaceMember.findFirst({
      where: {
        userId: user.id,
        workspaceId: workspaceHeader,
      },
      select: {
        role: true,
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!membership?.workspace) {
      logger.warn(
        { userId: user.id, workspaceId: workspaceHeader, path: c.req.path },
        '[authorization] Invalid x-workspace-id for user'
      )
      throw new HTTPException(403, { message: 'Forbidden workspace' })
    }
  } else {
    if (workspaceCookie) {
      membership = await prisma.workspaceMember.findFirst({
        where: {
          userId: user.id,
          workspaceId: workspaceCookie,
        },
        select: {
          role: true,
          workspace: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      })
    }

    if (!membership?.workspace) {
      membership = await prisma.workspaceMember.findFirst({
        where: {
          userId: user.id,
        },
        select: {
          role: true,
          workspace: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          joinedAt: 'desc',
        },
      })
    }

    if (!membership?.workspace) {
      logger.warn({ userId: user.id, path: c.req.path }, '[authorization] No workspace membership found')
      throw new HTTPException(403, { message: 'No workspace found for user' })
    }
  }

  c.set('currentWorkspace', {
    id: membership.workspace.id,
    name: membership.workspace.name,
  })

  c.set('currentUser', {
    id: user.id,
    email: user.email,
    role: membership.role,
  })
}
