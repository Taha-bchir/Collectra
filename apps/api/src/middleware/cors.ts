import { cors } from 'hono/cors'
import { env } from '../config/env.js'
import type { MiddlewareDefinition } from './types.js'
import { logger } from '../utils/logger.js'

export function resolveCorsOrigin(origin: string | null | undefined): string | null {
  // In production, strictly validate against allowed origins
  if (env.NODE_ENV === 'production') {
    const allowedOrigins: string[] = []

    // Parse ALLOWED_ORIGINS if provided (comma-separated)
    if (env.ALLOWED_ORIGINS) {
      const parsedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
      allowedOrigins.push(...parsedOrigins)
    }

    // If no origins configured, reject all (security-first approach)
    if (allowedOrigins.length === 0) {
      logger.warn(
        { origin, env: env.NODE_ENV },
        '[cors] No ALLOWED_ORIGINS configured; rejecting all cross-origin requests',
      )
      return null
    }

    // Validate origin against allowed list
    if (origin) {
      const isAllowed = allowedOrigins.some((allowed) => {
        try {
          const allowedUrl = new URL(allowed)
          const originUrl = new URL(origin)
          // Exact match or same origin (protocol + host)
          return originUrl.origin === allowedUrl.origin || origin.startsWith(allowed)
        } catch {
          // If URL parsing fails, do simple string comparison
          return origin === allowed || origin.startsWith(allowed)
        }
      })

      if (isAllowed) {
        return origin
      }

      // Reject invalid origins in production
      logger.warn(
        { origin, allowedOrigins, env: env.NODE_ENV },
        '[cors] Blocked request from disallowed origin',
      )
      return null
    }

    // No origin header (e.g. server-to-server); do not expose to browsers
    return null
  }

  // In development/staging, allow all origins for easier development
  return origin || '*'
}

export const corsMiddleware = cors({
  origin: (origin) => resolveCorsOrigin(origin),
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id'],
  exposeHeaders: ['Content-Length', 'X-Request-Id'],
  credentials: true,
  maxAge: 86400, // 24 hours
})

const definition: MiddlewareDefinition = {
  name: 'cors',
  handler: corsMiddleware,
  order: 30,
}

export default definition

