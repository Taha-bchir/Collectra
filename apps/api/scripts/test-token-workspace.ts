import assert from 'node:assert/strict'
import { brotliDecompressSync, gunzipSync, inflateSync } from 'node:zlib'
import app from '../src/app.js'
import { WorkspaceRole } from '@repo/database'
import { getPrismaClient } from '../src/lib/prisma.js'
import { getSupabaseClient, getSupabaseServiceClient } from '../src/lib/supabase.js'

const prisma = getPrismaClient()
const supabase = getSupabaseClient()
const service = getSupabaseServiceClient()

const suffix = Date.now()
const email = `token-workspace-test-${suffix}@example.com`
const password = `TokenWorkspace!${suffix}Aa`

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const identityEncodingHeader = {
  'Accept-Encoding': 'identity',
}

let userId: string | null = null
const workspaceIds: string[] = []

function cookieFromSetCookie(setCookie: string | null): string {
  if (!setCookie) {
    throw new Error('Expected Set-Cookie header but none was returned')
  }
  return setCookie.split(';')[0]
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const encoding = response.headers.get('content-encoding')?.toLowerCase() ?? ''
  const raw = Buffer.from(await response.arrayBuffer())

  const decoded = encoding.includes('br')
    ? brotliDecompressSync(raw)
    : encoding.includes('gzip')
      ? gunzipSync(raw)
      : encoding.includes('deflate')
        ? inflateSync(raw)
        : raw

  const text = decoded.toString('utf8')

  try {
    return JSON.parse(text) as T
  } catch (error) {
    throw new Error(
      `Failed to parse JSON response (status ${response.status}, encoding ${encoding || 'none'}): ${error instanceof Error ? error.message : 'unknown error'}. Body preview: ${text.slice(0, 250)}`
    )
  }
}

async function createWorkspaceFixture(workspaceName: string, ownerId: string) {
  const workspace = await prisma.workspace.create({
    data: {
      name: workspaceName,
      createdByUserId: ownerId,
      members: {
        create: {
          userId: ownerId,
          role: WorkspaceRole.OWNER,
        },
      },
    },
    select: { id: true },
  })

  const campaign = await prisma.campaign.create({
    data: {
      workspaceId: workspace.id,
      name: `${workspaceName} Campaign`,
    },
    select: { id: true },
  })

  const client = await prisma.client.create({
    data: {
      workspaceId: workspace.id,
      fullName: `${workspaceName} Client`,
      email: `${workspaceName.replace(/\s+/g, '-').toLowerCase()}@example.com`,
    },
    select: { id: true },
  })

  const debt = await prisma.debtRecord.create({
    data: {
      campaignId: campaign.id,
      clientId: client.id,
      amount: 100,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    select: { id: true },
  })

  workspaceIds.push(workspace.id)

  return {
    workspaceId: workspace.id,
    debtId: debt.id,
  }
}

async function run() {
  const unauthorizedTokenCheck = await app.request('/api/v1/debts/00000000-0000-0000-0000-000000000000/personal-link')
  assert.equal(unauthorizedTokenCheck.status, 401)
  console.log(`PASS GET /api/v1/debts/{id}/personal-link unauthorized -> ${unauthorizedTokenCheck.status}`)

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
      fullName: 'Token Workspace Test User',
    },
  })

  const fixtureA = await createWorkspaceFixture(`Token Workspace A ${suffix}`, userId)
  const fixtureB = await createWorkspaceFixture(`Token Workspace B ${suffix}`, userId)

  const signedIn = await supabase.auth.signInWithPassword({ email, password })
  if (signedIn.error || !signedIn.data.session?.access_token) {
    throw new Error(`Failed to sign in test user: ${signedIn.error?.message ?? 'unknown'}`)
  }

  const accessToken = signedIn.data.session.access_token

  const setWorkspaceAResponse = await app.request('/api/v1/workspaces/current', {
    method: 'POST',
    headers: {
      ...identityEncodingHeader,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ workspaceId: fixtureA.workspaceId }),
  })
  assert.equal(setWorkspaceAResponse.status, 200)
  const workspaceACookie = cookieFromSetCookie(setWorkspaceAResponse.headers.get('set-cookie'))
  console.log(`PASS POST /api/v1/workspaces/current (A) -> ${setWorkspaceAResponse.status}`)

  const debtsInAResponse = await app.request('/api/v1/debts', {
    headers: {
      ...identityEncodingHeader,
      Authorization: `Bearer ${accessToken}`,
      Cookie: workspaceACookie,
    },
  })
  assert.equal(debtsInAResponse.status, 200)
  const debtsInAJson = await parseJsonResponse<{ data: Array<{ id: string }> }>(debtsInAResponse)
  const debtIdsInA = debtsInAJson.data.map((entry) => entry.id)
  assert.ok(debtIdsInA.includes(fixtureA.debtId), 'Workspace A debt should be visible')
  assert.ok(!debtIdsInA.includes(fixtureB.debtId), 'Workspace B debt should not be visible while in A')
  console.log('PASS GET /api/v1/debts scoped to workspace A')

  const tokenAResponse1 = await app.request(`/api/v1/debts/${fixtureA.debtId}/personal-link`, {
    headers: {
      ...identityEncodingHeader,
      Authorization: `Bearer ${accessToken}`,
      Cookie: workspaceACookie,
    },
  })
  assert.equal(tokenAResponse1.status, 200)
  const tokenAJson1 = await parseJsonResponse<{
    data: { link: string; token: string; expiresAt: string | null }
  }>(tokenAResponse1)
  assert.match(tokenAJson1.data.token, uuidPattern)
  assert.ok(tokenAJson1.data.link.includes(`token=${tokenAJson1.data.token}`))
  assert.ok(tokenAJson1.data.expiresAt, 'Token expiry should be present')
  console.log('PASS GET /api/v1/debts/{id}/personal-link returns valid token/link for workspace A')

  const tokenAResponse2 = await app.request(`/api/v1/debts/${fixtureA.debtId}/personal-link`, {
    headers: {
      ...identityEncodingHeader,
      Authorization: `Bearer ${accessToken}`,
      Cookie: workspaceACookie,
    },
  })
  assert.equal(tokenAResponse2.status, 200)
  const tokenAJson2 = await parseJsonResponse<{
    data: { link: string; token: string; expiresAt: string | null }
  }>(tokenAResponse2)
  assert.equal(tokenAJson2.data.token, tokenAJson1.data.token)
  console.log('PASS personal-link token is stable across repeated calls for same debt')

  const setWorkspaceBResponse = await app.request('/api/v1/workspaces/current', {
    method: 'POST',
    headers: {
      ...identityEncodingHeader,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Cookie: workspaceACookie,
    },
    body: JSON.stringify({ workspaceId: fixtureB.workspaceId }),
  })
  assert.equal(setWorkspaceBResponse.status, 200)
  const workspaceBCookie = cookieFromSetCookie(setWorkspaceBResponse.headers.get('set-cookie'))
  console.log(`PASS POST /api/v1/workspaces/current (B) -> ${setWorkspaceBResponse.status}`)

  const debtsInBResponse = await app.request('/api/v1/debts', {
    headers: {
      ...identityEncodingHeader,
      Authorization: `Bearer ${accessToken}`,
      Cookie: workspaceBCookie,
    },
  })
  assert.equal(debtsInBResponse.status, 200)
  const debtsInBJson = await parseJsonResponse<{ data: Array<{ id: string }> }>(debtsInBResponse)
  const debtIdsInB = debtsInBJson.data.map((entry) => entry.id)
  assert.ok(debtIdsInB.includes(fixtureB.debtId), 'Workspace B debt should be visible')
  assert.ok(!debtIdsInB.includes(fixtureA.debtId), 'Workspace A debt should not be visible while in B')
  console.log('PASS GET /api/v1/debts scoped to workspace B after backend workspace switch')

  const forbiddenCrossWorkspaceToken = await app.request(`/api/v1/debts/${fixtureA.debtId}/personal-link`, {
    headers: {
      ...identityEncodingHeader,
      Authorization: `Bearer ${accessToken}`,
      Cookie: workspaceBCookie,
    },
  })
  assert.equal(forbiddenCrossWorkspaceToken.status, 404)
  console.log('PASS cross-workspace personal-link access is blocked (404)')

  const tokenBResponse = await app.request(`/api/v1/debts/${fixtureB.debtId}/personal-link`, {
    headers: {
      ...identityEncodingHeader,
      Authorization: `Bearer ${accessToken}`,
      Cookie: workspaceBCookie,
    },
  })
  assert.equal(tokenBResponse.status, 200)
  const tokenBJson = await parseJsonResponse<{
    data: { link: string; token: string; expiresAt: string | null }
  }>(tokenBResponse)
  assert.match(tokenBJson.data.token, uuidPattern)
  assert.ok(tokenBJson.data.link.includes(`token=${tokenBJson.data.token}`))
  console.log('PASS workspace B personal-link token generation works')
}

run()
  .then(() => {
    console.log('Token + workspace smoke test passed')
  })
  .catch((error) => {
    console.error('Token + workspace smoke test failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    if (workspaceIds.length > 0) {
      await prisma.workspace.deleteMany({ where: { id: { in: workspaceIds } } })
    }

    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } })
      await service.auth.admin.deleteUser(userId)
    }

    await prisma.$disconnect()
  })
