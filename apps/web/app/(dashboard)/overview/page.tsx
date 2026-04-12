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
  AlertTriangle,
  Bell,
  CheckCircle2,
  CircleDollarSign,
  Folder,
  FolderOpen,
  Loader2,
  ShieldAlert,
} from 'lucide-react'

const ALL_CAMPAIGNS_VALUE = 'all'

const STATUS_CONFIG: Array<{
  key: keyof DashboardDebtStatusCounts
  label: string
  icon: typeof Bell
  tone: string
}> = [
  { key: 'IMPORTED', label: 'Imported', icon: Folder, tone: 'text-slate-400' },
  { key: 'UNPAID', label: 'Unpaid', icon: Folder, tone: 'text-amber-300' },
  { key: 'NOTIFIED', label: 'Notified', icon: Bell, tone: 'text-blue-400' },
  { key: 'PROMISE_TO_PAY', label: 'Promised', icon: CheckCircle2, tone: 'text-cyan-400' },
  { key: 'PAID', label: 'Paid', icon: CircleDollarSign, tone: 'text-emerald-400' },
  { key: 'OVERDUE_AFTER_PROMISE', label: 'Overdue', icon: ShieldAlert, tone: 'text-red-400' },
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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString()
}

function formatMoney(value: number) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function percent(value: number) {
  return `${Math.round(value)}%`
}

export default function OverviewPage() {
  const { profile } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState<string | null>(null)

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

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId],
  )

  useEffect(() => {
    let cancelled = false

    const loadStats = async () => {
      setStatsLoading(true)
      setStatsError(null)

      const campaignId =
        selectedCampaignId !== ALL_CAMPAIGNS_VALUE ? selectedCampaignId : undefined

      try {
        const result = await getDashboardStats({
          campaignId,
          includeRecentCampaigns: campaignId === undefined,
          recentCampaignsLimit: 5,
        })

        if (!cancelled) {
          setStats(result)
        }
      } catch (error) {
        if (!cancelled) {
          setStatsError(getErrorMessage(error, 'Failed to load dashboard stats'))
        }
      } finally {
        if (!cancelled) {
          setStatsLoading(false)
        }
      }
    }

    loadStats()

    return () => {
      cancelled = true
    }
  }, [selectedCampaignId])

  const totalCampaigns = useMemo(() => {
    if (selectedCampaignId === ALL_CAMPAIGNS_VALUE) {
      return campaigns.length
    }

    return selectedCampaign ? 1 : 0
  }, [campaigns.length, selectedCampaign, selectedCampaignId])

  const campaignsHealth = useMemo(() => {
    const counters = {
      active: 0,
      completed: 0,
      archived: 0,
    }

    const source =
      selectedCampaignId === ALL_CAMPAIGNS_VALUE
        ? campaigns
        : selectedCampaign
          ? [selectedCampaign]
          : []

    for (const campaign of source) {
      if (campaign.status === 'ACTIVE') counters.active += 1
      if (campaign.status === 'COMPLETED') counters.completed += 1
      if (campaign.status === 'ARCHIVED') counters.archived += 1
    }

    return counters
  }, [campaigns, selectedCampaign, selectedCampaignId])

  const recoveryRate = useMemo(() => {
    if (!stats || stats.totalDebts === 0) {
      return 0
    }

    return (stats.statuses.PAID / stats.totalDebts) * 100
  }, [stats])

  const riskRate = useMemo(() => {
    if (!stats || stats.totalDebts === 0) {
      return 0
    }

    return (stats.statuses.OVERDUE_AFTER_PROMISE / stats.totalDebts) * 100
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

      {statsLoading ? (
        <Card className="border border-border/60">
          <CardContent className="py-10">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading dashboard stats...
            </div>
          </CardContent>
        </Card>
      ) : statsError ? (
        <Card className="border border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle>Unable to load stats</CardTitle>
            <CardDescription className="text-destructive">{statsError}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="border border-border/60">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total campaigns</CardTitle>
                <Folder className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalCampaigns.toLocaleString()}</div>
                <CardDescription className="text-xs">
                  {selectedCampaign
                    ? `Within ${selectedCampaign.name}`
                    : 'Across your current workspace'}
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border border-border/60">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active campaigns</CardTitle>
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{campaignsHealth.active.toLocaleString()}</div>
                <CardDescription className="text-xs">
                  Campaigns currently running
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border border-border/60">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed campaigns</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{campaignsHealth.completed.toLocaleString()}</div>
                <CardDescription className="text-xs">
                  Campaigns marked as completed
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Archived campaigns</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{campaignsHealth.archived.toLocaleString()}</div>
                <CardDescription className="text-xs">
                  Campaigns stored for history
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          {stats && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card className="border border-border/60">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total debts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.totalDebts.toLocaleString()}</div>
                    <CardDescription className="text-xs">In selected scope</CardDescription>
                  </CardContent>
                </Card>

                <Card className="border border-border/60">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Recovery rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-emerald-400">{percent(recoveryRate)}</div>
                    <CardDescription className="text-xs">Paid debts over total debts</CardDescription>
                  </CardContent>
                </Card>

                <Card className="border border-border/60">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Risk rate</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-400">{percent(riskRate)}</div>
                    <CardDescription className="text-xs">Overdue after promise over total debts</CardDescription>
                  </CardContent>
                </Card>

                <Card className="border border-border/60">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Overdue value</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-amber-300">{formatMoney(stats.totalOverdueAmount)}</div>
                    <CardDescription className="text-xs">Amount at risk in overdue promises</CardDescription>
                  </CardContent>
                </Card>
              </div>

              <Card className="border border-border/60">
                <CardHeader>
                  <CardTitle>Debt status distribution</CardTitle>
                  <CardDescription>Operational snapshot for the selected scope.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {STATUS_CONFIG.map((item) => {
                    const Icon = item.icon
                    const value = stats.statuses[item.key]

                    return (
                      <div key={item.key} className="rounded-md border border-border/60 p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">{item.label}</p>
                          <Icon className={`h-4 w-4 ${item.tone}`} />
                        </div>
                        <p className="mt-2 text-xl font-semibold">{value.toLocaleString()}</p>
                      </div>
                    )
                  })}
                </CardContent>
              </Card>
            </>
          )}

          {selectedCampaignId === ALL_CAMPAIGNS_VALUE && stats?.recentCampaigns && stats.recentCampaigns.length > 0 && (
            <Card className="border border-border/60">
              <CardHeader>
                <CardTitle>Recent campaigns</CardTitle>
                <CardDescription>
                  Quick performance view from latest imported campaigns.
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
                        <Badge variant="outline">Debts: {campaign.debtsCount}</Badge>
                        <Badge variant="secondary">Promised: {campaign.promisedCount}</Badge>
                        <Badge variant="default">Paid: {campaign.paidCount}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {stats && stats.statuses.OVERDUE_AFTER_PROMISE > 0 && (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-amber-200">
                  <AlertTriangle className="h-4 w-4" />
                  Attention required
                </CardTitle>
                <CardDescription>
                  {stats.statuses.OVERDUE_AFTER_PROMISE.toLocaleString()} debt(s) are overdue after promise.
                  Prioritize follow-up on these accounts.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
