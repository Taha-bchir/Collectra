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

export const logger = pino({
  level,
  transport,
  // Ensure Error instances logged under the `error` key include message & stack,
  // so we see full error details and not just status codes.
  serializers: {
    error: (err) => {
      if (err instanceof Error) {
        return {
          type: err.name,
          message: err.message,
          stack: err.stack,
        }
      }
      return err
    },
  },
})