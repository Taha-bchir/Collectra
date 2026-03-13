'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ApiError } from '@/lib/api-client'
import {
  getPublicDebtByToken,
  type PublicDebtView,
} from '@/features/public-debts/services/public-debts-service'

function formatDate(value: string) {
  return new Date(value).toLocaleString()
}

function formatAmount(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
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

  return (
    <div className="mx-auto w-full max-w-3xl p-4 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle>Debt Details</CardTitle>
          <CardDescription>
            Personal debt link. No signup or login required.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground">Customer</p>
                  <p className="font-medium">{debt.customer.fullName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Campaign</p>
                  <p className="font-medium">{debt.campaignName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Amount</p>
                  <p className="font-medium">{formatAmount(debt.amount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Due date</p>
                  <p className="font-medium">{formatDate(debt.dueDate)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant={getStatusVariant(debt.status)}>{debt.status}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Contact</p>
                  <p className="font-medium">{debt.customer.email || debt.customer.phone || 'N/A'}</p>
                </div>
              </div>

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
  )
}

function ClientDebtViewFallback() {
  return (
    <div className="mx-auto w-full max-w-3xl p-4 md:p-8">
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
