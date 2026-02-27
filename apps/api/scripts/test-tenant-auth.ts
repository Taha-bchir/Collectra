import assert from 'node:assert/strict'
import app from '../src/app.js'
import { WorkspaceRole } from '@repo/database'
import { getPrismaClient } from '../src/lib/prisma.js'
import { getSupabaseClient, getSupabaseServiceClient } from '../src/lib/supabase.js'

const prisma = getPrismaClient()
const supabase = getSupabaseClient()
const service = getSupabaseServiceClient()

const suffix = Date.now()
const email = `tenant-test-${suffix}@example.com`
const password = `Tenant!${suffix}Aa`

let userId: string | null = null
let workspaceId: string | null = null

async function run() {
  const unauthorizedChecks: Array<[string, string, number]> = [
    ['GET', '/api/v1/customers', 401],
    ['GET', '/api/v1/debts', 401],
    ['GET', '/api/v1/test-tenant/valid', 401],
  ]

  for (const [method, path, expected] of unauthorizedChecks) {
    const res = await app.request(path, { method })
    assert.equal(res.status, expected, `${method} ${path} expected ${expected}, got ${res.status}`)
    console.log(`PASS ${method} ${path} -> ${res.status}`)
  }

  const created = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (created.error || !created.data.user) {
    throw new Error(`Failed to create test user: ${created.error?.message ?? 'unknown'}`)
  }

  userId = created.data.user.id

  await prisma.user.create({
    data: {
      id: userId,
      email,
      fullName: 'Tenant Test User',
    },
  })

  const workspace = await prisma.workspace.create({
    data: {
      name: `Tenant Test Workspace ${suffix}`,
      createdByUserId: userId,
      members: {
        create: {
          userId,
          role: WorkspaceRole.OWNER,
        },
      },
    },
    select: { id: true },
  })

  workspaceId = workspace.id

  const signedIn = await supabase.auth.signInWithPassword({ email, password })
  if (signedIn.error || !signedIn.data.session?.access_token) {
    throw new Error(`Failed to sign in test user: ${signedIn.error?.message ?? 'unknown'}`)
  }

  const accessToken = signedIn.data.session.access_token

  const authorizedChecks: Array<[string, string, number, Record<string, string>]> = [
    ['GET', '/api/v1/customers', 200, { Authorization: `Bearer ${accessToken}` }],
    ['GET', '/api/v1/debts', 200, { Authorization: `Bearer ${accessToken}` }],
  ]

  for (const [method, path, expected, headers] of authorizedChecks) {
    const res = await app.request(path, { method, headers })
    assert.equal(res.status, expected, `${method} ${path} expected ${expected}, got ${res.status}`)
    console.log(`PASS ${method} ${path} -> ${res.status}`)
  }
}

run()
  .then(() => {
    console.log('Tenant auth smoke test passed')
  })
  .catch((error) => {
    console.error('Tenant auth smoke test failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    if (workspaceId) {
      await prisma.workspace.deleteMany({ where: { id: workspaceId } })
    }

    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } })
      await service.auth.admin.deleteUser(userId)
    }

    await prisma.$disconnect()
  })
