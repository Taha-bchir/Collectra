# Stripe Checkout Flow

This document explains the current Stripe payment lifecycle implemented in Collectra, with a strong focus on how the debt amount is extracted and converted for Stripe.

## 1. High-Level Flow

1. Customer opens the public debt page with a signed token (`/client/view?token=...`).
2. Frontend fetches debt details from API.
3. Customer may optionally submit a promise date.
4. Backend stores the promise date when it is provided.
5. Customer clicks **Pay now securely**.
6. Frontend calls API to create a Stripe Checkout session for the unpaid debt.
7. Backend extracts debt amount from DB and sends Stripe Checkout session request.
8. Frontend redirects browser to Stripe Checkout URL.
9. Customer pays on Stripe-hosted page.
10. Stripe sends webhook (`checkout.session.completed`) to API.
11. API verifies signature, marks debt as `PAID`, marks active promises as `KEPT`, and writes `PAYMENT_CONFIRMED` action history.

## 2. Token-Based Debt Resolution

The public flow is token-based (no user login required).

- API resolves the debt from the JWT token in `DebtsService.getByCustomerToken(token)`.
- The token contains `debtId` (`sub` claim), and expiration is enforced by JWT `exp`.

This method is the root of all later operations: promise creation and Stripe checkout session creation.

## 3. Promise Date Is Optional For Stripe Payment

Stripe checkout no longer depends on the promise-date flow.

- UI shows Stripe payment button for any debt that is not `PAID`.
- Backend allows `createStripeCheckoutSessionByCustomerToken` as long as the debt is unpaid and the amount is valid.
- The promise date remains a separate action for reminders and the fake/demo payment flow.

### Promise Date Validation Logic

In `createPromiseByCustomerToken`:

- Incoming date is normalized to UTC day start.
- `today` comparison uses UTC day start.
- Due date comparison uses end-of-day UTC (`23:59:59.999`).

This avoids timezone errors where selecting "today" could be mistakenly treated as "past".

The payment path does not repeat this gate for Stripe checkout. Only the fake/demo payment path still requires `PROMISE_TO_PAY` and an arrived promise date.

## 4. How Debt Amount Is Extracted

### Source of Truth

Debt amount comes from database field `debt.amount` (`Decimal` from Prisma).

In `createStripeCheckoutSessionByCustomerToken(token)`:

```ts
const amount = debt.amount.toNumber()
if (!Number.isFinite(amount) || amount <= 0) {
  throw new HTTPException(400, {
    message: 'Debt amount is invalid for Stripe payment',
  })
}
```

### Why this check exists

- `Number.isFinite(amount)` blocks invalid values (`NaN`, `Infinity`).
- `amount <= 0` blocks zero/negative payments.

## 5. How Amount Is Converted for Stripe

Stripe `unit_amount` must be in the **smallest currency unit** (for USD: cents).

Amount conversion:

```ts
const unitAmount = Math.round(amount * 100)
```

Example:

- Debt amount in DB: `152.37`
- Stripe `unit_amount`: `15237`

So mathematically:

$$
\text{unitAmount} = \text{round}(\text{amount} \times 100)
$$

Currency is loaded from env via `getStripeCurrency()`:

- `STRIPE_CURRENCY` if provided
- fallback: `usd`

## 6. Checkout Session Creation

The backend creates one-line-item checkout session:

- `mode: 'payment'`
- `price_data.currency = currency`
- `price_data.unit_amount = unitAmount`
- `quantity = 1`
- `customer_email = debt.client.email` (if available)

The session includes metadata for traceability:

- `debtId`
- `customerId`
- `source: 'public_link'`

Metadata is set on both:

- checkout session (`metadata`)
- payment intent (`payment_intent_data.metadata`)

This is crucial for webhook-side debt mapping.

## 7. Success/Cancel Redirect URLs

Session uses backend-generated URLs:

- success: `${WEB_URL}/client/view?token=...&payment=success`
- cancel: `${WEB_URL}/client/view?token=...&payment=cancelled`

Important:

- Redirect does **not** confirm payment in DB.
- Only webhook confirmation changes debt status to `PAID`.

## 8. Frontend Behavior

Frontend service call:

- `POST /api/v1/public/debts/{token}/stripe/checkout-session`

On success:

```ts
window.location.assign(session.checkoutUrl)
```

If API fails:

- error toast displayed
- inline feedback shown

The page shows the payment section for any debt that is not `PAID`.
The promise date card remains available as an optional action.

## 9. Webhook Confirmation (Source of Truth)

Endpoint:

- `POST /api/v1/webhooks/stripe/events`

### Steps

1. Validate `STRIPE_WEBHOOK_SECRET` is configured.
2. Read `stripe-signature` header.
3. Verify signature with `stripe.webhooks.constructEvent(rawBody, signature, secret)`.
4. Process only `checkout.session.completed`.
5. Read `session.metadata.debtId`.
6. Call `confirmStripePaymentByDebtId`.

### Database updates in `confirmStripePaymentByDebtId`

Inside a transaction:

- Load debt by `debtId`.
- If debt already `PAID`, return (idempotent behavior).
- Update debt status to `PAID`.
- Update active promises for that debt to `KEPT`.
- Insert `customerActionHistory` with `PAYMENT_CONFIRMED` and Stripe metadata:
  - event id/type
  - session id
  - payment intent id
  - amount total
  - currency
  - livemode

This provides auditable payment history.

## 10. What Happens If Something Is Wrong

### Promise request returns 400

The promise-date action can fail validation, but Stripe checkout still works for unpaid debts that do not rely on a promise date.

### Session creation fails

Frontend shows error and does not redirect to Stripe.

Common causes:

- `STRIPE_SECRET_KEY` missing/invalid
- invalid debt amount
- Stripe could not build a checkout session for the current debt currency

### Webhook fails

Customer may complete payment on Stripe but debt remains unpaid in your DB.

Common causes:

- webhook endpoint not reachable
- wrong `STRIPE_WEBHOOK_SECRET`
- missing `debtId` metadata

## 11. Required Environment Variables

API side:

- `STRIPE_SECRET_KEY` (required)
- `STRIPE_WEBHOOK_SECRET` (required for confirmation)
- `STRIPE_CURRENCY` (optional, defaults to `usd`)
- `WEB_URL` (required for success/cancel redirect generation)

Web side:

- `NEXT_PUBLIC_ENABLE_STRIPE_PAYMENT=true`
- `NEXT_PUBLIC_API_URL=http://localhost:3000` (or your API URL)

## 12. Key Files Involved

Backend:

- `apps/api/src/services/debts.ts`
- `apps/api/src/lib/stripe.ts`
- `apps/api/src/routes/v1/public-debts/actions.ts`
- `apps/api/src/routes/v1/webhooks/stripe/actions.ts`

Frontend:

- `apps/web/features/public-debts/services/public-debts-service.ts`
- `apps/web/app/(public)/client/view/page.tsx`
- `apps/web/app/layout.tsx`

## 13. Practical Test Checklist

1. Start API and web.
2. Start Stripe CLI forwarding to webhook endpoint.
3. Open valid customer token link.
4. Submit promise date.
5. Click Pay now securely.
6. Complete payment with Stripe test card.
7. Verify:
   - webhook received
   - debt status changed to `PAID`
   - action history includes `PAYMENT_CONFIRMED` with Stripe metadata.
