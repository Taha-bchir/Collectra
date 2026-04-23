'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { ApiError, getDashboardStats } from '@/features/overview/services/overview-stats-service'
import type { DashboardDebtStatusCounts, DashboardStats } from '@/features/overview/types'
import { listCampaigns, type CampaignSummary } from '@/features/campaigns/services/campaign-service'
import { strings } from '@/lib/strings'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts'

const ALL_CAMPAIGNS_VALUE = 'all'
type TrendRange = '7d' | '30d'

const STATUS_CONFIG: Array<{
  key: keyof DashboardDebtStatusCounts
  label: string
}> = [
  { key: 'IMPORTED', label: 'Imported' },
  { key: 'UNPAID', label: 'Unpaid' },
  { key: 'NOTIFIED', label: 'Notified' },
  { key: 'PROMISE_TO_PAY', label: 'Promised' },
  { key: 'PAID', label: 'Paid' },
  { key: 'OVERDUE_AFTER_PROMISE', label: 'Overdue' },
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

const debtStatusChartConfig = {
  IMPORTED: { label: 'Imported', theme: { light: '#64748b', dark: '#94a3b8' } },
  UNPAID: { label: 'Unpaid', theme: { light: '#f59e0b', dark: '#fbbf24' } },
  NOTIFIED: { label: 'Notified', theme: { light: '#3b82f6', dark: '#60a5fa' } },
  PROMISE_TO_PAY: { label: 'Promised', theme: { light: '#06b6d4', dark: '#22d3ee' } },
  PAID: { label: 'Paid', theme: { light: '#22c55e', dark: '#4ade80' } },
  OVERDUE_AFTER_PROMISE: { label: 'Overdue', theme: { light: '#ef4444', dark: '#f87171' } },
} satisfies ChartConfig

const campaignHealthChartConfig = {
  Active: { label: 'Active', theme: { light: '#3b82f6', dark: '#60a5fa' } },
  Completed: { label: 'Completed', theme: { light: '#22c55e', dark: '#4ade80' } },
  Archived: { label: 'Archived', theme: { light: '#f59e0b', dark: '#fbbf24' } },
} satisfies ChartConfig

const recentCampaignChartConfig = {
  debtsCount: { label: 'Debts', theme: { light: '#3b82f6', dark: '#60a5fa' } },
  promisedCount: { label: 'Promised', theme: { light: '#06b6d4', dark: '#22d3ee' } },
  paidCount: { label: 'Paid', theme: { light: '#22c55e', dark: '#4ade80' } },
} satisfies ChartConfig

export default function OverviewPage() {
  const router = useRouter()
  const { profile } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [statsReloadKey, setStatsReloadKey] = useState(0)

  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([])
  const [isCampaignsLoading, setIsCampaignsLoading] = useState(true)
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(ALL_CAMPAIGNS_VALUE)
  const [trendRange, setTrendRange] = useState<TrendRange>('7d')

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
  }, [selectedCampaignId, statsReloadKey])

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

  const debtStatusChartData = useMemo(() => {
    if (!stats) return []

    return STATUS_CONFIG.map((item) => ({
      key: item.key,
      status: item.label,
      value: stats.statuses[item.key],
    }))
  }, [stats])

  const campaignHealthChartData = useMemo(
    () => [
      { name: 'Active', count: campaignsHealth.active },
      { name: 'Completed', count: campaignsHealth.completed },
      { name: 'Archived', count: campaignsHealth.archived },
    ],
    [campaignsHealth.active, campaignsHealth.archived, campaignsHealth.completed],
  )

  const recentCampaignChartData = useMemo(() => {
    if (!stats?.recentCampaigns) return []

    return [...stats.recentCampaigns]
      .reverse()
      .map((campaign) => ({
        name: campaign.name.length > 14 ? `${campaign.name.slice(0, 14)}...` : campaign.name,
        debtsCount: campaign.debtsCount,
        promisedCount: campaign.promisedCount,
        paidCount: campaign.paidCount,
      }))
  }, [stats?.recentCampaigns])

  const trendSummary = useMemo(() => {
    if (!stats?.recentCampaigns?.length) {
      return { campaigns: 0, debts: 0, promised: 0, paid: 0 }
    }

    const now = Date.now()
    const days = trendRange === '7d' ? 7 : 30
    const cutoff = now - days * 24 * 60 * 60 * 1000
    const inRange = stats.recentCampaigns.filter((campaign) => new Date(campaign.createdAt).getTime() >= cutoff)

    return inRange.reduce(
      (acc, campaign) => {
        acc.campaigns += 1
        acc.debts += campaign.debtsCount
        acc.promised += campaign.promisedCount
        acc.paid += campaign.paidCount
        return acc
      },
      { campaigns: 0, debts: 0, promised: 0, paid: 0 },
    )
  }, [stats?.recentCampaigns, trendRange])

  const openTables = (status?: keyof DashboardDebtStatusCounts) => {
    const params = new URLSearchParams()
    if (selectedCampaignId !== ALL_CAMPAIGNS_VALUE) {
      params.set('campaignId', selectedCampaignId)
    }

    if (status) {
      const statusMap: Record<keyof DashboardDebtStatusCounts, string> = {
        IMPORTED: 'NOT_CONTACTED',
        UNPAID: 'UNPAID',
        NOTIFIED: 'NOTIFIED',
        PROMISE_TO_PAY: 'PROMISE_TO_PAY',
        PAID: 'PAID',
        OVERDUE_AFTER_PROMISE: 'OVERDUE',
      }
      params.set('status', statusMap[status])
    }

    const query = params.toString()
    router.push(query ? `/campaigns/tables?${query}` : '/campaigns/tables')
  }

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
          <CardContent>
            <button
              type="button"
              onClick={() => setStatsReloadKey((prev) => prev + 1)}
              className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-background/60"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="border border-border/60">
              <CardHeader>
                <CardTitle>Campaign health</CardTitle>
                <CardDescription>
                  {selectedCampaign
                    ? `Campaign status for ${selectedCampaign.name}`
                    : `Status distribution across ${totalCampaigns.toLocaleString()} campaign(s)`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={campaignHealthChartConfig} className="h-[280px] w-full">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Pie
                      data={campaignHealthChartData}
                      dataKey="count"
                      nameKey="name"
                      outerRadius={90}
                      label
                      onClick={() => openTables()}
                      className="cursor-pointer"
                    >
                      {campaignHealthChartData.map((entry, index) => (
                        <Cell
                          key={`campaign-health-${entry.name}`}
                          fill={`var(--color-${entry.name})`}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {stats && (
              <Card className="border border-border/60">
                <CardHeader>
                  <CardTitle>Debt status distribution</CardTitle>
                  <CardDescription>
                    Total debts: {stats.totalDebts.toLocaleString()} • Recovery: {percent(recoveryRate)} • Risk: {percent(riskRate)} • Overdue value: {formatMoney(stats.totalOverdueAmount)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={debtStatusChartConfig} className="h-[280px] w-full">
                    <BarChart data={debtStatusChartData}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="status" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="value" radius={6} className="cursor-pointer">
                      {debtStatusChartData.map((entry) => (
                        <Cell
                          key={`debt-status-${entry.status}`}
                          fill={`var(--color-${entry.key})`}
                          onClick={() => openTables(entry.key)}
                        />
                      ))}
                    </Bar>
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}
          </div>

          {selectedCampaignId === ALL_CAMPAIGNS_VALUE && stats?.recentCampaigns && stats.recentCampaigns.length > 0 && (
            <Card className="border border-border/60">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle>Recent campaigns</CardTitle>
                  <Select value={trendRange} onValueChange={(value) => setTrendRange(value as TrendRange)}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7d">Last 7 days</SelectItem>
                      <SelectItem value="30d">Last 30 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <CardDescription>
                  Quick performance view from latest imported campaigns.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Badge variant="outline">Campaigns: {trendSummary.campaigns}</Badge>
                  <Badge variant="outline">Debt records: {trendSummary.debts}</Badge>
                  <Badge variant="outline">Promises: {trendSummary.promised}</Badge>
                  <Badge variant="outline">Paid: {trendSummary.paid}</Badge>
                </div>
                <ChartContainer config={recentCampaignChartConfig} className="h-[320px] w-full">
                  <BarChart data={recentCampaignChartData}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="debtsCount" fill="var(--color-debtsCount)" radius={4} />
                    <Bar dataKey="promisedCount" fill="var(--color-promisedCount)" radius={4} />
                    <Bar dataKey="paidCount" fill="var(--color-paidCount)" radius={4} />
                  </BarChart>
                </ChartContainer>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {stats.recentCampaigns.map((campaign) => (
                    <Badge key={campaign.id} variant="outline">
                      {campaign.name} • {formatDate(campaign.createdAt)}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

        </>
      )}
    </div>
  )
}
