'use client'

import { useEffect, useState } from 'react'
import { Mail, Eye, MousePointer, Zap } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getCampaignEmailStats, type CampaignEmailStats } from '@/features/campaigns/services/campaign-service'

interface CampaignEmailStatsProps {
  campaignId: string
}

export function CampaignEmailStatsCard({ campaignId }: CampaignEmailStatsProps) {
  const [stats, setStats] = useState<CampaignEmailStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStats() {
      setLoading(true)
      setError(null)
      try {
        const result = await getCampaignEmailStats(campaignId)
        setStats(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load email stats')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [campaignId])

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

  // Calculate open rate and click rate
  const openRate =
    stats.stats.sent > 0 ? Math.round((stats.stats.opened / stats.stats.sent) * 100) : 0
  const clickRate =
    stats.stats.opened > 0 ? Math.round((stats.stats.clicked / stats.stats.opened) * 100) : 0

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
            <CardDescription>Real-time tracking via Brevo webhooks</CardDescription>
          </div>
          <Badge variant="outline">Live Tracking</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {/* Sent */}
          <div className="space-y-2 rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium text-muted-foreground">Sent</span>
            </div>
            <div className="text-3xl font-bold">{stats.stats.sent}</div>
            <p className="text-xs text-muted-foreground">{stats.summary.uniqueDebts} unique debts</p>
          </div>

          {/* Opened */}
          <div className="space-y-2 rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-muted-foreground">Opened</span>
            </div>
            <div className="text-3xl font-bold">{stats.stats.opened}</div>
            <p className="text-xs text-muted-foreground">{openRate}% open rate</p>
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
