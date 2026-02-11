import type { Context } from 'hono'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PrismaClient } from '@repo/database'
import type { i18n } from 'i18next'
import type { Database } from '@repo/types'

export interface Env {
  Variables: {
    supabase: SupabaseClient<Database>
    prisma: PrismaClient
    i18n?: i18n
    language?: string
    requestId?: string
    user?: {
      id: string
      email?: string
      role?: Database["public"]["Enums"]["UserRole"]
    }
  }
}

export type AppContext = Context<Env>

export type { Database, Tables, TablesInsert, TablesUpdate, Enums, CompositeTypes } from '@repo/types'

