import { pino } from 'pino'
import { env } from '../config/env.js'

const isDevelopment = env.NODE_ENV === 'development'
const isStaging = env.NODE_ENV === 'staging'
const isProduction = env.NODE_ENV === 'production'

const level = (() => {
  if (isProduction) return 'info'
  if (isStaging) return 'info'
  return 'debug'
})()

const transport = (() => {
  if (isDevelopment) {
    return {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    }
  }
  return undefined
})()

const serializers = {
  error: (err: unknown) => {
    if (err instanceof Error) {
      return {
        type: err.name,
        message: err.message,
        stack: err.stack,
      }
    }
    return err
  },
}

export const logger = (() => {
  try {
    return pino({
      level,
      transport,
      serializers,
    })
  }
  catch (err: unknown) {
    // Defensive fallback: if a transport like `pino-pretty` isn't available in
    // the deployment (common when it's a devDependency), create a logger
    // without transport so the function doesn't crash on startup.
    const message = err && typeof err === 'object' && 'message' in err ? String((err as any).message) : ''
    if (message.includes('pino-pretty') || message.includes('unable to determine transport')) {
      return pino({ level, serializers })
    }
    // Re-throw unexpected errors so they surface during startup.
    throw err
  }
})()