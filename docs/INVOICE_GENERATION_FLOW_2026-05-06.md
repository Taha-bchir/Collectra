# Invoice Generation Flow

This document explains how Collectra generates an invoice after a payment is confirmed.

The invoice is not created at payment start. It is created only after the system confirms that the debt is paid. That keeps the invoice consistent with the final payment state.

## 1. When the invoice is generated

Invoice generation happens after payment confirmation in two possible paths:

1. A fake/demo payment is confirmed from the public customer link.
2. A Stripe payment is confirmed by webhook or by Stripe verification during polling.

In both cases, the debt must already be in a paid state before the invoice is shown or emailed.

### Exact timing

The invoice is generated after these payment events, not before:

1. The customer finishes payment.
2. The backend confirms the payment is real or accepted.
3. The debt status is updated to `PAID`.
4. The invoice number is created or reused.
5. The invoice HTML becomes available at the public invoice endpoint.
6. The invoice email is sent with a button to open the invoice.

So the invoice is a post-payment artifact. It is not the thing that starts the payment flow.

### Two kinds of generation

There are two related meanings of “invoice generation” in this codebase:

- **Invoice state generation**: the backend stores the invoice number on the paid debt row.
- **Invoice rendering generation**: the backend renders the HTML invoice page when the customer opens the invoice URL.

That means the invoice number is created once, but the invoice HTML can be rendered many times from the same paid debt data.

### How each invoice maps to one debt

Each invoice belongs to exactly one debt record.

The chain is:

1. The customer opens a secure token link.
2. The token is resolved to a single `debtId`.
3. The payment confirmation updates only that debt row.
4. The invoice number is stored on that same debt row.
5. The invoice endpoint reads the same debt row back and renders the invoice.

So the invoice is not a shared document. It is a document derived from one debt id and one paid database row.

### Code part

```ts
const { debt } = await service.getByCustomerToken(token)

const paidDebt = await tx.debtRecord.update({
  where: { id: debt.id },
  data: ({
    status: 'PAID',
    invoiceNumber: debt.invoiceNumber ?? buildInvoiceNumber(debt.id),
  } as unknown) as Parameters<typeof tx.debtRecord.update>[0]['data'],
})
```

The same `debt.id` is used again when the invoice page is opened:

```ts
const invoiceNumber = debt.invoiceNumber ?? `INV-${debt.id.slice(0, 8).toUpperCase()}`
```

## 2. Where the invoice number comes from

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

The invoice number is also stored on the debt row in the database as `invoiceNumber` so the same reference can be reused later.

### Why we create an invoice number

We create an invoice number to give each paid debt a stable human-readable reference.

It is useful because:

- support and accounting can point to one short reference instead of a long debt id
- the same invoice can be found again later without guessing
- the invoice stays consistent across the email, the invoice page, and the database
- customers can keep the receipt for their records

### What we use it for

The invoice number is used in three main places:

1. It is stored on the paid debt record as the invoice reference.
2. It is displayed on the public invoice HTML page.
3. It is included in the invoice email subject and content.

So the invoice number is not just a label. It is the stable identifier for the receipt of one paid debt.

### Code part

```ts
function buildInvoiceNumber(debtId: string) {
  return `INV-${debtId.replace(/-/g, '').slice(0, 10).toUpperCase()}`
}
```

## 3. What happens during payment confirmation

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
5. Stores `invoiceNumber` if it does not already exist.
6. Marks active promises as `KEPT`.
7. Writes a `PAYMENT_CONFIRMED` action history record.
8. Sends the invoice email.

### Code part

```ts
const paidDebt = await tx.debtRecord.update({
  where: { id: debt.id },
  data: ({
    status: 'PAID',
    invoiceNumber: debt.invoiceNumber ?? buildInvoiceNumber(debt.id),
  } as unknown) as Parameters<typeof tx.debtRecord.update>[0]['data'],
})
```

### Stripe payment path

When Stripe confirms the payment, the service:

1. Loads the debt by id.
2. Skips the update if the debt is already `PAID`.
3. Updates the debt status to `PAID`.
4. Clears `pendingStripeSessionId`.
5. Stores `invoiceNumber` if it does not already exist.
6. Marks active promises as `KEPT`.
7. Writes a `PAYMENT_CONFIRMED` action history record with Stripe metadata.
8. Sends the invoice email.

### How this controls invoice generation

The invoice is generated from the paid debt record immediately after this transaction succeeds.

The important fields are:

- `status: 'PAID'`
- `invoiceNumber`
- `pendingStripeSessionId` cleared for Stripe payments

Because these fields are written before the email is sent, the invoice email always points to a paid debt.

### Code part

```ts
const paidDebt = await tx.debtRecord.update({
  where: { id: debt.id },
  data: ({
    status: 'PAID',
    pendingStripeSessionId: null,
    invoiceNumber: debt.invoiceNumber ?? buildInvoiceNumber(debt.id),
  } as unknown) as Parameters<typeof tx.debtRecord.update>[0]['data'],
})
```

## 4. How the invoice page is built

The public invoice endpoint is handled in [apps/api/src/routes/v1/public-debts/actions.ts](../apps/api/src/routes/v1/public-debts/actions.ts).

The route is:

- `GET /api/v1/public/debts/{token}/invoice`

### Invoice endpoint flow

1. The token is validated and resolved to a debt.
2. The endpoint rejects the request if the debt is not `PAID`.
3. The latest `PAYMENT_CONFIRMED` action is loaded from `customerActionHistory`.
4. The endpoint reads the stored `invoiceNumber`.
5. If `invoiceNumber` is missing, it falls back to a generated value from the debt id.
6. The endpoint formats the payment date, amount, customer details, and campaign details.
7. It renders a full HTML invoice page.

### How the HTML invoice is produced

The HTML is built directly in the route handler as a template string.

It uses the paid debt data plus the latest payment confirmation record:

- debt customer fields come from the debt record
- payment date comes from `PAYMENT_CONFIRMED` history when available
- Stripe session metadata is read from the stored action metadata
- invoice number comes from `debt.invoiceNumber` or a fallback based on debt id

This means the invoice page is deterministic: the same paid debt always renders the same invoice reference.

### Code part

```ts
const invoiceNumber = debt.invoiceNumber ?? `INV-${debt.id.slice(0, 8).toUpperCase()}`
const paymentDate = paymentConfirmation?.timestamp?.toISOString() ?? debt.updatedAt.toISOString()
const amount = debt.amount.toNumber().toFixed(2)
```

### What the HTML includes

The invoice HTML contains:

- invoice number
- payment date
- customer name and contact
- campaign name
- debt reference
- amount paid
- due date
- payment metadata such as Stripe session id when available
- print / save as PDF controls

## 5. How the invoice email is created

The same invoice content is also used for the email sent after payment confirmation.

The email is generated in [apps/api/src/services/debts.ts](../apps/api/src/services/debts.ts).

### Email generation flow

1. The code builds the invoice number.
2. It creates the invoice HTML.
3. It sends the HTML to Brevo through the transactional email API.
4. It logs the email event in Brevo tracking logs.

### How the email relates to invoice generation

The email does not create the invoice by itself.

Instead, the email is a delivery channel for the invoice that was already generated from the paid debt state.

The email contains:

- the invoice HTML content
- a download button linking to the public invoice URL
- invoice tracking tags so the send can be observed later

If email sending fails, the invoice still exists at the public invoice endpoint because the invoice is generated from the database state, not from the email send result.

### Code part

```ts
const invoiceDownloadUrl = `${invoiceBaseUrl}/api/v1/public/debts/${encodeURIComponent(token)}/invoice`
const invoiceHtml = generateInvoiceHtml(
  invoiceNumber,
  debt.id,
  new Date().toISOString(),
  amount,
  debt.client.fullName,
  debt.client.email ?? '',
  debt.client.phone ?? null,
  debt.campaign.name,
  debt.dueDate,
  debt.status,
  stripeSessionId,
  invoiceDownloadUrl,
)
```

```ts
await sendInvoiceEmailToBrevo({
  toEmail: debt.client.email,
  toName: debt.client.fullName,
  invoiceHtml,
  invoiceNumber,
  debtId: debt.id,
  campaignId: debt.campaign.id,
})
```

### Download button in the email

The email includes a download button that links to the invoice endpoint.

That means the customer can open the invoice in the browser and use the browser print dialog to save it as PDF.

## 6. Why the invoice is not generated earlier

The invoice is not generated when the payment session is created.

It is only generated after the payment is confirmed because:

- the invoice must reflect the final paid state
- the invoice number should not be assigned before a real payment outcome
- duplicate checkout attempts should not create duplicate invoice records

## 7. Important database fields

Two fields in [packages/database/prisma/schema.prisma](../packages/database/prisma/schema.prisma) support the invoice flow:

- `invoiceNumber`: stores the stable invoice reference
- `pendingStripeSessionId`: prevents duplicate Stripe checkout sessions

## 8. Summary

The invoice generation flow is simple:

1. Payment is confirmed.
2. The debt is marked `PAID`.
3. The system generates or reuses an invoice number.
4. The invoice HTML is rendered from the paid debt data.
5. The customer can open the invoice page or download it from the email.

The invoice is therefore a consequence of payment confirmation, not the trigger for payment itself.