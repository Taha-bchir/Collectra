# Invoice Delivery Flow

This document explains how Collectra produces the invoice that customers open after payment is confirmed.

The invoice is not created at payment start. It is generated only after the debt has been confirmed as paid, so the invoice always reflects the final payment state.

## 1. When the invoice is generated

Invoice generation happens after payment confirmation in two paths:

1. A fake/demo payment is confirmed from the public customer link.
2. A Stripe payment is confirmed by webhook or by Stripe verification during polling.

In both cases, the debt must already be in a paid state before the invoice can be shown or emailed.

### Exact timing

The invoice becomes available after these payment events, not before:

1. The customer finishes payment.
2. The backend confirms the payment is real or accepted.
3. The debt status is updated to `PAID`.
4. The invoice number is created or reused.
5. The Stripe invoice is created or reused with the debt currency.
6. The public invoice endpoint redirects to the Stripe hosted invoice or PDF URL.
7. The invoice email is sent with a button to open the Stripe invoice.

So the invoice is a post-payment artifact. It is not the thing that starts the payment flow.

## 2. Two related meanings of invoice generation

There are two related meanings of “invoice generation” in this codebase:

- **Invoice state generation**: the backend stores the invoice number on the paid debt row.
- **Invoice delivery generation**: the backend exposes the Stripe-hosted invoice URL or PDF URL to the customer.

The invoice number is created once, but the Stripe invoice can be reopened many times from the same paid debt data.

## 3. How each invoice maps to one debt

Each invoice belongs to exactly one debt record.

The chain is:

1. The customer opens a secure token link.
2. The token is resolved to a single `debtId`.
3. The payment confirmation updates only that debt row.
4. The invoice number is stored on that same debt row.
5. The invoice endpoint reads the same debt row back and redirects to the Stripe invoice.

So the invoice is not a shared document. It is a document derived from one debt id and one paid database row.

## 4. Where the invoice number comes from

The invoice number is built in [apps/api/src/services/debts.ts](../apps/api/src/services/debts.ts).

The helper is:

```ts
function buildInvoiceNumber(debtId: string) {
  return `INV-${debtId.replace(/-/g, '').slice(0, 10).toUpperCase()}`
}
```

### Why this approach is used

- It is stable for the same debt.
- It does not depend on payment provider state.
- It is easy to reproduce if the invoice needs to be rendered again.
- It can be reused for Stripe-hosted invoice regeneration when the stored URL is missing.

The invoice number is also stored on the debt row in the database as `invoiceNumber` so the same reference can be reused later.

### Why we create an invoice number

We create an invoice number to give each paid debt a stable human-readable reference.

It is useful because:

- support and accounting can point to one short reference instead of a long debt id
- the same invoice can be found again later without guessing
- the invoice stays consistent across the email, the invoice page, and the database
- customers can keep the receipt for their records

## 5. What happens during payment confirmation

The main payment confirmation methods are:

- `confirmFakePaymentByCustomerToken(token)`
- `confirmStripePaymentByDebtId(debtId, input)`

Both are in [apps/api/src/services/debts.ts](../apps/api/src/services/debts.ts).

### Fake payment path

When the fake payment path runs, the service:

1. Resolves the debt from the secure customer token.
2. Checks that the debt is in `PROMISE_TO_PAY`.
3. Checks that the promise date has arrived.
4. Updates the debt status to `PAID`.
5. Creates or reuses the Stripe invoice and stores `invoiceNumber` if it does not already exist.
6. Marks active promises as `KEPT`.
7. Writes a `PAYMENT_CONFIRMED` action history record.
8. Sends the invoice email.

### Stripe payment path

When Stripe confirms the payment, the service:

1. Loads the debt by id.
2. Skips the update if the debt is already `PAID`.
3. Updates the debt status to `PAID`.
4. Clears `pendingStripeSessionId`.
5. Creates or reuses the Stripe invoice and stores `invoiceNumber` if it does not already exist.
6. Marks active promises as `KEPT`.
7. Writes a `PAYMENT_CONFIRMED` action history record with Stripe metadata.
8. Sends the invoice email.

### How this controls invoice generation

The Stripe invoice is generated from the paid debt record immediately after this transaction succeeds.

The important fields are:

- `status: 'PAID'`
- `invoiceNumber`
- `pendingStripeSessionId` cleared for Stripe payments

Because these fields are written before the email is sent, the invoice email always points to a paid debt.

## 6. How the invoice endpoint is built

The public invoice endpoint is handled in [apps/api/src/routes/v1/public-debts/actions.ts](../apps/api/src/routes/v1/public-debts/actions.ts).

The route is:

- `GET /api/v1/public/debts/{token}/invoice`

### Invoice endpoint flow

1. The token is validated and resolved to a debt.
2. The endpoint rejects the request if the debt is not `PAID`.
3. The backend reads the latest payment-confirmation Stripe invoice metadata when available.
4. If the stored metadata does not already contain a Stripe URL, the backend creates or reuses the Stripe invoice for that debt.
5. The endpoint redirects to the Stripe hosted invoice URL or PDF URL.

### Why the route does not build local HTML

The route does not render local HTML. It redirects the customer to Stripe so the invoice layout and PDF are owned by Stripe.

### What the Stripe invoice contains

The Stripe invoice contains:

- invoice number
- payment date
- customer and campaign details
- debt reference in Stripe metadata
- amount paid
- hosted invoice and PDF access

## 7. How the invoice email is created

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

## 8. Download button in the email

The email includes a button that links to the invoice endpoint.

Because the invoice endpoint redirects to Stripe, the customer can use the button to open the invoice in Stripe and save or print the PDF.

### Why this is better than attaching a file

- The endpoint always reflects the latest Stripe invoice state.
- There is no need to generate and store binary attachments locally.
- The customer can print or save the invoice from the browser.

## 9. Important Stripe details

The invoice helper in [apps/api/src/services/debts.ts](../apps/api/src/services/debts.ts) now follows Stripe's invoice rules more strictly:

- the invoice currency comes from the debt currency
- the invoice idempotency key includes the currency
- `days_until_due` is set to a positive value for `send_invoice`
- invoice items are created in the same currency as the invoice

This prevents Stripe from rejecting mixed-currency invoice items and keeps the hosted invoice URL available after payment.

## 10. Why the invoice is not generated earlier

The invoice is not generated when the payment session is created.

It is only generated after the payment is confirmed because:

- the invoice must reflect the final paid state
- the invoice number should not be assigned before a real payment outcome
- duplicate checkout attempts should not create duplicate invoice records
- Stripe-hosted invoice creation depends on the paid debt currency and should not be attempted for an unpaid debt page view

## 11. Summary

The invoice generation flow is simple:

1. Payment is confirmed.
2. The debt is marked `PAID`.
3. The system generates or reuses an invoice number.
4. The system exposes the Stripe-hosted invoice URL or PDF.
5. The customer can open the invoice page or download it from the email.

The Stripe invoice is therefore a consequence of payment confirmation, not the trigger for payment itself.
