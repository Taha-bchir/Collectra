import type { MiddlewareHandler, Hono } from 'hono'
import type { OpenAPIHono } from '@hono/zod-openapi'
import type { AutoLoadMiddleware, AutoLoadRoute } from 'hono-autoload/types'
import type { Env } from '../types/index.js'
import { readdir } from 'node:fs/promises'
import type { Dirent } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { logger } from '../utils/logger.js'
import { env } from '../config/env.js'
import { middlewareRegistry } from './registry.js'

type MiddlewareExport =
  | AutoLoadMiddleware
  | AutoLoadMiddleware[]
  | {
      handler?: MiddlewareHandler<Env>
      matcher?: string
      pattern?: string
      order?: number
      name?: string
    }
  | Array<{
      handler?: MiddlewareHandler<Env>
      matcher?: string
      pattern?: string
      order?: number
      name?: string
    }>

type RouteExport =
  | AutoLoadRoute
  | AutoLoadRoute[]
  | {
      path?: string
      handler?: Hono
      priority?: number
      name?: string
    }
  | Array<{
      path?: string
      handler?: Hono
      priority?: number
      name?: string
    }>

type NormalizedMiddleware = {
  handler: MiddlewareHandler<Env>
  matcher?: string
  order?: number
  source: string
  label: string
}

type NormalizedRoute = {
  path: string
  handler: Hono
  priority?: number
  source: string
  label: string
}

const VALID_EXTENSIONS = new Set(['.ts', '.js', '.mjs', '.cjs'])
const CURRENT_FILE = fileURLToPath(import.meta.url)
const CURRENT_DIR = dirname(CURRENT_FILE)
const ROUTES_DIR = join(CURRENT_DIR, '..', 'routes')

export async function registerGlobalMiddlewares(app: OpenAPIHono<Env>) {
  const middlewares = middlewareRegistry.flatMap((definition, index) =>
    normalizeMiddlewareExport(
      definition as MiddlewareExport,
      getRegistryLabel(definition as MiddlewareExport, index)
    )
  )

  // logger.info({ middlewares }, 'Middlewares')

  if (!middlewares.length) {
    logger.warn({ env: env.NODE_ENV }, '[autoload] No middleware modules detected.')
    return
  }

  const sorted = middlewares.sort(
    (a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER)
  )

  for (const middleware of sorted) {
    if (middleware.matcher && middleware.matcher !== '*') {
      app.use(middleware.matcher, middleware.handler)
    } else {
      app.use(middleware.handler)
    }
  }

  logger.info(
    // {
    //   env: env.NODE_ENV,
    //   count: sorted.length,
    //   middlewares: sorted.map((m) => m.label),
    // },
    `Successfully loaded ${sorted.length} middleware(s)`
  )
}

export async function registerAutoRoutes(app: OpenAPIHono<Env>) {
  const routes = await collectRoutes(ROUTES_DIR)

  if (!routes.length) {
    logger.warn({ env: env.NODE_ENV }, '[autoload] No route modules detected.')
    return
  }

  const sorted = routes.sort(
    (a, b) => (a.priority ?? Number.MAX_SAFE_INTEGER) - (b.priority ?? Number.MAX_SAFE_INTEGER)
  )

  for (const route of sorted) {
    app.route(route.path, route.handler)
  }

  logger.info(
    // {
    //   env: env.NODE_ENV,
    //   count: sorted.length,
    //   routes: sorted.map((r) => r.path),
    // },
    `Successfully loaded ${sorted.length} route(s)`
  )
}

async function collectRoutes(targetDir: string): Promise<NormalizedRoute[]> {
  const entries = await safeReadDir(targetDir)
  const collected: NormalizedRoute[] = []

  for (const entry of entries) {
    const fullPath = join(targetDir, entry.name)

    if (entry.isDirectory()) {
      collected.push(...(await collectRoutes(fullPath)))
      continue
    }

    if (!shouldProcessFile(fullPath, entry)) {
      continue
    }

    const moduleExport = await safeImport<RouteExport>(fullPath)
    if (!moduleExport) {
      continue
    }

    const normalized = normalizeRouteExport(moduleExport, entry.name)
    collected.push(...normalized)
  }

  return collected
}

async function safeReadDir(dir: string): Promise<Dirent[]> {
  try {
    return await readdir(dir, { withFileTypes: true })
  } catch (error) {
    logger.error({ error, dir, env: env.NODE_ENV }, '[autoload] Failed to read directory')
    return []
  }
}

function shouldProcessFile(filePath: string, entry: Dirent): boolean {
  if (!entry.isFile()) return false
  if (filePath === CURRENT_FILE) return false
  if (entry.name.endsWith('.d.ts') || entry.name.endsWith('.map')) return false

  const extension = extname(entry.name)
  return VALID_EXTENSIONS.has(extension)
}

async function safeImport<TModule>(filePath: string): Promise<TModule | null> {
  try {
    const moduleUrl = pathToFileURL(filePath).href
    const imported = await import(moduleUrl)
    return (imported?.default ?? null) as TModule | null
  } catch (error) {
    logger.error({ error, filePath, env: env.NODE_ENV }, '[autoload] Failed to import module')
    return null
  }
}

function normalizeMiddlewareExport(
  exported: MiddlewareExport,
  source: string
): NormalizedMiddleware[] {
  if (!exported) {
    return []
  }

  if (Array.isArray(exported)) {
    return exported.flatMap((item, index) =>
      normalizeMiddlewareExport(item as MiddlewareExport, `${source}[${index}]`)
    )
  }

  if (typeof exported === 'object' && exported !== null && 'handler' in exported) {
    const handler = exported.handler

    if (typeof handler === 'function') {
      const matcher =
        (typeof (exported as AutoLoadMiddleware).matcher === 'string'
          ? (exported as AutoLoadMiddleware).matcher
          : undefined) ??
        (typeof (exported as { pattern?: string }).pattern === 'string'
          ? (exported as { pattern?: string }).pattern
          : undefined)
      const order = 'order' in exported ? exported.order : undefined
      const name = 'name' in exported && typeof exported.name === 'string' ? exported.name : undefined

      return [
        {
          handler,
          matcher,
          order,
          source,
          label: name ?? source,
        },
      ]
    }
  }

  logger.warn({ source, env: env.NODE_ENV }, '[autoload] Skipping invalid middleware module')
  return []
}

function normalizeRouteExport(exported: RouteExport, source: string): NormalizedRoute[] {
  if (!exported) {
    return []
  }

  if (Array.isArray(exported)) {
    return exported.flatMap((item, index) =>
      normalizeRouteExport(item as RouteExport, `${source}[${index}]`)
    )
  }

  if (typeof exported === 'object' && exported !== null && 'path' in exported && 'handler' in exported) {
    const path = exported.path
    const handler = exported.handler

    if (typeof path === 'string' && handler && typeof (handler as Hono).route === 'function') {
      const priority = 'priority' in exported ? exported.priority : undefined
      const name = 'name' in exported && typeof exported.name === 'string' ? exported.name : undefined

      return [
        {
          path,
          handler,
          priority,
          source,
          label: name ?? path,
        },
      ]
    }
  }

  logger.warn({ source, env: env.NODE_ENV }, '[autoload] Skipping invalid route module')
  return []
}

function getRegistryLabel(entry: MiddlewareExport, index: number): string {
  if (Array.isArray(entry)) {
    return `registry[${index}]`
  }

  if (entry && typeof entry === 'object' && 'name' in entry && typeof entry.name === 'string') {
    return entry.name
  }

  return `registry[${index}]`
}