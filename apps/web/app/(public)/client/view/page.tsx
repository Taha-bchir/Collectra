'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Calendar, CircleDollarSign, Loader2, UserRound } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api-client'
import {
  createPublicFakePaymentByToken,
  createPublicPromiseByToken,
  getPublicDebtByToken,
  type PublicDebtView,
} from '@/features/public-debts/services/public-debts-service'

function formatDate(value: string) {
  return new Date(value).toLocaleString()
}

function formatAmount(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function toLocalDateInputValue(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getStatusVariant(status: PublicDebtView['status']) {
  if (status === 'PAID') return 'secondary'
  if (status === 'OVERDUE_AFTER_PROMISE') return 'destructive'
  if (status === 'PROMISE_TO_PAY') return 'default'
  return 'outline'
}

function ClientDebtViewContent() {
  const searchParams = useSearchParams()

  const token = useMemo(() => searchParams.get('token')?.trim() ?? '', [searchParams])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [debt, setDebt] = useState<PublicDebtView | null>(null)
  const [promiseDate, setPromiseDate] = useState('')
  const [submittingPromise, setSubmittingPromise] = useState(false)
  const [submittingFakePayment, setSubmittingFakePayment] = useState(false)

  useEffect(() => {
    const load = async () => {
      if (!token) {
        setError('Missing debt link token.')
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
        if (err instanceof ApiError) {
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

    load()
  }, [token])

  const minPromiseDate = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return toLocalDateInputValue(now)
  }, [])

  const maxPromiseDate = useMemo(() => {
    if (!debt) {
      return undefined
    }

    return toLocalDateInputValue(new Date(debt.dueDate))
  }, [debt])

  const handleSubmitPromiseDate = async () => {
    if (!token || !debt || !promiseDate) {
      return
    }

    setSubmittingPromise(true)

    try {
      const promisedDate = new Date(`${promiseDate}T00:00:00.000Z`).toISOString()
      const result = await createPublicPromiseByToken(token, promisedDate)

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

  const handleFakePayment = async () => {
    if (!token || !debt || debt.status !== 'PROMISE_TO_PAY') {
      return
    }

    setSubmittingFakePayment(true)

    try {
      const result = await createPublicFakePaymentByToken(token)
      setDebt((prev) => (prev ? { ...prev, status: result.status } : prev))
      toast.success('Payment recorded successfully')
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
              Personal debt link from Collectra. No signup or login required.
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
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : debt ? (
            <div className="space-y-4 text-sm">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card className="border-border/60">
                  <CardContent className="pt-5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Customer</p>
                    <p className="mt-2 font-medium flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-muted-foreground" />
                      {debt.customer.fullName}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border/60">
                  <CardContent className="pt-5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Amount</p>
                    <p className="mt-2 font-semibold text-lg flex items-center gap-2">
                      <CircleDollarSign className="h-5 w-5 text-muted-foreground" />
                      {formatAmount(debt.amount)}
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-border/60">
                  <CardContent className="pt-5">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Due date</p>
                    <p className="mt-2 font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {formatDate(debt.dueDate)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-md border border-border/60 bg-background p-4">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Campaign</p>
                  <p className="mt-2 font-medium">{debt.campaignName}</p>
                </div>
                <div className="rounded-md border border-border/60 bg-background p-4">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Contact</p>
                  <p className="mt-2 font-medium">{debt.customer.email || debt.customer.phone || 'N/A'}</p>
                </div>
                <div className="rounded-md border border-border/60 bg-background p-4">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Status</p>
                  <div className="mt-2">
                    <Badge variant={getStatusVariant(debt.status)}>{debt.status}</Badge>
                  </div>
                </div>
                <div className="rounded-md border border-border/60 bg-background p-4">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Promised date</p>
                  <p className="mt-2 font-medium">{debt.promiseDate ? formatDate(debt.promiseDate) : 'Not set'}</p>
                </div>
              </div>

              {debt.status !== 'PAID' && (
                <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-4">
                  <p className="font-medium">Choose your payment promise date</p>
                  <p className="text-xs text-muted-foreground">
                    Select a date between today and the date limit set by the manager. Dates after that limit are blocked.
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      type="date"
                      value={promiseDate}
                      onChange={(event) => setPromiseDate(event.target.value)}
                      min={minPromiseDate}
                      max={maxPromiseDate}
                      disabled={submittingPromise}
                      className="sm:max-w-xs"
                    />
                    <Button onClick={handleSubmitPromiseDate} disabled={!promiseDate || submittingPromise}>
                      {submittingPromise ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Submit promise date'
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {debt.status === 'PROMISE_TO_PAY' && (
                <div className="space-y-2 rounded-md border border-primary/20 bg-primary/5 p-4">
                  <p className="font-medium">Fake payment (demo)</p>
                  <p className="text-xs text-muted-foreground">
                    Available only after a promise to pay has been submitted.
                  </p>
                  <Button onClick={handleFakePayment} disabled={submittingFakePayment}>
                    {submittingFakePayment ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      'Pay now (fake)'
                    )}
                  </Button>
                </div>
              )}

              {debt.tokenExpiresAt && (
                <p className="text-xs text-muted-foreground">
                  Link expires at: {formatDate(debt.tokenExpiresAt)}
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
