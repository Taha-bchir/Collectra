import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

import app from '../src/app.js'
import { getPrismaClient } from '../src/lib/prisma.js'
import { getCampaignBrevoStats } from '../src/services/brevo-event-logs.js'
import { signCustomerToken } from '../src/lib/customer-jwt.js'
import { WorkspaceRole } from '@repo/database'

const prisma = getPrismaClient()

const userId = randomUUID()
const email = `email-tracking-test-${Date.now()}@example.com`
let workspaceId: string | null = null

async function run() {
  const user = await prisma.user.create({
    data: {
      id: userId,
      email,
      fullName: 'Email Tracking Test User',
    },
    select: { id: true },
  })

  const workspace = await prisma.workspace.create({
    data: {
      name: `Email Tracking Workspace ${Date.now()}`,
      createdByUserId: user.id,
      members: {
        create: {
          userId: user.id,
          role: WorkspaceRole.OWNER,
        },
      },
    },
    select: { id: true },
  })
  workspaceId = workspace.id

  const campaign = await prisma.campaign.create({
    data: {
      workspaceId: workspace.id,
      name: 'Email Tracking Campaign',
    },
    select: { id: true },
  })

  const client = await prisma.client.create({
    data: {
      workspaceId: workspace.id,
      fullName: 'Email Tracking Client',
      email: 'email-tracking-client@example.com',
    },
    select: { id: true },
  })

  const debt = await prisma.debtRecord.create({
    data: {
      campaignId: campaign.id,
      clientId: client.id,
      amount: 199.99,
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    },
    select: { id: true },
  })

  const beforeActions = await prisma.customerActionHistory.count({ where: { debtId: debt.id } })

  const pixelResponse = await app.request(`/api/v1/public/debts/${debt.id}/open.gif`)
  assert.equal(pixelResponse.status, 200)
  assert.equal(pixelResponse.headers.get('content-type'), 'image/gif')

  const { token } = await signCustomerToken(debt.id)
  const clickResponse = await app.request(`/api/v1/public/debts/${encodeURIComponent(token)}/track-click`, {
    method: 'POST',
  })
  assert.equal(clickResponse.status, 201)

  const afterActions = await prisma.customerActionHistory.count({ where: { debtId: debt.id } })
  assert.ok(afterActions >= beforeActions + 2, 'Expected open + click actions to be persisted')

  const stats = await getCampaignBrevoStats(prisma, campaign.id)
  assert.ok(stats.opened >= 1, 'Expected at least one opened event in campaign stats')
  assert.ok(stats.clicked >= 1, 'Expected at least one clicked event in campaign stats')

  console.log('Email tracking smoke test passed')
  console.log(
    JSON.stringify(
      {
        campaignId: campaign.id,
        stats,
      },
      null,
      2
    )
  )
}

run()
  .catch((error) => {
    console.error('Email tracking smoke test failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    try {
      if (workspaceId) {
        await prisma.workspace.delete({ where: { id: workspaceId } })
      }
    } catch {}

    try {
      await prisma.user.delete({ where: { id: userId } })
    } catch {}

    await prisma.$disconnect()
  })
