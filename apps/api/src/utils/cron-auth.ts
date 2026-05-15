import type { Context } from 'hono'
import { env } from '../config/env.js'

/**
 * When CRON_SECRET is set, rejects requests that do not present the same value
 * as Bearer token or x-cron-secret header. When unset, allows all (dev / legacy).
 */
export function assertCronSecret(c: Context): Response | null {
  const secret = env.CRON_SECRET
  if (!secret) {
    return null
  }

  const auth = c.req.header('Authorization')
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  const header = c.req.header('x-cron-secret')?.trim() ?? ''

  if (bearer === secret || header === secret) {
    return null
  }

  return c.json({ error: { message: 'Invalid or missing cron secret', code: 'CRON_FORBIDDEN' } }, 403)
}
