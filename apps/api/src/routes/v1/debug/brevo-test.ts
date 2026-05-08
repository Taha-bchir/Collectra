import { Hono } from 'hono'
import type { Env } from '../../../types/index.js'
import { withRouteTryCatch } from '../../../utils/route-helpers.js'
import { BrevoEmailService } from '../../../services/brevo-email.js'

const handler = new Hono<Env>()

// Simple debug endpoint to send one CSV-style email and return Brevo send result
handler.post('/', withRouteTryCatch('debug.brevoSend', async (c: any) => {
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const to = (body.to as string) || (body.email as string) || ''

  const service = new BrevoEmailService()
  if (!service.isConfigured()) {
    return c.json({ ok: false, reason: 'brevo_not_configured' }, 400)
  }

  const payload = {
    toEmail: to || 'you@example.com',
    fullName: 'Debug Recipient',
    campaignName: 'Debug Campaign',
    amount: 1.23,
    dueDate: new Date(),
    debtId: `debug-${Date.now()}`,
  }

  const result = await service.sendCsvImportedDebtEmails([payload])

  return c.json({ ok: true, result }, result.sent ? 201 : 500)
}))

export default {
  path: '/api/v1/debug/brevo-test',
  handler,
}
