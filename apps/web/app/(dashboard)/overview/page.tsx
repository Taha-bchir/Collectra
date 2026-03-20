'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { ApiError, getDashboardStats } from '@/features/overview/services/overview-stats-service'
import type { DashboardDebtStatusCounts, DashboardStats } from '@/features/overview/types'
import { listCampaigns, type CampaignSummary } from '@/features/campaigns/services/campaign-service'
import { strings } from '@/lib/strings'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Activity,
  Bell,
  CheckCircle2,
  CircleCheck,
  Clock3,
  Loader2,
  TriangleAlert,
} from 'lucide-react'

const ALL_CAMPAIGNS_VALUE = 'all'

const STATUS_CARD_CONFIG: Array<{
  key: keyof DashboardDebtStatusCounts
  label: string
  description: string
  icon: typeof Activity
}> = [
  {
    key: 'IMPORTED',
    label: 'Imported',
    description: 'Debts imported and awaiting first contact',
    icon: Clock3,
  },
  {
    key: 'NOTIFIED',
    label: 'Notified',
    description: 'Debts with notification already sent',
    icon: Bell,
  },
  {
    key: 'PROMISE_TO_PAY',
    label: 'Promise to pay',
    description: 'Debts currently in a promise state',
    icon: CheckCircle2,
  },
  {
    key: 'PAID',
    label: 'Paid',
    description: 'Debts marked as paid',
    icon: CircleCheck,
  },
  {
    key: 'OVERDUE_AFTER_PROMISE',
    label: 'Overdue after promise',
    description: 'Promises that became overdue',
    icon: TriangleAlert,
  },
]

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return error.message
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

function formatMoney(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString()
}

function getStatusBadgeProps(status: keyof DashboardDebtStatusCounts) {
  if (status === 'PAID') {
    return {
      variant: 'outline' as const,
      className: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-300',
      label: 'Healthy',
    }
  }

  if (status === 'PROMISE_TO_PAY') {
    return {
      variant: 'secondary' as const,
      className: '',
      label: 'In progress',
    }
  }

  if (status === 'OVERDUE_AFTER_PROMISE') {
    return {
      variant: 'destructive' as const,
      className: '',
      label: 'Needs action',
    }
  }

  if (status === 'NOTIFIED') {
    return {
      variant: 'outline' as const,
      className: 'border-blue-500/40 text-blue-700 dark:text-blue-300',
      label: 'Contacted',
    }
  }

  return {
    variant: 'outline' as const,
    className: 'border-amber-500/40 text-amber-700 dark:text-amber-300',
    label: 'Pending',
  }
}

export default function OverviewPage() {
  const { profile } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([])
  const [isCampaignsLoading, setIsCampaignsLoading] = useState(true)
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(ALL_CAMPAIGNS_VALUE)

  useEffect(() => {
    let cancelled = false

    const loadCampaigns = async () => {
      setIsCampaignsLoading(true)

      try {
        const items = await listCampaigns()

        if (!cancelled) {
          setCampaigns(items)
        }
      } catch {
        if (!cancelled) {
          setCampaigns([])
        }
      } finally {
        if (!cancelled) {
          setIsCampaignsLoading(false)
        }
      }
    }

    loadCampaigns()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadStats = async () => {
      setIsLoading(true)
      setError(null)

      const campaignId =
        selectedCampaignId !== ALL_CAMPAIGNS_VALUE ? selectedCampaignId : undefined

      try {
        const nextStats = await getDashboardStats({
          campaignId,
          includeRecentCampaigns: campaignId === undefined,
          recentCampaignsLimit: 5,
        })

        if (!cancelled) {
          setStats(nextStats)
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(getErrorMessage(loadError, 'Failed to load dashboard stats'))
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    loadStats()

    return () => {
      cancelled = true
    }
  }, [selectedCampaignId])

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId]
  )

  const statusCards = useMemo(() => {
    if (!stats) {
      return []
    }

    return STATUS_CARD_CONFIG.map((item) => ({
      ...item,
      value: stats.statuses[item.key],
    }))
  }, [stats])

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8 overflow-auto">
      <div>
        <h1 className="text-3xl font-bold">{strings.dashboard_overview}</h1>
        <p className="text-muted-foreground mt-1">
          {strings.dashboard_overview_description}
        </p>
      </div>

      {profile && (
        <p className="text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{profile.email}</span>
        </p>
      )}

      <Card className="border border-border/60">
        <CardHeader className="gap-3">
          <CardTitle>Campaign scope</CardTitle>
          <CardDescription>
            Choose one campaign or keep all campaigns to view workspace-level stats.
          </CardDescription>
          <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
            <SelectTrigger className="w-full md:w-[320px]">
              <SelectValue placeholder="Select a campaign" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CAMPAIGNS_VALUE}>All campaigns</SelectItem>
              {campaigns.map((campaign) => (
                <SelectItem key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isCampaignsLoading && (
            <p className="text-xs text-muted-foreground">Loading campaigns...</p>
          )}
        </CardHeader>
      </Card>

      {isLoading ? (
        <Card className="border border-border/60">
          <CardContent className="py-10">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading dashboard stats...
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle>Unable to load stats</CardTitle>
            <CardDescription className="text-destructive">{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : stats ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {statusCards.map((stat) => {
              const Icon = stat.icon
              const badge = getStatusBadgeProps(stat.key)

              return (
                <Card key={stat.key} className="border border-border/60">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <Badge variant={badge.variant} className={badge.className}>
                      {badge.label}
                    </Badge>
                    <div className="text-2xl font-bold">{stat.value.toLocaleString()}</div>
                    <CardDescription className="text-xs">{stat.description}</CardDescription>
                  </CardContent>
                </Card>
              )
            })}

            <Card className="border border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total debts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalDebts.toLocaleString()}</div>
                <CardDescription className="text-xs">
                  {stats.scope === 'campaign' && selectedCampaign
                    ? `Within ${selectedCampaign.name}`
                    : 'Across your current workspace'}
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total overdue amount</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatMoney(stats.totalOverdueAmount)}</div>
                <CardDescription className="text-xs">
                  Sum of debts in OVERDUE_AFTER_PROMISE
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          {stats.recentCampaigns && stats.recentCampaigns.length > 0 && (
            <Card className="border border-border/60">
              <CardHeader>
                <CardTitle>Recent campaigns</CardTitle>
                <CardDescription>
                  Latest campaigns with debt, promise, and paid counts.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.recentCampaigns.map((campaign) => (
                    <div
                      key={campaign.id}
                      className="rounded-md border border-border/60 p-3 text-sm"
                    >
                      <div className="font-medium">{campaign.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Created on {formatDate(campaign.createdAt)}
                      </div>
                      <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
                        <span>Debts: {campaign.debtsCount}</span>
                        <span>Promised: {campaign.promisedCount}</span>
                        <span>Paid: {campaign.paidCount}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}

      <Card className="border border-border/60">
        <CardHeader>
          <CardTitle>Stats source</CardTitle>
          <CardDescription>
            These metrics are fetched from <code>/api/v1/stats</code> and scoped to your current
            workspace.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
