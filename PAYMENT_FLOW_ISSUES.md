# Payment Flow Analysis - Critical Issues Found

## Issue 1: ⚠️ **CRITICAL** - Debt Status Not Reloaded After Payment Success

### Location
[apps/web/app/(public)/client/view/page.tsx](apps/web/app/(public)/client/view/page.tsx#L31)

### The Problem
After a customer completes payment on Stripe, they're redirected back to:
```
/client/view?token=...&payment=success
```

However, **the frontend never reloads the debt data** to get the updated status. This means:

1. Frontend initially loads debt with status `PROMISE_TO_PAY`
2. Customer clicks "Pay now" → redirected to Stripe
3. Payment succeeds → Stripe webhook marks debt as `PAID` in database
4. Customer redirected back to `/client/view?token=...&payment=success`
5. **Frontend still shows status as `PROMISE_TO_PAY`** (not reloaded!)
6. **Payment button is still visible** because condition is: `debt.status !== 'PROMISE_TO_PAY'` is FALSE
7. **Customer can click "Pay now" again → creates another payment!**

### Code Evidence

**Frontend** (`page.tsx` lines ~31-66):
```tsx
useEffect(() => {
  void loadDebt()
}, [token])  // Only loads once on mount with token

// Later (lines ~80-100):
useEffect(() => {
  if (paymentStatus === 'success') {
    setInlineFeedback('Payment submitted successfully. We are confirming it now.')
    return  // ❌ NEVER reloads debt!
  }

  if (paymentStatus === 'cancelled') {
    setInlineFeedback('Payment was cancelled. You can try again when ready.')
  }
}, [paymentStatus])
```

**Payment button visibility** (`page.tsx` line ~189):
```tsx
{debt.status === 'PROMISE_TO_PAY' && (
  <Button onClick={handleStripePayment}>
    Pay now securely
  </Button>
)}
```

### Why This Happens
1. The `loadDebt()` function is only triggered by `token` changes
2. When returning from Stripe, `token` doesn't change → `loadDebt()` not called again
3. Only `paymentStatus` changes, but there's no reload triggered by this

## Issue 2: ⚠️ No Polling or Real-Time Status Check After Payment

### The Problem
There's a delay between:
1. Stripe webhook confirms payment (marks debt as `PAID`)
2. Frontend receives `payment=success` redirect
3. **No mechanism to wait for or verify the webhook was processed**

The documentation acknowledges this:
> "Redirect back to the app can happen before webhook processing completes."

But there's **no retry logic, polling, or status verification**.

### Code Evidence

From [docs/STRIPE_PAYMENT_SETUP_2026-04-24.md](docs/STRIPE_PAYMENT_SETUP_2026-04-24.md):
> "Payment confirmation is webhook-driven (source of truth), not redirect-driven.
> Redirect back to the app can happen before webhook processing completes."

## Issue 3: Missing Stripe Checkout Session Status Verification

### The Problem
No endpoint exists to verify a Stripe checkout session status. You only rely on webhooks.

If a webhook fails silently, there's no way to:
- Check the payment status
- Retry confirmation
- Detect issues

## Recommended Fixes

### Fix 1: Reload Debt After Payment Success (HIGH PRIORITY)

```tsx
useEffect(() => {
  if (paymentStatus === 'success') {
    setInlineFeedback('Payment submitted successfully. We are confirming it now.')
    // ✅ RELOAD THE DEBT TO GET UPDATED STATUS
    void loadDebt()
    return
  }

  if (paymentStatus === 'cancelled') {
    setInlineFeedback('Payment was cancelled. You can try again when ready.')
  }
}, [paymentStatus])
```

### Fix 2: Add Polling After Payment Success (MEDIUM PRIORITY)

Implement a polling mechanism that checks the debt status every 2-3 seconds after payment success:

```tsx
useEffect(() => {
  if (paymentStatus !== 'success') return

  setInlineFeedback('Payment submitted successfully. We are confirming it now.')
  
  // Poll for updated status
  let pollCount = 0
  const maxPolls = 10 // Poll for ~30 seconds (10 * 3 seconds)
  
  const pollInterval = setInterval(async () => {
    pollCount++
    
    try {
      const updated = await getPublicDebtByToken(token)
      if (updated.status === 'PAID') {
        setDebt(updated)
        setInlineFeedback('✓ Payment confirmed successfully!')
        clearInterval(pollInterval)
        return
      }
    } catch (error) {
      console.warn('Polling error:', error)
    }
    
    if (pollCount >= maxPolls) {
      clearInterval(pollInterval)
      setInlineFeedback('Payment is being processed. Please refresh to confirm.')
    }
  }, 3000) // Poll every 3 seconds
  
  return () => clearInterval(pollInterval)
}, [paymentStatus, token])
```

### Fix 3: Add Stripe Session Status Endpoint (LOW PRIORITY)

Create an endpoint to verify Stripe checkout session status:

```ts
// In apps/api/src/routes/v1/public-debts/actions.ts

handler.openapi(
  verifyStripeSessionByTokenSchema,
  withRouteTryCatch('publicDebts.verifyStripeSessionByToken', async (c) => {
    const { token, sessionId } = c.req.valid('param')
    
    const service = new DebtsService(c.get('prisma'))
    const { debt } = await service.getByCustomerToken(token)
    
    const stripe = getStripeClient()
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    
    return c.json({
      data: {
        sessionId: session.id,
        paymentStatus: session.payment_status, // 'paid', 'unpaid', 'no_payment_required'
        debtStatus: debt.status,
      },
    })
  })
)
```

## Impact Assessment

**Severity**: 🔴 **CRITICAL** - This is a duplicate payment vulnerability

**How User Experiences It**:
1. Opens debt link
2. Sets promise date → status becomes `PROMISE_TO_PAY`
3. Clicks "Pay now" → goes to Stripe
4. Pays successfully
5. Redirected back to page showing "Payment submitted"
6. **Sees the debt page with payment button STILL VISIBLE**
7. Clicks "Pay now" again → creates another Stripe session for the same debt
8. Pays again (if not caught by Stripe fraud detection)

**Result**: Multiple payments for single debt, customer confused, support burden

## Security Notes

The webhook handler has proper idempotency:
```ts
if (debt.status === 'PAID') {
  return debt  // ✅ Prevents duplicate confirmation in DB
}
```

But the **frontend bypasses this** by allowing duplicate payment initiation.

## Files Affected

1. [apps/web/app/(public)/client/view/page.tsx](apps/web/app/(public)/client/view/page.tsx) - Fix #1, #2
2. [apps/api/src/routes/v1/public-debts/actions.ts](apps/api/src/routes/v1/public-debts/actions.ts) - Fix #3
3. [apps/web/features/public-debts/services/public-debts-service.ts](apps/web/features/public-debts/services/public-debts-service.ts) - Add verification endpoint call

## Recommendation Priority

1. **FIX 1** (Reload on success) - 5 minutes, solves the issue completely
2. **FIX 2** (Polling) - 15 minutes, adds robustness
3. **FIX 3** (Status endpoint) - 20 minutes, adds verification layer
