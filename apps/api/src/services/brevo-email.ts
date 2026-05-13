import { env } from '../config/env.js'
import { signCustomerToken } from '../lib/customer-jwt.js'
import { logger } from '../utils/logger.js'
import { resolvePublicWebUrl } from '../utils/public-url.js'

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
      const { token } = await signCustomerToken(payload.debtId)
      const baseUrl = resolvePublicWebUrl()
      debtLink = `${baseUrl}/client/view?token=${encodeURIComponent(token)}`
    } catch {
      // If token signing fails, still send a plain notification email.
      debtLink = null
    }

    const dueDateText = payload.dueDate.toISOString().slice(0, 10)
    const amountText = formatCurrency(payload.amount)
    const safeName = escapeHtml(displayName)
    const safeCampaignName = escapeHtml(payload.campaignName)
    const htmlContent = buildProfessionalDebtEmailHtml({
      customerName: safeName,
      campaignName: safeCampaignName,
      amountText,
      dueDateText,
      debtLink,
      openPixelUrl: buildEmailOpenPixelUrl(payload.debtId),
      senderName: this.senderName,
    })

    const textContent = buildProfessionalDebtEmailText({
      customerName: displayName,
      campaignName: payload.campaignName,
      amountText,
      dueDateText,
      debtLink,
      senderName: this.senderName,
    })

    const body = {
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
      subject: `Collectra | New debt notice for ${payload.campaignName}`,
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

function buildProfessionalDebtEmailHtml(input: {
  customerName: string
  campaignName: string
  amountText: string
  dueDateText: string
  debtLink: string | null
  openPixelUrl: string
  senderName: string
}): string {
  const ctaBlock = input.debtLink
    ? `
      <tr>
        <td style="padding: 28px 40px 12px 40px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
            <tr>
              <td align="center" bgcolor="#6d241f" style="border-radius: 999px;">
                <a href="${escapeHtml(input.debtLink)}" style="display: inline-block; padding: 14px 24px; font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: 700; color: #ffffff; text-decoration: none;">
                  Open secure debt page
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    : `
      <tr>
        <td style="padding: 28px 40px 12px 40px; text-align: center;">
          <div style="display: inline-block; padding: 12px 18px; border-radius: 999px; background: #f0e8e1; color: #6d241f; font-family: Arial, Helvetica, sans-serif; font-size: 13px; font-weight: 700;">
            Secure link is being prepared
          </div>
        </td>
      </tr>`

  const secureLinkRow = input.debtLink
    ? `<tr><td style="padding: 0 40px 8px 40px; font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.6; color: #6b5f58; text-align: center;">If the button does not work, copy and paste this link:<br/><a href="${escapeHtml(input.debtLink)}" style="color: #6d241f; word-break: break-word;">${escapeHtml(input.debtLink)}</a></td></tr>`
    : `<tr><td style="padding: 0 40px 8px 40px; font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.6; color: #6b5f58; text-align: center;">A secure customer link could not be generated automatically. Please contact support if this persists.</td></tr>`

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <title>Collectra debt notice</title>
  </head>
  <body style="margin:0; padding:0; background:#f6f1e8;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">A new debt notice is ready for ${escapeHtml(input.customerName)} in ${escapeHtml(input.campaignName)}.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f6f1e8; padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px; background:#fffaf4; border:1px solid #eadfce; border-radius:24px; overflow:hidden; box-shadow:0 12px 28px rgba(64, 37, 29, 0.08);">
            <tr>
              <td style="background:linear-gradient(135deg, #6d241f 0%, #8f4338 60%, #a85f4e 100%); padding:32px 40px; color:#ffffff; font-family: Arial, Helvetica, sans-serif;">
                <div style="font-size:12px; letter-spacing:0.18em; text-transform:uppercase; opacity:0.82;">${escapeHtml(input.senderName)}</div>
                <div style="margin-top:10px; font-size:28px; line-height:1.1; font-weight:700;">New debt notice</div>
                <div style="margin-top:10px; font-size:14px; line-height:1.7; max-width:520px; opacity:0.96;">A new customer debt has been imported and is ready for secure review.</div>
              </td>
            </tr>
            <tr>
              <td style="padding: 36px 40px 0 40px; font-family: Arial, Helvetica, sans-serif; color:#302722;">
                <div style="font-size:16px; line-height:1.7;">Hello <strong>${input.customerName}</strong>,</div>
                <div style="margin-top:14px; font-size:15px; line-height:1.8; color:#4e423b;">A debt item related to you was imported into campaign <strong>${input.campaignName}</strong>.</div>
              </td>
            </tr>
            <tr>
              <td style="padding: 24px 40px 0 40px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate; border-spacing:0; background:#fdf8f2; border:1px solid #eadfce; border-radius:20px;">
                  <tr>
                    <td style="padding:20px 22px; font-family: Arial, Helvetica, sans-serif;">
                      <div style="font-size:12px; letter-spacing:0.12em; text-transform:uppercase; color:#7a6e64; font-weight:700;">Summary</div>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:14px;">
                        <tr>
                          <td style="padding:10px 0; color:#5f534b; font-size:14px;">Amount</td>
                          <td align="right" style="padding:10px 0; color:#2f241e; font-size:15px; font-weight:700;">${escapeHtml(input.amountText)}</td>
                        </tr>
                        <tr>
                          <td style="padding:10px 0; color:#5f534b; font-size:14px; border-top:1px solid #eadfce;">Due date</td>
                          <td align="right" style="padding:10px 0; color:#2f241e; font-size:15px; font-weight:700; border-top:1px solid #eadfce;">${escapeHtml(input.dueDateText)}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            ${ctaBlock}
            ${secureLinkRow}
            <tr>
              <td style="padding: 22px 40px 12px 40px; font-family: Arial, Helvetica, sans-serif; color:#5f534b; font-size:13px; line-height:1.7; text-align:center;">
                If you were not expecting this message, please contact support.
              </td>
            </tr>
            <tr>
              <td style="padding: 0 40px 34px 40px; font-family: Arial, Helvetica, sans-serif; color:#8b7f75; font-size:12px; line-height:1.6; text-align:center;">
                Sent by ${escapeHtml(input.senderName)} for secure debt review.
              </td>
            </tr>
          </table>
          <img src="${escapeHtml(input.openPixelUrl)}" alt="" width="1" height="1" style="display:block; opacity:0; overflow:hidden; border:0; width:1px; height:1px;" />
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function buildProfessionalDebtEmailText(input: {
  customerName: string
  campaignName: string
  amountText: string
  dueDateText: string
  debtLink: string | null
  senderName: string
}): string {
  const lines = [
    `${input.senderName} - New debt notice`,
    '',
    `Hello ${input.customerName},`,
    '',
    `A debt item related to you was imported into campaign ${input.campaignName}.`,
    `Amount: ${input.amountText}`,
    `Due date: ${input.dueDateText}`,
  ]

  if (input.debtLink) {
    lines.push('', `Secure link: ${input.debtLink}`)
  }

  lines.push('', 'If you were not expecting this message, please contact support.')
  return lines.join('\n')
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
  const base = resolvePublicApiUrl()
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
