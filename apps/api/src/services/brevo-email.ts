import { env } from '../config/env.js'
import { signCustomerToken } from '../lib/customer-jwt.js'
import { logger } from '../utils/logger.js'

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
  sentMessages: Array<{
    debtId: string
    messageId: string | null
  }>
}

export class BrevoEmailService {
  private readonly apiKey = env.BREVO_API_KEY
  private readonly senderEmail = env.BREVO_SENDER_EMAIL
  private readonly senderName = env.BREVO_SENDER_NAME || DEFAULT_SENDER_NAME
  private readonly csvTemplateId = env.BREVO_CSV_TEMPLATE_ID

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
        sentMessages: [],
      }
    }

    if (!this.isConfigured()) {
      return {
        attempted: 0,
        sent: 0,
        failed: 0,
        skipped: payloads.length,
        sentDebtIds: [],
        sentMessages: [],
      }
    }

    const results = await runWithConcurrency(payloads, 8, async (payload) => {
      try {
        const result = await this.sendOne(payload)
        return {
          debtId: payload.debtId,
          ok: result.ok,
          messageId: result.messageId,
        }
      } catch {
        return {
          debtId: payload.debtId,
          ok: false,
          messageId: null,
        }
      }
    })

    const sentDebtIds = results.filter((value) => value.ok).map((value) => value.debtId)
    const sentMessages = results
      .filter((value) => value.ok)
      .map((value) => ({
        debtId: value.debtId,
        messageId: value.messageId ?? null,
      }))
    const sent = sentDebtIds.length
    const failed = results.length - sent

    return {
      attempted: payloads.length,
      sent,
      failed,
      skipped: 0,
      sentDebtIds,
      sentMessages,
    }
  }

  private async sendOne(payload: CsvImportedDebtEmailInput): Promise<{
    ok: boolean
    messageId: string | null
  }> {
    if (!this.apiKey || !this.senderEmail) {
      return { ok: false, messageId: null }
    }

    const displayName = payload.fullName.trim() || 'Customer'

    let debtLink: string | null = null
    try {
      if (env.WEB_URL) {
        const { token } = await signCustomerToken(payload.debtId)
        const baseUrl = (env.API_URL ?? env.WEB_URL ?? 'https://collectra.xyz').replace(/\/$/, '')
        debtLink = `${baseUrl}/api/v1/public/debts/${encodeURIComponent(token)}/track-click`
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
          `<img src="${escapeHtml(buildEmailOpenPixelUrl(payload.debtId))}" alt="" width="1" height="1" style="display:none;opacity:0;overflow:hidden" />`,
          '<p>If you were not expecting this message, please contact support.</p>',
        ].join('')
      : [
          `<p>Hello ${safeName},</p>`,
          `<p>A debt item related to you was imported into campaign <strong>${safeCampaignName}</strong>.</p>`,
          `<p><strong>Amount:</strong> ${amountText}<br/><strong>Due date:</strong> ${dueDateText}</p>`,
          `<img src="${escapeHtml(buildEmailOpenPixelUrl(payload.debtId))}" alt="" width="1" height="1" style="display:none;opacity:0;overflow:hidden" />`,
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

    const body = this.csvTemplateId
      ? {
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
          templateId: this.csvTemplateId,
          params: {
            customerName: displayName,
            campaignName: payload.campaignName,
            amount: amountText,
            dueDate: dueDateText,
            debtLink: debtLink,
            openPixelUrl: buildEmailOpenPixelUrl(payload.debtId),
            senderName: this.senderName,
          },
        }
      : {
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
        }

    try {
      const response = await fetch(BREVO_EMAIL_API_URL, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'api-key': this.apiKey,
        },
        body: JSON.stringify(body),
      })

      const responseText = await response.text()

      if (!response.ok) {
        logger.error(
          {
            status: response.status,
            statusText: response.statusText,
            debtId: payload.debtId,
            responseBody: truncateText(responseText),
            templateId: this.csvTemplateId,
            scope: 'BrevoEmailService.sendOne.response',
          },
          'Brevo API error while sending CSV import email',
        )
        return { ok: false, messageId: null }
      }

      let messageId: string | null = null
      try {
        const responseBody = JSON.parse(responseText) as Record<string, unknown>
        messageId = getString(responseBody.messageId) ?? getString(responseBody['message-id']) ?? getString(responseBody.message_id)
      } catch {
        messageId = null
      }

      return { ok: true, messageId }
    } catch {
      return { ok: false, messageId: null }
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

function buildEmailOpenPixelUrl(debtId: string): string {
  const origin = env.API_URL ?? env.WEB_URL ?? 'https://collectra.xyz'
  const base = origin.replace(/\/$/, '')
  return `${base}/api/v1/public/debts/${encodeURIComponent(debtId)}/open.gif`
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

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function truncateText(value: string, maxLength = 1000): string {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength)}…`
}
