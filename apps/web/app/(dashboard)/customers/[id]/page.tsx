'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Copy, ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  ApiError,
  type CustomerDebtTracking,
  type CustomerDetails,
  type CustomerTrackingStatus,
  getCustomerById,
  getDebtPersonalLink,
  getCustomerTracking,
} from '@/features/customers/services/customer-service'

function formatDateTime(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString()
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return error.message
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

function getTrackingVariant(status: CustomerTrackingStatus) {
  if (status === 'CLICKED') return 'default'
  if (status === 'SPAM') return 'destructive'
  return 'outline'
}

function getTrackingLabel(status: CustomerTrackingStatus) {
  if (status === 'CLICKED') return 'Clicked'
  if (status === 'SPAM') return 'Spam complaint'
  return 'Sent'
}

function SummaryCard({ title, value, hint }: { title: string; value: string | number; hint?: string }) {
  return (
    <Card className="border border-border/60">
      <CardContent className="pt-5">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
        <div className="mt-2 text-2xl font-semibold">{value}</div>
        {hint ? <CardDescription className="text-xs mt-1">{hint}</CardDescription> : null}
      </CardContent>
    </Card>
  )
}

function formatActionLabel(actionType: string) {
  return actionType
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function DebtTrackingCard({
  debt,
  isLinkBusy,
  onCopyLink,
  onOpenLink,
}: {
  debt: CustomerDebtTracking
  isLinkBusy: boolean
  onCopyLink: (debtId: string) => Promise<void>
  onOpenLink: (debtId: string) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const displayedEvents = expanded ? debt.events : debt.events.slice(0, 5)

  return (
    <Card className="border border-border/60">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">{debt.campaignName}</CardTitle>
            <CardDescription className="text-xs">Last event: {formatDateTime(debt.lastEventAt)}</CardDescription>
          </div>
          <Badge variant={getTrackingVariant(debt.status)}>{getTrackingLabel(debt.status)}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          <div className="rounded-md bg-muted/40 p-2">
            <p className="text-[11px] text-muted-foreground uppercase">Sent</p>
            <p className="font-semibold">{debt.sentCount}</p>
          </div>
          <div className="rounded-md bg-muted/40 p-2">
            <p className="text-[11px] text-muted-foreground uppercase">Clicked</p>
            <p className="font-semibold">{debt.clickedCount}</p>
          </div>
          <div className="rounded-md bg-muted/40 p-2">
            <p className="text-[11px] text-muted-foreground uppercase">Visits</p>
            <p className="font-semibold">{debt.publicLinkVisitCount}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {debt.deliveredCount > 0 ? <Badge variant="outline">Delivered: {debt.deliveredCount}</Badge> : null}
          {debt.spamCount > 0 ? <Badge variant="destructive">Spam: {debt.spamCount}</Badge> : null}
          {debt.bouncedCount > 0 ? <Badge variant="destructive">Bounced: {debt.bouncedCount}</Badge> : null}
          {debt.unsubscribedCount > 0 ? <Badge variant="secondary">Unsubscribed: {debt.unsubscribedCount}</Badge> : null}
          {debt.lastSeenAt ? <Badge variant="outline">Last seen: {formatDateTime(debt.lastSeenAt)}</Badge> : null}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recent events</p>
          {displayedEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No communication events yet.</p>
          ) : (
            <div className="space-y-2">
              {displayedEvents.map((event) => (
                <div key={event.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
                  <div>
                    <p className="text-sm font-medium">{formatActionLabel(event.actionType)}</p>
                    <p className="text-xs text-muted-foreground">{event.eventName || event.channel || 'No details'}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{formatDateTime(event.timestamp)}</p>
                </div>
              ))}
            </div>
          )}

          {debt.events.length > 5 ? (
            <Button variant="ghost" size="sm" onClick={() => setExpanded((prev) => !prev)}>
              {expanded ? 'Show fewer events' : `Show all events (${debt.events.length})`}
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={() => void onCopyLink(debt.debtId)} disabled={isLinkBusy}>
            {isLinkBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Copy className="mr-1.5 h-4 w-4" />
                Copy link
              </>
            )}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void onOpenLink(debt.debtId)} disabled={isLinkBusy}>
            <ExternalLink className="mr-1.5 h-4 w-4" />
            Open link
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function CustomerTrackingPage() {
  const SYNC_INTERVAL_MS = 8000
  const params = useParams<{ id: string }>()
  const customerId = Array.isArray(params.id) ? params.id[0] : params.id

  const [customer, setCustomer] = useState<CustomerDetails | null>(null)
  const [tracking, setTracking] = useState<Awaited<ReturnType<typeof getCustomerTracking>> | null>(null)
  const [linkLoadingDebtId, setLinkLoadingDebtId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'ALL' | CustomerTrackingStatus>('ALL')
  const [campaignFilter, setCampaignFilter] = useState<string>('NONE')
  const [loading, setLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const syncingRef = useRef(false)

  const handleCopyPersonalLink = async (debtId: string) => {
    setLinkLoadingDebtId(debtId)

    try {
      const result = await getDebtPersonalLink(debtId)
      await navigator.clipboard.writeText(result.link)
      toast.success('Personal link copied')
    } catch (nextError) {
      toast.error(getErrorMessage(nextError, 'Failed to copy personal link'))
    } finally {
      setLinkLoadingDebtId(null)
    }
  }

  const handleOpenPersonalLink = async (debtId: string) => {
    setLinkLoadingDebtId(debtId)

    try {
      const result = await getDebtPersonalLink(debtId)
      window.open(result.link, '_blank', 'noopener,noreferrer')
      toast.success('Personal link opened')
    } catch (nextError) {
      toast.error(getErrorMessage(nextError, 'Failed to open personal link'))
    } finally {
      setLinkLoadingDebtId(null)
    }
  }

  const syncData = useCallback(
    async (initialLoad = false) => {
      if (!customerId || syncingRef.current) {
        return
      }

      syncingRef.current = true

      if (initialLoad) {
        setLoading(true)
      } else {
        setIsSyncing(true)
      }

      try {
        const [customerData, trackingData] = await Promise.all([
          getCustomerById(customerId),
          getCustomerTracking(customerId),
        ])

        setCustomer(customerData)
        setTracking(trackingData)
        setError(null)
      } catch (nextError) {
        if (initialLoad) {
          setError(getErrorMessage(nextError, 'Failed to load customer tracking'))
        }
      } finally {
        syncingRef.current = false
        if (initialLoad) {
          setLoading(false)
        } else {
          setIsSyncing(false)
        }
      }
    },
    [customerId],
  )

  useEffect(() => {
    if (!customerId) return

    void syncData(true)

    const syncIfVisible = () => {
      if (document.visibilityState === 'visible') {
        void syncData(false)
      }
    }

    const interval = window.setInterval(syncIfVisible, SYNC_INTERVAL_MS)
    window.addEventListener('focus', syncIfVisible)
    document.addEventListener('visibilitychange', syncIfVisible)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', syncIfVisible)
      document.removeEventListener('visibilitychange', syncIfVisible)
    }
  }, [SYNC_INTERVAL_MS, customerId, syncData])

  const sortedDebts = useMemo(() => {
    if (!tracking) return []
    return [...tracking.debts].sort((a, b) => {
      const aTs = a.lastEventAt ? new Date(a.lastEventAt).getTime() : 0
      const bTs = b.lastEventAt ? new Date(b.lastEventAt).getTime() : 0
      return bTs - aTs
    })
  }, [tracking])

  const filteredDebts = useMemo(() => {
    if (campaignFilter === 'NONE') {
      return []
    }

    const byCampaign = sortedDebts.filter((debt) => debt.campaignId === campaignFilter)

    if (statusFilter === 'ALL') {
      return byCampaign
    }

    return byCampaign.filter((debt) => debt.status === statusFilter)
  }, [campaignFilter, sortedDebts, statusFilter])

  const campaignOptions = useMemo(() => {
    const seen = new Set<string>()
    const options: Array<{ id: string; name: string }> = []

    for (const debt of sortedDebts) {
      if (seen.has(debt.campaignId)) {
        continue
      }

      seen.add(debt.campaignId)
      options.push({ id: debt.campaignId, name: debt.campaignName })
    }

    return options
  }, [sortedDebts])

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8 overflow-auto">
      <div className="flex items-center gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/customers">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to customers
          </Link>
        </Button>
      </div>

      {loading ? (
        <Card className="border border-border/60">
          <CardContent className="py-8">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading customer tracking...
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle>Unable to load tracking</CardTitle>
            <CardDescription className="text-destructive">{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : customer && tracking ? (
        <>
          <Card className="border border-border/60">
            <CardHeader>
              <CardTitle className="text-xl">{customer.fullName}</CardTitle>
              <CardDescription>
                {customer.email || '-'} {customer.phone ? `| ${customer.phone}` : ''}
              </CardDescription>
              <CardDescription>
                {isSyncing ? 'Syncing latest activity...' : 'Live sync enabled (auto refresh every 8s)'}
              </CardDescription>
            </CardHeader>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard title="Total Debts" value={tracking.summary.totalDebts} />
            <SummaryCard title="In Progress" value={tracking.summary.sentDebts} hint="Non-paid debts" />
            <SummaryCard title="Clicked" value={tracking.summary.clickedCount} />
            <SummaryCard title="Last Activity" value={formatDateTime(tracking.summary.lastEventAt)} />
          </div>

          <Card className="border border-border/60">
            <CardContent className="pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Debt tracking timeline</p>
                  <p className="text-xs text-muted-foreground">Select a campaign first, then filter by tracking status.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={campaignFilter} onValueChange={setCampaignFilter}>
                    <SelectTrigger className="w-56">
                      <SelectValue placeholder="Select campaign" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Select campaign</SelectItem>
                      {campaignOptions.map((campaign) => (
                        <SelectItem key={campaign.id} value={campaign.id}>
                          {campaign.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'ALL' | CustomerTrackingStatus)}>
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder="Filter status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All statuses</SelectItem>
                      <SelectItem value="CLICKED">Clicked</SelectItem>
                      <SelectItem value="SENT">Sent</SelectItem>
                      <SelectItem value="SPAM">Spam complaint</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {campaignFilter === 'NONE' ? (
              <Card className="border border-border/60">
                <CardContent className="py-6 text-sm text-muted-foreground">
                  Choose a campaign to view tracking records.
                </CardContent>
              </Card>
            ) : filteredDebts.length === 0 ? (
              <Card className="border border-border/60">
                <CardContent className="py-6 text-sm text-muted-foreground">
                  No debt tracking records found for this filter.
                </CardContent>
              </Card>
            ) : (
              filteredDebts.map((debt) => (
                <DebtTrackingCard
                  key={debt.debtId}
                  debt={debt}
                  isLinkBusy={linkLoadingDebtId === debt.debtId}
                  onCopyLink={handleCopyPersonalLink}
                  onOpenLink={handleOpenPersonalLink}
                />
              ))
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
