# Payment Confirmation and Invoice Access

This document explains how Collectra verifies that a debt is truly paid before:

1. allowing invoice access
2. sending the invoice email

The checks happen at both route level and service level.

## 1. Main Rule

Invoice is only available after debt status is `PAID`.

Route-level guard (public invoice endpoint):

- File: `apps/api/src/routes/v1/public-debts/actions.ts`
- Endpoint: `GET /api/v1/public/debts/{token}/invoice`
- Check:
  - resolve debt from token
  - if `debt.status !== 'PAID'`, return HTTP 400 with:
    - `Invoice is only available after payment confirmation`

This prevents any unpaid debt from getting invoice access.

## 2. How Debt Becomes PAID

A debt is marked as `PAID` only inside payment confirmation flows in `DebtsService`.

### A) Fake/Demo payment flow

- File: `apps/api/src/services/debts.ts`
- Method: `confirmFakePaymentByCustomerToken(token)`

Checks before payment confirmation:

1. Debt must be `PROMISE_TO_PAY`.
2. If promise date exists, today must be on/after promise date.

Then inside a DB transaction:

1. update debt status to `PAID`
2. set `invoiceNumber` if missing
3. mark active promises as `KEPT`
4. write `PAYMENT_CONFIRMED` action history

Only after that transaction succeeds, invoice creation/email is attempted.

### B) Stripe payment confirmation flow

- File: `apps/api/src/services/debts.ts`
- Method: `confirmStripePaymentByDebtId(debtId, input)`

The method is idempotent and safe for retries.

Key checks:

1. Load debt; if not found, stop.
2. If already `PAID`, return early.
3. In transaction, set:
   - `status = 'PAID'`
   - `pendingStripeSessionId = null`
   - `invoiceNumber` (prefer Stripe invoice number, else generated fallback)
4. Mark active payment promises as `KEPT`.
5. Write `PAYMENT_CONFIRMED` action history with Stripe metadata.

Result: the debt reaches `PAID` exactly once, even if webhook/verify calls repeat.

## 3. Extra Verification Path for Stripe

- File: `apps/api/src/routes/v1/public-debts/actions.ts`
- Endpoint: `GET /api/v1/public/debts/{token}/verify-payment`

If `session_id` is provided, the API checks Stripe session/payment intent status directly.

If Stripe reports paid (`payment_status = paid` or intent `succeeded`):

1. API calls `confirmStripePaymentByDebtId(...)`
2. API reloads debt status from DB
3. API returns `isPaid: true` only when DB status is `PAID`

This ensures UI confirmation is based on persisted backend state, not only front-end assumptions.

## 4. Invoice Creation Is Also Payment-Aware

Invoice route behavior (`/{token}/invoice`):

1. Verify token and load debt.
2. Require `debt.status === 'PAID'`.
3. Read the latest payment-confirmation Stripe invoice metadata when available.
4. Create/reuse Stripe invoice only if the stored metadata does not already contain a Stripe URL.
5. Redirect to hosted invoice URL or PDF URL.

Even if someone has a valid token, invoice cannot be opened before payment confirmation.

## 5. Invoice Email Is Sent Only After Confirmation

Invoice email sending happens after payment confirmation logic, not before.

### Fake payment path

In `confirmFakePaymentByCustomerToken`:

1. first transaction sets `PAID`
2. then Stripe invoice is created/reused
3. then invoice email is sent

### Stripe payment path

In `confirmStripePaymentByDebtId`:

1. first transaction sets `PAID`
2. email is sent only if:
   - updated status is `PAID`
   - customer has email
   - invoice email not already logged
   - debt was not already paid before

This avoids duplicate invoice emails and avoids sending invoice email for unpaid debt.

## 6. Why This Is Safe

The system has multiple safety layers:

1. Status guard at invoice endpoint (`PAID` required).
2. Transactional status update before side effects.
3. Idempotent Stripe confirmation (safe for duplicate webhook/verify calls).
4. Duplicate-email prevention via event log check.
5. Error isolation: email failure is logged but does not revert confirmed payment.

So the invoice access/email always depends on confirmed payment state in the database.
