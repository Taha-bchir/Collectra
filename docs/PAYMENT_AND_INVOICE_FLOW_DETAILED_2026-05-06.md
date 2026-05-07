# Payment and Invoice Flow - Detailed Technical Explanation

This document explains the full customer payment lifecycle in Collectra, with a focus on the invoice path and the exact code that controls each step.

The goal of the flow is not only to let a customer pay a debt, but also to make the payment path safe, idempotent, traceable, and immediately useful after payment by generating and emailing an invoice.

## 1. Main User Journey

The public payment flow starts when a customer opens a secure link and ends when the debt is marked as paid, the invoice is available, and the customer receives the receipt by email.

1. The customer opens the public debt page using a signed token link.
2. The frontend loads the debt data from the public API.
3. The customer may create a promise-to-pay date.
4. The backend validates the promise date and stores it.
5. The customer starts a payment.
6. The backend either creates a Stripe Checkout session or confirms a fake/demo payment.
7. The system prevents duplicate checkout sessions while one payment is already pending.
8. Payment confirmation is verified either by Stripe webhook or by an explicit verify call that can query Stripe directly.
9. The debt status becomes `PAID`.
10. An invoice number is generated and stored.
11. The invoice becomes available through Stripe and the public invoice endpoint redirects to the hosted invoice or PDF.
12. The customer receives an email with a button to open the Stripe invoice.

## 2. Core Code Files

The flow is spread across a small set of files:

- [apps/api/src/services/debts.ts](../apps/api/src/services/debts.ts)
- [apps/api/src/routes/v1/public-debts/actions.ts](../apps/api/src/routes/v1/public-debts/actions.ts)
- [apps/api/src/schema/v1/public-debts.schema.ts](../apps/api/src/schema/v1/public-debts.schema.ts)
- [apps/web/app/(public)/client/view/page.tsx](../apps/web/app/(public)/client/view/page.tsx)
- [apps/web/features/public-debts/services/public-debts-service.ts](../apps/web/features/public-debts/services/public-debts-service.ts)
- [packages/database/prisma/schema.prisma](../packages/database/prisma/schema.prisma)

## 3. Public Link Entry Point

Customers do not log in to see the debt. They open a signed customer token link.

The token is resolved by `DebtsService.getByCustomerToken(token)` in [apps/api/src/services/debts.ts](../apps/api/src/services/debts.ts).

The token is the root authorization mechanism for the public flow:

- it contains the debt id in the JWT `sub` claim
- it has a fixed expiration time
- it avoids storing customer tokens in the database

This means every public action depends on the token being valid and unexpired.

## 4. Promise-To-Pay Gate

Payment is not allowed until the debt is in `PROMISE_TO_PAY` status.

This gate is enforced both in the UI and on the server.

### Server-side validation

In [apps/api/src/services/debts.ts](../apps/api/src/services/debts.ts), `createPromiseByCustomerToken()` normalizes the submitted promise date to UTC day boundaries, then checks that it is not in the past and not after the due date.

The same date boundary logic is repeated in the payment paths so the customer cannot bypass the UI by calling the API directly.

### Why this matters

- It prevents payment before the agreed promise date.
- It avoids timezone bugs by comparing UTC day boundaries.
- It keeps the public UI and backend policy aligned.

## 5. Fake Payment Confirmation Path

The demo payment path is implemented in `confirmFakePaymentByCustomerToken(token)`.

Location:

- [apps/api/src/services/debts.ts](../apps/api/src/services/debts.ts)

### What it does

1. Resolves the debt from the customer token.
2. Verifies the debt is in `PROMISE_TO_PAY`.
3. Re-checks that the promise date has arrived.
4. Runs a transaction that:
   - sets the debt status to `PAID`
   - generates and stores `invoiceNumber`
   - marks active payment promises as `KEPT`
   - inserts a `PAYMENT_CONFIRMED` history record
5. After the transaction, it sends the invoice email.
6. It logs the invoice email event in `BrevoEventLog`.

### Why the email is sent after the transaction

The payment confirmation is the primary state change. The email is a side effect.

That ordering means:

- the payment does not fail just because email delivery fails
- the invoice is only sent after the debt is truly paid
- the payment path stays robust and idempotent

## 6. Stripe Checkout Session Creation

The Stripe payment start flow is implemented in `createStripeCheckoutSessionByCustomerToken(token)`.

Location:

- [apps/api/src/services/debts.ts](../apps/api/src/services/debts.ts)

### Important checks

Before the session is created, the backend checks:

- the debt is in `PROMISE_TO_PAY`
- there is no existing `pendingStripeSessionId`
- the promise date has already arrived
- the amount is valid and greater than zero

### Duplicate checkout prevention

The new `pendingStripeSessionId` field in [packages/database/prisma/schema.prisma](../packages/database/prisma/schema.prisma) is the lock that blocks duplicate sessions.

If a session already exists, the API returns a 400 error instead of creating another checkout.

### Stripe amount handling

The amount is read from Prisma as a decimal and converted to the smallest currency unit:

```ts
const amount = debt.amount.toNumber()
const unitAmount = Math.round(amount * 100)
```

This is required because Stripe expects cents, not decimal currency values.

### Redirect URLs

The Stripe success URL includes:

- the customer token
- `payment=success`
- `session_id={CHECKOUT_SESSION_ID}`

This session id is important because the frontend can verify payment status against Stripe directly if the webhook has not updated the database yet.

## 7. Stripe Verification and Idempotent Sync

The verification endpoint is implemented in [apps/api/src/routes/v1/public-debts/actions.ts](../apps/api/src/routes/v1/public-debts/actions.ts).

The route is `GET /{token}/verify-payment`.

### Why this endpoint exists

Webhooks are authoritative, but they are asynchronous. The frontend should not depend only on a delayed webhook to know whether a payment succeeded.

This endpoint can:

- read the current database status
- optionally query Stripe directly using `session_id`
- sync the DB if Stripe already reports the payment as paid

### Stripe-side verification logic

If a `session_id` is present, the endpoint retrieves the Stripe Checkout Session and expands `payment_intent`.

The payment is considered successful when either:

- `session.payment_status === 'paid'`
- `payment_intent.status === 'succeeded'`

If Stripe says the payment succeeded, the endpoint calls `confirmStripePaymentByDebtId()`.

That confirmation method is idempotent, so repeated calls are safe.

## 8. Stripe Webhook Confirmation

The Stripe webhook handler is the source of truth for final payment confirmation.

The webhook path eventually calls `confirmStripePaymentByDebtId(debtId, input)` in [apps/api/src/services/debts.ts](../apps/api/src/services/debts.ts).

### What the confirmation method updates

Inside a transaction it:

- finds the debt by id
- returns early if the debt is already `PAID`
- updates the debt to `PAID`
- clears `pendingStripeSessionId`
- writes the invoice number
- marks active promises as `KEPT`
- creates a `PAYMENT_CONFIRMED` history event with Stripe metadata

### Why this is important

This makes the operation safe to retry.

If the webhook runs twice or if verify-payment also syncs the same payment, the second call sees the debt already paid and does not double-apply the state change.

## 9. Invoice Number Generation

The invoice number is generated in [apps/api/src/services/debts.ts](../apps/api/src/services/debts.ts) using the debt id:

```ts
function buildInvoiceNumber(debtId: string) {
  return `INV-${debtId.replace(/-/g, '').slice(0, 10).toUpperCase()}`
}
```

### Why it is stable

- It is derived from the debt id.
- It stays consistent across retries.
- It does not depend on the invoice being emailed.
- It can be reused by the invoice page and by the email.

The `invoiceNumber` field is stored on the debt record and is marked unique in Prisma.

## 10. Public Invoice Endpoint

The invoice is served by `GET /{token}/invoice` in [apps/api/src/routes/v1/public-debts/actions.ts](../apps/api/src/routes/v1/public-debts/actions.ts).

### Endpoint behavior

1. Resolve the debt from the token.
2. Reject the request unless the debt status is `PAID`.
3. Load the last `PAYMENT_CONFIRMED` action from `customerActionHistory`.
4. Create or reuse the Stripe invoice for the debt.
5. Redirect the customer to the Stripe hosted invoice URL or PDF URL.

### What the invoice shows

The Stripe invoice includes:

- invoice number
- payment date
- customer and campaign details
- debt reference in Stripe metadata
- amount paid
- hosted invoice and PDF access

### Why this endpoint matters

It is the same invoice that the customer can open after payment, and it is also the destination of the new email download button.

## 11. Invoice Email Generation

The invoice email is generated from the payment confirmation path in [apps/api/src/services/debts.ts](../apps/api/src/services/debts.ts).

### Email sending helper

The helper sends the HTML email through Brevo and tags it with:

- `collectra`
- `invoice`
- `debt:{id}`
- `campaign:{id}` when available

The email subject is:

```ts
Payment Receipt - Invoice {invoiceNumber}
```

### Non-blocking behavior

Email sending is wrapped in a try/catch block.

That means:

- payment confirmation still succeeds if email delivery fails
- invoice delivery becomes a best-effort side effect
- failures are logged for later inspection

## 12. Download Button In The Email

The email now includes a button that points to the Stripe invoice URL or PDF.

This is generated in [apps/api/src/services/debts.ts](../apps/api/src/services/debts.ts) after the Stripe invoice is created or reused.

### What the button does

The button links to:

```ts
/api/v1/public/debts/{token}/invoice
```

Because the invoice endpoint redirects to Stripe, the customer can use the button to open the invoice in Stripe and save or print the PDF.

### Why this is better than attaching a file

- The endpoint always reflects the latest Stripe invoice state.
- There is no need to generate and store binary attachments locally.
- The customer can print or save the invoice from the browser.

## 13. Frontend Post-Payment Handling

The public UI in [apps/web/app/(public)/client/view/page.tsx](../apps/web/app/(public)/client/view/page.tsx) does two important things after a payment.

### Payment confirmation polling

The page polls `verifyStripePaymentByToken(token, sessionId)` through the web service wrapper in [apps/web/features/public-debts/services/public-debts-service.ts](../apps/web/features/public-debts/services/public-debts-service.ts).

If Stripe is not yet reflected in the database, the UI can still confirm payment using the `session_id` query param.

### Query parameter cleanup

Once payment is confirmed or the polling ends, the UI removes the `payment=success` flag from the URL.

This prevents the button from getting stuck in a perpetual “Confirming payment...” state.

### Invoice access in the UI

When the debt status becomes `PAID`, the frontend shows the invoice button and opens the public invoice page in a new tab.

## 14. Database Fields That Make The Flow Work

The invoice and duplicate-prevention behavior depends on two new fields in [packages/database/prisma/schema.prisma](../packages/database/prisma/schema.prisma):

### `pendingStripeSessionId`

- stores the active Stripe checkout session id
- prevents creating more than one concurrent checkout session
- is cleared when payment is confirmed

### `invoiceNumber`

- stores the stable invoice identifier
- is unique
- is created when the debt is paid

## 15. Error Handling And Edge Cases

### Payment before promise date

The server blocks the request with HTTP 400.

### Duplicate checkout attempt

If a pending Stripe session already exists, the API rejects the second checkout request.

### Stripe webhook delay

The verify endpoint can query Stripe directly and sync the DB if needed.

### Email delivery failure

The payment stays confirmed even if Brevo fails.

### Invoice access before payment

The invoice endpoint returns HTTP 400 until the debt is marked as `PAID`.

## 16. Environment Variables Involved

The payment and invoice flow depends on these variables:

- `WEB_URL`
- `API_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_CURRENCY`
- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL`
- `BREVO_SENDER_NAME`

## 17. Practical Reading Order In Code

If you want to trace the flow directly in code, read the files in this order:

1. [apps/api/src/routes/v1/public-debts/actions.ts](../apps/api/src/routes/v1/public-debts/actions.ts)
2. [apps/api/src/services/debts.ts](../apps/api/src/services/debts.ts)
3. [apps/web/app/(public)/client/view/page.tsx](../apps/web/app/(public)/client/view/page.tsx)
4. [apps/web/features/public-debts/services/public-debts-service.ts](../apps/web/features/public-debts/services/public-debts-service.ts)
5. [packages/database/prisma/schema.prisma](../packages/database/prisma/schema.prisma)

## 18. Summary

The payment flow is designed around three ideas:

- the database is the source of truth for debt status
- Stripe is the source of truth for payment completion
- the invoice is a first-class output that is available both on the web and by email

The result is a payment system that is safer against duplicates, clearer for customers, and easier to trace in code.