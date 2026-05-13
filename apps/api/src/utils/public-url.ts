import { env } from '../config/env.js'

const DEFAULT_PUBLIC_WEB_URL = 'https://collectra.xyz'
const DEFAULT_PUBLIC_API_URL = 'https://collectra.xyz'

function isLocalhostOrigin(value: string): boolean {
  try {
    const { hostname } = new URL(value)
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
  } catch {
    return false
  }
}

export function resolvePublicWebUrl(fallback = DEFAULT_PUBLIC_WEB_URL): string {
  const candidates = [env.PUBLIC_WEB_URL, env.WEB_URL, env.API_URL, fallback]

  for (const candidate of candidates) {
    if (!candidate) continue
    if (isLocalhostOrigin(candidate) && env.NODE_ENV !== 'development') continue
    return candidate.replace(/\/$/, '')
  }

  return fallback.replace(/\/$/, '')
}

export function resolvePublicApiUrl(fallback = DEFAULT_PUBLIC_API_URL): string {
  const candidates = [env.API_URL, env.PUBLIC_WEB_URL, fallback]

  for (const candidate of candidates) {
    if (!candidate) continue
    if (isLocalhostOrigin(candidate) && env.NODE_ENV !== 'development') continue
    return candidate.replace(/\/$/, '')
  }

  return fallback.replace(/\/$/, '')
}
