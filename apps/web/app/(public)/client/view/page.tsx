'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Calendar as CalendarIcon, CircleDollarSign, Loader2, UserRound } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api-client'
import {
  createPublicStripeCheckoutSessionByToken,
  createPublicFakePaymentByToken,
  createPublicPromiseByToken,
  getPublicDebtByToken,
  getPublicDebtInvoiceUrl,
  verifyStripePaymentByToken,
  type PublicDebtView,
} from '@/features/public-debts/services/public-debts-service'

const ENABLE_DEMO_PAYMENT = process.env.NEXT_PUBLIC_ENABLE_DEMO_PAYMENT === 'true'
const ENABLE_STRIPE_PAYMENT = process.env.NEXT_PUBLIC_ENABLE_STRIPE_PAYMENT !== 'false'

function formatDate(value: string) {
  // Use day-month-year ordering (DD/MM/YYYY) with time, e.g. "21/05/2026, 13:45:00"
  try {
    return new Date(value).toLocaleString('en-GB')
  } catch {
    return String(value)
  }
}

function formatAmount(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function toDateInputValue(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function calendarDayStart(value: Date) {
  const d = new Date(value)
  d.setHours(0, 0, 0, 0)
  return d
}

function getStatusVariant(status: PublicDebtView['status']) {
  if (status === 'PAID') return 'secondary'
  if (status === 'OVERDUE_AFTER_PROMISE') return 'destructive'
  if (status === 'PROMISE_TO_PAY') return 'default'
  return 'outline'
}

function getStatusLabel(status: PublicDebtView['status']) {
  switch (status) {
    case 'PAID':
      return 'Paid'
    case 'OVERDUE_AFTER_PROMISE':
      return 'Overdue (after promise date)'
    case 'PROMISE_TO_PAY':
      return 'Promise to pay'
    case 'NOTIFIED':
      return 'Notified'
    case 'UNPAID':
      return 'Unpaid'
    default:
      // Fallback: make it human readable
      return String(status).replace(/_/g, ' ').toLowerCase()
  }
}

function ClientDebtViewContent() {
  const searchParams = useSearchParams()

  const token = useMemo(() => searchParams.get('token')?.trim() ?? '', [searchParams])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [debt, setDebt] = useState<PublicDebtView | null>(null)
  const [promiseDate, setPromiseDate] = useState('')
  const [promiseDatePickerOpen, setPromiseDatePickerOpen] = useState(false)
  const [submittingPromise, setSubmittingPromise] = useState(false)
  const [submittingStripePayment, setSubmittingStripePayment] = useState(false)
  const [submittingFakePayment, setSubmittingFakePayment] = useState(false)
  const [inlineFeedback, setInlineFeedback] = useState<string | null>(null)
  const paymentStatus = useMemo(() => searchParams.get('payment')?.trim() ?? '', [searchParams])
  const sessionId = useMemo(() => searchParams.get('session_id')?.trim() ?? searchParams.get('sessionId')?.trim() ?? null, [searchParams])
  const isConfirmingPayment = paymentStatus === 'success' && debt?.status !== 'PAID'
  const invoiceUrl = useMemo(() => (token ? getPublicDebtInvoiceUrl(token) : null), [token])

  const loadDebt = async () => {
    if (!token) {
      setError('Secure-link token is missing. Please use the full link from your email.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const details = await getPublicDebtByToken(token)
      setDebt(details)
      if (details.promiseDate) {
        setPromiseDate(details.promiseDate.slice(0, 10))
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('This secure link has expired. Please request a new link from your collector.')
      } else if (err instanceof ApiError) {
        setError(err.message)
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Unable to load debt details')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDebt()
  }, [token])

  useEffect(() => {
    if (!paymentStatus) return

    console.log('[Payment Status] Current payment status:', paymentStatus)

    if (paymentStatus === 'success') {
      console.log('[Payment Verification] Starting payment verification flow...')
      setInlineFeedback('Payment submitted successfully. We are confirming it now.')

      let pollInterval: NodeJS.Timeout | null = null

      // Reload debt immediately to check if payment was processed
      const verifyPayment = async () => {
        try {
          console.log('[Payment Verification] Reloading debt after payment success...')
          const updated = await verifyStripePaymentByToken(token, sessionId)
          console.log('[Payment Verification] Debt reloaded. Status:', updated.debtStatus)
          const currentDebt = await getPublicDebtByToken(token)
          setDebt(currentDebt)

          // If already paid, we're done
          if (updated.isPaid || updated.debtStatus === 'PAID') {
            console.log('[Payment Verification] Payment already confirmed as PAID!')
            setInlineFeedback('✓ Payment confirmed successfully!')
            // Remove payment query param so UI stops showing "Confirming payment..."
            try {
              const url = new URL(window.location.href)
              url.searchParams.delete('payment')
              window.history.replaceState({}, '', url.toString())
            } catch (e) {
              /* ignore */
            }
            return
          }

          console.log('[Payment Verification] Status still:', updated.debtStatus, '- Starting polling...')
          // Otherwise, poll for webhook confirmation (can take a few seconds)
          let pollCount = 0
          const maxPolls = 10 // Poll for ~30 seconds (10 × 3 seconds)

          pollInterval = setInterval(async () => {
            pollCount++
            console.log(`[Payment Verification] Poll attempt ${pollCount}/${maxPolls}`)

              try {
              const polled = await verifyStripePaymentByToken(token, sessionId)
              console.log(`[Payment Verification] Poll ${pollCount} result - Status:`, polled.debtStatus)

              if (polled.isPaid || polled.debtStatus === 'PAID') {
                console.log('[Payment Verification] SUCCESS! Debt status is now PAID')
                const refreshedDebt = await getPublicDebtByToken(token)
                setDebt(refreshedDebt)
                setInlineFeedback('✓ Payment confirmed successfully!')
                // Remove payment query so UI unblocks
                try {
                  const url = new URL(window.location.href)
                  url.searchParams.delete('payment')
                  window.history.replaceState({}, '', url.toString())
                } catch (e) {
                  /* ignore */
                }
                if (pollInterval) {
                  clearInterval(pollInterval)
                }
                return
              }
            } catch (error) {
              console.warn('[Payment Verification] Polling error:', error)
            }

            if (pollCount >= maxPolls) {
              console.warn('[Payment Verification] Polling timeout - payment may still be processing')
              if (pollInterval) {
                clearInterval(pollInterval)
              }
              setInlineFeedback('Payment is being processed. Please refresh to confirm.')
              // Clear payment query param so button is no longer stuck in confirming state
              try {
                const url = new URL(window.location.href)
                url.searchParams.delete('payment')
                window.history.replaceState({}, '', url.toString())
              } catch (e) {
                /* ignore */
              }
            }
          }, 3000) // Poll every 3 seconds
        } catch (error) {
          console.error('[Payment Verification] Failed to reload debt after payment', error)
          setInlineFeedback('Unable to verify payment status. Please refresh the page.')
        }
      }

      void verifyPayment()

      // Return proper cleanup function to clear interval on unmount
      return () => {
        if (pollInterval) {
          clearInterval(pollInterval)
          console.log('[Payment Verification] Polling interval cleared on effect cleanup')
        }
      }
    }

    if (paymentStatus === 'cancelled') {
      console.log('[Payment Status] Payment was cancelled by user')
      setInlineFeedback('Payment was cancelled. You can try again when ready.')
    }
  }, [paymentStatus, token])

  const minPromiseDateObj = useMemo(() => calendarDayStart(new Date()), [])

  const maxPromiseDateObj = useMemo(() => {
    if (!debt) return undefined
    const dueDay = calendarDayStart(new Date(debt.dueDate))
    if (dueDay.getTime() < minPromiseDateObj.getTime()) {
      return undefined
    }
    return dueDay
  }, [debt, minPromiseDateObj])

  const handleSubmitPromiseDate = async () => {
    if (!token || !debt || !promiseDate) {
      return
    }

    setSubmittingPromise(true)
    setInlineFeedback(null)

    try {
      const result = await createPublicPromiseByToken(token, promiseDate)

      setDebt((prev) =>
        prev
          ? {
              ...prev,
              status: result.status,
              promiseDate: result.promiseDate,
            }
          : prev,
      )

      toast.success('Promise date submitted successfully')
      setInlineFeedback('Promise date saved. Your collector has been notified.')
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message)
      } else if (err instanceof Error) {
        toast.error(err.message)
      } else {
        toast.error('Unable to submit promise date')
      }
    } finally {
      setSubmittingPromise(false)
    }
  }

  const handleStripePayment = async () => {
    if (!token || !debt || debt.status === 'PAID') {
      return
    }

    setSubmittingStripePayment(true)
    setInlineFeedback('Opening Stripe Checkout...')

    try {
      const session = await createPublicStripeCheckoutSessionByToken(token)
      window.location.assign(session.checkoutUrl)
    } catch (err) {
      const fallbackMessage = 'Unable to start secure payment. Please try again.'
      if (err instanceof ApiError) {
        toast.error(err.message)
        setInlineFeedback(err.message)
      } else if (err instanceof Error) {
        toast.error(err.message)
        setInlineFeedback(err.message)
      } else {
        toast.error(fallbackMessage)
        setInlineFeedback(fallbackMessage)
      }
      setSubmittingStripePayment(false)
    }
  }

  const handleFakePayment = async () => {
    if (!token || !debt || debt.status === 'PAID') {
      return
    }

    setSubmittingFakePayment(true)
    setInlineFeedback(null)

    try {
      const result = await createPublicFakePaymentByToken(token)
      setDebt((prev) => (prev ? { ...prev, status: result.status } : prev))
      toast.success('Payment recorded successfully')
      setInlineFeedback('Demo payment action completed.')
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message)
      } else if (err instanceof Error) {
        toast.error(err.message)
      } else {
        toast.error('Unable to process payment')
      }
    } finally {
      setSubmittingFakePayment(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="mx-auto w-full max-w-4xl p-4 md:p-8 space-y-4">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle>Debt Details</CardTitle>
            <CardDescription>
              Secure link from Collectra — view and act on your outstanding payment. No login required.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="border-border/60">
          <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading debt details...
            </div>
          ) : error ? (
            <div className="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              <p>{error}</p>
              <Button variant="outline" size="sm" onClick={() => void loadDebt()}>
                Retry
              </Button>
            </div>
          ) : debt ? (
            <div className="space-y-4 text-sm">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card className="border-border/60">
                  <CardContent className="pt-5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Customer</p>
                    <div className="mt-2 font-medium flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-muted-foreground" />
                      {debt.customer.fullName}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/60">
                  <CardContent className="pt-5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Amount</p>
                    <div className="mt-2 font-semibold text-lg flex items-center gap-2">
                      <CircleDollarSign className="h-5 w-5 text-muted-foreground" />
                      {formatAmount(debt.amount)}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/60">
                  <CardContent className="pt-5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Due date</p>
                    <div className="mt-2 font-medium flex items-center gap-2">
                      <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      {formatDate(debt.dueDate)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-md border border-border/60 bg-background p-4">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Workspace</p>
                  <p className="mt-2 font-medium">{debt.workspaceName ?? debt.campaignName}</p>
                </div>
                <div className="rounded-md border border-border/60 bg-background p-4">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Reference</p>
                  <p className="mt-2 font-medium">{debt.tokenExpiresAt ? `Link expires ${formatDate(debt.tokenExpiresAt)}` : 'Secure customer link'}</p>
                </div>
                <div className="rounded-md border border-border/60 bg-background p-4">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Status</p>
                  <div className="mt-2">
                    <Badge variant={getStatusVariant(debt.status)}>{getStatusLabel(debt.status)}</Badge>
                  </div>
                </div>
                <div className="rounded-md border border-border/60 bg-background p-4">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Promised date</p>
                  <p className="mt-2 font-medium">{debt.promiseDate ? formatDate(debt.promiseDate) : 'Not set'}</p>
                </div>
              </div>

              {debt.status !== 'PAID' && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card className="border-primary/20 bg-primary/5">
                    <CardHeader className="space-y-2">
                      <CardTitle className="text-lg">Pay now</CardTitle>
                      <CardDescription>
                        Settle the full amount right away with a secure online payment.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        {ENABLE_STRIPE_PAYMENT
                          ? 'You will be redirected to Stripe Checkout.'
                          : 'Online payments are currently disabled for this environment.'}
                      </p>
                      <Button
                        onClick={handleStripePayment}
                        disabled={submittingStripePayment || isConfirmingPayment || !ENABLE_STRIPE_PAYMENT}
                        className="w-full"
                      >
                        {submittingStripePayment ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Redirecting...
                          </>
                        ) : isConfirmingPayment ? (
                          'Confirming payment...'
                        ) : ENABLE_STRIPE_PAYMENT ? (
                          'Pay now securely'
                        ) : (
                          'Payments unavailable'
                        )}
                      </Button>
                      {ENABLE_DEMO_PAYMENT && (
                        <Button
                          variant="ghost"
                          onClick={handleFakePayment}
                          disabled={submittingFakePayment}
                          className="w-full"
                        >
                          {submittingFakePayment ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            'Try demo payment'
                          )}
                        </Button>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-border/60 bg-background">
                    <CardHeader className="space-y-2">
                      <CardTitle className="text-lg">Choose a promise date</CardTitle>
                      <CardDescription>
                        Pick the date you plan to pay. If the due date has not passed yet, you cannot choose a date after it.
                      </CardDescription>
                    </CardHeader>
                      <CardContent className="space-y-3">
                        <Popover open={promiseDatePickerOpen} onOpenChange={setPromiseDatePickerOpen}>
                          <PopoverTrigger asChild>
                            <Button type="button" variant="outline" className="w-full justify-start text-left font-normal" disabled={submittingPromise}>
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {promiseDate ? new Date(`${promiseDate}T00:00:00`).toLocaleDateString('en-GB') : 'Select promise date'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={promiseDate ? new Date(`${promiseDate}T00:00:00`) : undefined}
                              onSelect={(date) => {
                                if (!date) return
                                setPromiseDate(toDateInputValue(date))
                                setPromiseDatePickerOpen(false)
                              }}
                              disabled={{
                                before: minPromiseDateObj,
                                ...(maxPromiseDateObj ? { after: maxPromiseDateObj } : {}),
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>

                        <Button onClick={handleSubmitPromiseDate} disabled={!promiseDate || submittingPromise} className="w-full">
                          {submittingPromise ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            'Submit promise date'
                          )}
                        </Button>
                      </CardContent>
                  </Card>
                </div>
              )}

              {inlineFeedback ? (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
                  <div className="flex items-center justify-between gap-2">
                    <span>{inlineFeedback}</span>
                    {isConfirmingPayment && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => void loadDebt()}
                        className="text-xs"
                      >
                        Refresh Status
                      </Button>
                    )}
                  </div>
                </div>
              ) : null}

              {debt.status === 'PAID' && invoiceUrl ? (
                <div className="rounded-md border border-border/60 bg-background p-4">
                  <p className="font-medium">Payment receipt</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Your Stripe invoice is ready. Open it to view or download the PDF.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button onClick={() => window.open(invoiceUrl, '_blank', 'noopener,noreferrer')}>
                      Open Stripe invoice
                    </Button>
                    <Button variant="outline" onClick={() => window.open(invoiceUrl, '_blank', 'noopener,noreferrer')}>
                      Download PDF
                    </Button>
                  </div>
                </div>
              ) : null}

              {debt.tokenExpiresAt && (
                <p className="text-xs text-muted-foreground">
                  Link expires: {formatDate(debt.tokenExpiresAt)}
                </p>
              )}
            </div>
          ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ClientDebtViewFallback() {
  return (
    <div className="mx-auto w-full max-w-4xl p-4 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Debt Details</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Preparing page...
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function ClientDebtViewPage() {
  return (
    <Suspense fallback={<ClientDebtViewFallback />}>
      <ClientDebtViewContent />
    </Suspense>
  )
}
