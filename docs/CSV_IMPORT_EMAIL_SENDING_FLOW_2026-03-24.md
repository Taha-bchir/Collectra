# CSV Import Email Sending Flow (Brevo)

This document explains how email is sent automatically after CSV import in this project, and includes the actual code parts.

## 1. High-level flow

1. User uploads CSV from the dashboard.
2. API parses valid rows in the campaign import service.
3. For each imported row that has a valid email, the service prepares an email notification payload.
4. Database import is committed first (campaign, clients, debts).
5. After commit, API calls BrevoEmailService to send emails through Brevo API.
6. If Brevo fails, import still succeeds (email sending is non-blocking).

## 2. Where it is implemented

- CSV import and trigger: apps/api/src/services/campaigns.ts
- Email sending service: apps/api/src/services/brevo-email.ts
- Env validation/config: apps/api/src/config/env.ts

## 3. CSV import prepares email payloads

In campaign import, each row creates a debt, and if the row has email, a payload is queued for sending.

```ts
const debtEmailNotifications: Array<{
  toEmail: string
  fullName: string
  campaignName: string
  amount: number
  dueDate: Date
  debtId: string
}> = []

for (const row of parsed.rows) {
  // ... identity resolution and client/debt creation

  const debtId = randomUUID()

  debtRows.push({
    id: debtId,
    campaignId: campaign.id,
    clientId,
    amount: row.amount,
    dueDate: row.dueDate,
    status: row.status,
  })

  if (row.email) {
    debtEmailNotifications.push({
      toEmail: row.email,
      fullName: row.fullName,
      campaignName: campaign.name,
      amount: row.amount,
      dueDate: row.dueDate,
      debtId,
    })
  }
}
```

## 4. Send happens after DB transaction (non-blocking)

After the transaction returns, the code sends emails. Any exception is caught and only logged.

```ts
try {
  const emailService = new BrevoEmailService()
  const emailResult = await emailService.sendCsvImportedDebtEmails(importResult.debtEmailNotifications)

  if (emailResult.attempted > 0 || emailResult.skipped > 0) {
    logger.info(
      {
        campaignId: importResult.campaign.id,
        attempted: emailResult.attempted,
        sent: emailResult.sent,
        failed: emailResult.failed,
        skipped: emailResult.skipped,
        scope: 'campaigns.importCsv.emails',
      },
      'Completed CSV import email dispatch'
    )
  }
} catch (error) {
  logger.warn(
    {
      campaignId: importResult.campaign.id,
      error,
      scope: 'campaigns.importCsv.emails',
    },
    'CSV import completed but email dispatch failed'
  )
}
```

## 5. Brevo service code

BrevoEmailService checks configuration first. If missing, it skips sending instead of failing import.

```ts
isConfigured() {
  return Boolean(this.apiKey && this.senderEmail)
}

if (!this.isConfigured()) {
  return {
    attempted: 0,
    sent: 0,
    failed: 0,
    skipped: payloads.length,
  }
}
```

Actual Brevo API call:

```ts
const response = await fetch('https://api.brevo.com/v3/smtp/email', {
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
    subject: 'Collectra - Debt Notification',
    htmlContent,
    textContent,
  }),
})

return response.ok
```

The service also catches failures and returns false for failed sends:

```ts
try {
  // fetch(...)
  return response.ok
} catch {
  return false
}
```

## 6. Secure debt link in email

If WEB_URL is configured and token signing works, email contains a secure link:

```ts
const { token } = await signCustomerToken(payload.debtId)
debtLink = `${env.WEB_URL.replace(/\/$/, '')}/client/view?token=${encodeURIComponent(token)}`
```

If token creation fails, it still sends a plain notification email.

## 7. Required env vars

From env config:

```ts
BREVO_API_KEY: optionalString,
BREVO_SENDER_EMAIL: optionalEmail,
BREVO_SENDER_NAME: optionalString,
WEB_URL: optionalString,
```

Recommended values in .env.development:

```env
BREVO_API_KEY=your_brevo_api_key
BREVO_SENDER_EMAIL=noreply@your-domain.com
BREVO_SENDER_NAME=Collectra
WEB_URL=http://localhost:3001
```

## 8. Important behavior notes

- Email is only attempted for imported rows with an email.
- Invalid email rows are skipped during CSV parsing.
- Import success does not depend on Brevo success.
- Delivery summary is logged in API logs under scope campaigns.importCsv.emails.
