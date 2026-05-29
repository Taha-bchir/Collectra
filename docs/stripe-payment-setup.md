# Stripe Checkout Setup

This setup adds real Stripe Checkout payments to the public debt page and confirms payments via Stripe webhooks.

## 1) Required Environment Variables

### API (`apps/api/.env.development` or root `.env.development`)

- `STRIPE_SECRET_KEY`: Stripe secret key (test/live depending on environment).
- `STRIPE_WEBHOOK_SECRET`: Signing secret from Stripe webhook endpoint.
- `STRIPE_CURRENCY` (optional): Currency code, default is `usd`.
- `WEB_URL`: Public web app URL used for Stripe success/cancel redirects.

### Web (`apps/web/.env.local`)

- `NEXT_PUBLIC_ENABLE_STRIPE_PAYMENT=true`
- `NEXT_PUBLIC_ENABLE_DEMO_PAYMENT=false` (recommended in non-demo environments)

## 2) Stripe Dashboard Setup

1. Go to Stripe Dashboard -> Developers -> Webhooks.
2. Add endpoint URL:
   - `https://<your-api-domain>/api/v1/webhooks/stripe/events`
3. Select event:
   - `checkout.session.completed`
4. Copy webhook signing secret and set `STRIPE_WEBHOOK_SECRET`.

## 3) Local Webhook Testing with Stripe CLI

1. Install Stripe CLI and login:
   - `stripe login`
2. Forward webhooks to local API:
   - `stripe listen --forward-to http://localhost:3000/api/v1/webhooks/stripe/events`
3. Copy the printed signing secret into `STRIPE_WEBHOOK_SECRET`.

## 4) Payment Flow

1. Debtor opens personal link: `/client/view?token=...`
2. Debtor may set a promise date if they want to commit to a future payment date.
3. Debtor clicks `Pay now securely`.
4. API creates Stripe Checkout session for any unpaid debt: `POST /api/v1/public/debts/{token}/stripe/checkout-session`.
5. Debtor completes payment on Stripe-hosted page.
6. Stripe sends `checkout.session.completed` webhook.
7. API marks debt as `PAID`, closes active promises as `KEPT`, and logs `PAYMENT_CONFIRMED` in customer action history.

Only the fake/demo payment path still requires `PROMISE_TO_PAY` and an arrived promise date.

## 5) Notes

- Payment confirmation is webhook-driven (source of truth), not redirect-driven.
- Redirect back to the app can happen before webhook processing completes.
- Keep `NEXT_PUBLIC_ENABLE_DEMO_PAYMENT=true` only for demo environments.
