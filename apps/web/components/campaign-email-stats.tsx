'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Mail, MousePointer, RefreshCw, Zap } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  getCampaignEmailStats,
  syncCampaignBrevoLogs,
  type CampaignEmailStats,
} from '@/features/campaigns/services/campaign-service'

interface CampaignEmailStatsProps {
  campaignId: string
}

const AUTO_REFRESH_MS = 8000
const REQUEST_TIMEOUT_MS = 12000

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(message))
    }, timeoutMs)

    promise
      .then((value) => {
        window.clearTimeout(timer)
        resolve(value)
      })
      .catch((error) => {
        window.clearTimeout(timer)
        reject(error)
      })
  })
}

export function CampaignEmailStatsCard({ campaignId }: CampaignEmailStatsProps) {
  const [stats, setStats] = useState<CampaignEmailStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlightRef = useRef(false)
  const aliveRef = useRef(true)
  const requestSeqRef = useRef(0)

  useEffect(() => {
    aliveRef.current = true

    return () => {
      aliveRef.current = false
    }
  }, [])

  const fetchStats = useCallback(
    async ({ initial = false, withSync = false }: { initial?: boolean; withSync?: boolean } = {}) => {
      if (inFlightRef.current) {
        return
      }

      inFlightRef.current = true
      const seq = ++requestSeqRef.current

      if (initial) {
        setLoading(true)
      } else {
        setRefreshing(true)
      }

      setError(null)

      try {
        if (withSync) {
          try {
            await withTimeout(
              syncCampaignBrevoLogs(campaignId),
              REQUEST_TIMEOUT_MS,
              'Sync request timed out'
            )
          } catch {
            // If sync is unavailable, fall back to latest local stats.
          }
        }

        const result = await withTimeout(
          getCampaignEmailStats(campaignId),
          REQUEST_TIMEOUT_MS,
          'Loading email tracking statistics timed out'
        )

        if (!aliveRef.current || seq !== requestSeqRef.current) {
          return
        }

        setStats(result)
      } catch (err) {
        if (!aliveRef.current || seq !== requestSeqRef.current) {
          return
        }

        setError(err instanceof Error ? err.message : 'Failed to load email stats')
      } finally {
        if (aliveRef.current && seq === requestSeqRef.current) {
          setLoading(false)
          setRefreshing(false)
        }
        inFlightRef.current = false
      }
    },
    [campaignId]
  )

  useEffect(() => {
    void fetchStats({ initial: true, withSync: false })

    const syncIfVisible = () => {
      if (document.visibilityState === 'visible') {
        void fetchStats({ initial: false, withSync: false })
      }
    }

    const interval = window.setInterval(syncIfVisible, AUTO_REFRESH_MS)
    window.addEventListener('focus', syncIfVisible)
    document.addEventListener('visibilitychange', syncIfVisible)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', syncIfVisible)
      document.removeEventListener('visibilitychange', syncIfVisible)
    }
  }, [fetchStats])

  const handleRefresh = async () => {
    await fetchStats({ initial: false, withSync: true })
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Email Campaign Performance</CardTitle>
          <CardDescription>Loading email tracking statistics...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-20 rounded bg-muted" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Email Campaign Performance</CardTitle>
          <CardDescription>Unable to load email statistics</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error || 'No data available'}</p>
        </CardContent>
      </Card>
    )
  }

  const clickRate =
    stats.stats.sent > 0 ? Math.round((stats.stats.clicked / stats.stats.sent) * 100) : 0

  const lastEventDate = stats.lastEventAt
    ? new Date(stats.lastEventAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'No events yet'

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Email Campaign Performance</CardTitle>
            <CardDescription>Auto-refresh every 8s (plus on focus) via Brevo tracking</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                void handleRefresh()
              }}
              className="inline-flex items-center rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
              aria-label="Refresh email stats"
            >
              <RefreshCw className={`mr-1 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <Badge variant="outline">Live Tracking</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {/* Sent */}
          <div className="space-y-2 rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium text-muted-foreground">Sent</span>
            </div>
            <div className="text-3xl font-bold">{stats.stats.sent}</div>
            <p className="text-xs text-muted-foreground">{stats.summary.uniqueDebts} unique debts</p>
          </div>

          {/* Clicked */}
          <div className="space-y-2 rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <MousePointer className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium text-muted-foreground">Clicked</span>
            </div>
            <div className="text-3xl font-bold">{stats.stats.clicked}</div>
            <p className="text-xs text-muted-foreground">{clickRate}% click rate</p>
          </div>

          {/* Other/Failed */}
          <div className="space-y-2 rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium text-muted-foreground">Other Events</span>
            </div>
            <div className="text-3xl font-bold">{stats.stats.other}</div>
            <p className="text-xs text-muted-foreground">{stats.summary.total} total events</p>
          </div>
        </div>

        {/* Summary Row */}
        <div className="mt-6 space-y-2 border-t pt-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Events</p>
              <p className="text-2xl font-bold">{stats.summary.total}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Unique Customers</p>
              <p className="text-2xl font-bold">{stats.summary.uniqueCustomers}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Last Event</p>
              <p className="text-sm font-semibold">{lastEventDate}</p>
            </div>
          </div>
        </div>

        {stats.stats.sent === 0 && (
          <div className="mt-6 rounded-lg bg-muted p-4">
            <p className="text-sm text-muted-foreground">
              📧 No emails sent yet. Import a CSV campaign to get started with email tracking.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
