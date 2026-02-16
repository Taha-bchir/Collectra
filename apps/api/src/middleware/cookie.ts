import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import type { MiddlewareHandler } from 'hono'
import type { Env } from '../types/index.js'
import type { MiddlewareDefinition } from './types.js'

/** Cookie names for auth tokens (HTTP-only, not readable by JS). */
export const AUTH_COOKIE_NAMES = {
  accessToken: 'access_token',
  refreshToken: 'refresh_token',
} as const

export const WORKSPACE_COOKIE_NAME = 'workspace_id'

const REFRESH_TOKEN_MAX_AGE_DAYS = 30

type CookieOptions = {
  domain?: string
  expires?: Date
  httpOnly?: boolean
  maxAge?: number
  path?: string
  secure?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None' | 'strict' | 'lax' | 'none'
  partitioned?: boolean
  priority?: 'Low' | 'Medium' | 'High' | 'low' | 'medium' | 'high'
  prefix?: 'host' | 'secure'
}

export const cookieMiddleware: MiddlewareHandler<Env> = async (c, next) => {
  await next()
}

export const getCookieHelper = (c: any, name: string) => getCookie(c, name)

// In dev, use SameSite=None; Secure so cookies are sent on cross-origin requests (e.g. web :3001 → API :3000).
// Browsers treat localhost as secure, so this works for local development.
export const setCookieHelper = (c: any, name: string, value: string, options?: CookieOptions) => {
  const baseOptions: CookieOptions = {
    httpOnly: true,
    secure: true, // required when sameSite is None (needed for cross-origin from web to API)
    sameSite: 'None',
    path: '/',
  }
  const mergedOptions: CookieOptions = options ? { ...baseOptions, ...options } : baseOptions
  setCookie(c, name, value, mergedOptions)
}

/** Set auth tokens as HTTP-only cookies. Access token uses expiresIn (seconds); refresh uses long maxAge. */
export const setAuthCookies = (
  c: any,
  accessToken: string,
  refreshToken: string,
  expiresInSeconds: number,
) => {
  setCookieHelper(c, AUTH_COOKIE_NAMES.accessToken, accessToken, {
    maxAge: expiresInSeconds,
    path: '/',
  })
  setCookieHelper(c, AUTH_COOKIE_NAMES.refreshToken, refreshToken, {
    maxAge: REFRESH_TOKEN_MAX_AGE_DAYS * 24 * 60 * 60,
    path: '/',
  })
}

/** Clear auth cookies (logout). */
export const clearAuthCookies = (c: any) => {
  deleteCookie(c, AUTH_COOKIE_NAMES.accessToken, { path: '/' })
  deleteCookie(c, AUTH_COOKIE_NAMES.refreshToken, { path: '/' })
}

export const deleteCookieHelper = (c: any, name: string) => deleteCookie(c, name)

export const setWorkspaceCookie = (c: any, workspaceId: string) => {
  setCookieHelper(c, WORKSPACE_COOKIE_NAME, workspaceId, { path: '/' })
}

const definition: MiddlewareDefinition = {
  name: 'cookies',
  handler: cookieMiddleware,
  order: 50,
}

export default definition


