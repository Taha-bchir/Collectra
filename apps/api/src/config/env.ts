import { z } from 'zod'
import dotenv from 'dotenv'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../../../../')
const nodeEnv = process.env.NODE_ENV ?? 'development'
const envFile = path.join(projectRoot, `.env.${nodeEnv}`)
const fallbackEnvFile = path.join(projectRoot, '.env')

if (fs.existsSync(envFile)) {
  dotenv.config({ path: envFile })
} else if (fs.existsSync(fallbackEnvFile)) {
  dotenv.config({ path: fallbackEnvFile })
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'staging']).default('development'),
  PORT: z.string().default('3000'),
  API_URL: z.string().optional(),
  WEB_URL: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional(), // Comma-separated list of allowed origins for CORS

  // Database (Supabase via Prisma)
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),

  // Supabase (Auth/Storage usage)
  SUPABASE_URL: z.string(),
  SUPABASE_ANON_KEY: z.string(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_EMAIL_REDIRECT_URL: z.string().url().optional(),
  SUPABASE_RESET_REDIRECT_URL: z.string().url().optional(),
  SUPABASE_OAUTH_REDIRECT_URL: z.string().url().optional(),

  // Security
  JWT_SECRET: z.string().optional(),
  COOKIE_SECRET: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

function getEnv(): Env {
  try {
    return envSchema.parse(process.env)
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid environment variables:')
      error.errors.forEach((err) => {
        console.error(`  ${err.path.join('.')}: ${err.message}`)
      })
      process.exit(1)
    }
    throw error
  }
}

export const env = getEnv()
