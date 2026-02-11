import i18next from 'i18next'
import Backend from 'i18next-fs-backend'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import type { MiddlewareHandler } from 'hono'
import type { Env } from '../types/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Initialize i18next
await i18next.use(Backend).init({
  lng: 'en',
  fallbackLng: 'en',
  backend: {
    loadPath: join(__dirname, '../../locales/{{lng}}/{{ns}}.json'),
  },
  interpolation: {
    escapeValue: false,
  },
})

export const i18nMiddleware: MiddlewareHandler<Env> = async (c, next) => {
  const lang = c.req.header('Accept-Language')?.split(',')[0] || 'en'
  await i18next.changeLanguage(lang)
  c.set('i18n', i18next)
  await next()
}

