import { env } from '../config/env.js'
import { signCustomerToken } from '../lib/customer-jwt.js'

const BREVO_EMAIL_API_URL = 'https://api.brevo.com/v3/smtp/email'
const DEFAULT_SENDER_NAME = 'Collectra'

type CsvImportedDebtEmailInput = {
  toEmail: string
  fullName: string
  campaignName: string
  campaignId?: string
  amount: number
  dueDate: Date
  debtId: string
}

type SendBulkResult = {
  attempted: number
  sent: number
  failed: number
  skipped: number
  sentDebtIds: string[]
}

export class BrevoEmailService {
  private readonly apiKey = env.BREVO_API_KEY
  private readonly senderEmail = env.BREVO_SENDER_EMAIL
  private readonly senderName = env.BREVO_SENDER_NAME || DEFAULT_SENDER_NAME

  isConfigured() {
    return Boolean(this.apiKey && this.senderEmail)
  }

  async sendCsvImportedDebtEmails(payloads: CsvImportedDebtEmailInput[]): Promise<SendBulkResult> {
    if (!payloads.length) {
      return {
        attempted: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
        sentDebtIds: [],
      }
    }

    if (!this.isConfigured()) {
      return {
        attempted: 0,
        sent: 0,
        failed: 0,
        skipped: payloads.length,
        sentDebtIds: [],
      }
    }

    const results = await runWithConcurrency(payloads, 8, async (payload) => {
      try {
        const ok = await this.sendOne(payload)
        return {
          debtId: payload.debtId,
          ok,
        }
      } catch {
        return {
          debtId: payload.debtId,
          ok: false,
        }
      }
    })

    const sentDebtIds = results.filter((value) => value.ok).map((value) => value.debtId)
    const sent = sentDebtIds.length
    const failed = results.length - sent

    return {
      attempted: payloads.length,
      sent,
      failed,
      skipped: 0,
      sentDebtIds,
    }
  }

  private async sendOne(payload: CsvImportedDebtEmailInput): Promise<boolean> {
    if (!this.apiKey || !this.senderEmail) {
      return false
    }

    const displayName = payload.fullName.trim() || 'Customer'

    let debtLink: string | null = null
    try {
      if (env.WEB_URL) {
        const { token } = await signCustomerToken(payload.debtId)
        debtLink = `${env.WEB_URL.replace(/\/$/, '')}/client/view?token=${encodeURIComponent(token)}`
      }
    } catch {
      // If token signing fails, still send a plain notification email.
      debtLink = null
    }

    const dueDateText = payload.dueDate.toISOString().slice(0, 10)
    const amountText = formatCurrency(payload.amount)
    const safeName = escapeHtml(displayName)
    const safeCampaignName = escapeHtml(payload.campaignName)

    const htmlContent = debtLink
      ? [
          `<p>Hello ${safeName},</p>`,
          `<p>A debt item related to you was imported into campaign <strong>${safeCampaignName}</strong>.</p>`,
          `<p><strong>Amount:</strong> ${amountText}<br/><strong>Due date:</strong> ${dueDateText}</p>`,
          `<p>You can review it securely using this link:</p>`,
          `<p><a href="${escapeHtml(debtLink)}">Open your secure debt page</a></p>`,
          '<p>If you were not expecting this message, please contact support.</p>',
        ].join('')
      : [
          `<p>Hello ${safeName},</p>`,
          `<p>A debt item related to you was imported into campaign <strong>${safeCampaignName}</strong>.</p>`,
          `<p><strong>Amount:</strong> ${amountText}<br/><strong>Due date:</strong> ${dueDateText}</p>`,
          '<p>If you were not expecting this message, please contact support.</p>',
        ].join('')

    const textContent = debtLink
      ? [
          `Hello ${displayName},`,
          '',
          `A debt item related to you was imported into campaign ${payload.campaignName}.`,
          `Amount: ${amountText}`,
          `Due date: ${dueDateText}`,
          '',
          `Secure link: ${debtLink}`,
          '',
          'If you were not expecting this message, please contact support.',
        ].join('\n')
      : [
          `Hello ${displayName},`,
          '',
          `A debt item related to you was imported into campaign ${payload.campaignName}.`,
          `Amount: ${amountText}`,
          `Due date: ${dueDateText}`,
          '',
          'If you were not expecting this message, please contact support.',
        ].join('\n')

    try {
      const response = await fetch(BREVO_EMAIL_API_URL, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'api-key': this.apiKey,
        },
        body: JSON.stringify({
          sender: {
            email: this.senderEmail,
            name: this.senderName,
          },
          to: [{ email: payload.toEmail, name: displayName }],
          tags: ['collectra', `debt:${payload.debtId}`, ...(payload.campaignId ? [`campaign:${payload.campaignId}`] : [])],
          headers: {
            'X-Mailin-custom': [
              `debt_id=${payload.debtId}`,
              ...(payload.campaignId ? [`campaign_id=${payload.campaignId}`] : []),
            ].join('|'),
          },
          subject: 'Collectra - Debt Notification',
          htmlContent,
          textContent,
        }),
      })

      return response.ok
    } catch {
      return false
    }
  }
}

function formatCurrency(amount: number): string {
  return Number(amount).toFixed(2)
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

async function runWithConcurrency<T, TResult>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<TResult>
): Promise<TResult[]> {
  const safeConcurrency = Math.max(1, Math.floor(concurrency))
  const results: TResult[] = new Array(items.length)

  let cursor = 0

  const runNext = async (): Promise<void> => {
    const index = cursor
    cursor += 1

    if (index >= items.length) {
      return
    }

    const item = items[index]
    if (item === undefined) {
      return
    }

    results[index] = await worker(item)
    await runNext()
  }

  await Promise.all(Array.from({ length: Math.min(safeConcurrency, items.length) }, () => runNext()))

  return results
}
