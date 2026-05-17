import path from 'node:path'
import fs from 'node:fs'
import { randomUUID } from 'node:crypto'

// Target email to test
const TARGET_EMAIL = 'tahabchir6@gmail.com'

// Minimal .env loader for the repo .env.development (avoid external deps)
const envPath = path.resolve(process.cwd(), '.env.development')
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx <= 0) continue
    let key = trimmed.slice(0, idx)
    let val = trimmed.slice(idx + 1)
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    process.env[key] = val
  }
}

// Import prisma client from the built database package
import { prisma } from '../packages/database/dist/index.js'

async function main() {
  const userId = randomUUID()
  const workspaceId = randomUUID()

  console.log('Creating test user...')
  const user = await prisma.user.create({ data: { id: userId, email: `test.reminder+${Date.now()}@example.com`, fullName: 'Test Reminder' } })

  console.log('Creating test workspace...')
  const workspace = await prisma.workspace.create({ data: { id: workspaceId, name: `Test Workspace Reminder ${Date.now()}`, createdByUserId: user.id } })

  console.log('Creating workspace member...')
  await prisma.workspaceMember.create({ data: { userId: user.id, workspaceId: workspace.id, role: 'OWNER' } })

  console.log('Creating campaign...')
  const campaign = await prisma.campaign.create({ data: { workspaceId: workspace.id, name: `Reminder Campaign ${Date.now()}`, status: 'ACTIVE' } })

  console.log('Creating client with requested email: ', TARGET_EMAIL)
  const client = await prisma.client.create({ data: { workspaceId: workspace.id, fullName: 'Reminder Client', email: TARGET_EMAIL } })

  // Promise date: tomorrow UTC midnight
  const promiseDate = new Date()
  promiseDate.setUTCDate(promiseDate.getUTCDate() + 1)
  promiseDate.setUTCHours(0, 0, 0, 0)

  // Due date: same as promiseDate for testing
  const dueDate = new Date(promiseDate)

  console.log('Creating debt (PROMISE_TO_PAY) with promiseDate =', promiseDate.toISOString())
  const debt = await prisma.debtRecord.create({
    data: {
      campaignId: campaign.id,
      clientId: client.id,
      amount: '50.00',
      dueDate,
      status: 'PROMISE_TO_PAY',
      promiseDate,
    },
  })

  console.log('Created debt id=', debt.id)
  console.log('Test debt linked to client email:', TARGET_EMAIL)
  process.exit(0)
}

main().catch((err) => {
  console.error('Error inserting test debt:', err)
  process.exit(1)
})
