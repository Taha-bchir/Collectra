import { getCookie } from 'hono/cookie'
import type { MiddlewareHandler } from 'hono'
import type { Env } from '../types/index.js'
import type { MiddlewareDefinition } from './types.js'

export const setRequestLanguage: MiddlewareHandler<Env> = async (c, next) => {
  // Language can be set from:
  // 1. Query parameter: ?lang=en
  // 2. Header: Accept-Language
  // 3. Cookie: lang
  // 4. Default: en

  const langFromQuery = c.req.query('lang')
  const langFromHeader = c.req.header('Accept-Language')?.split(',')[0]?.split('-')[0]
  const langFromCookie = getCookie(c, 'lang')
  
  const language = langFromQuery || langFromCookie || langFromHeader || 'en'
  
  c.set('language', language)
  c.header('Content-Language', language)
  
  await next()
}

const definition: MiddlewareDefinition = {
  name: 'request-language',
  handler: setRequestLanguage,
  order: 70,
}

export default definition


