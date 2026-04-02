'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/features/auth/hooks/use-auth'
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
import { CheckCircle2, Folder, FolderOpen, Loader2 } from 'lucide-react'

const ALL_CAMPAIGNS_VALUE = 'all'

function formatDate(value: string) {
  return new Date(value).toLocaleDateString()
}

export default function OverviewPage() {
  const { profile } = useAuth()
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
    [campaigns, selectedCampaignId]
  )

  const campaignsInScope = useMemo(() => {
    if (selectedCampaignId === ALL_CAMPAIGNS_VALUE) {
      return campaigns
    }

    return selectedCampaign ? [selectedCampaign] : []
  }, [campaigns, selectedCampaign, selectedCampaignId])

  const campaignStats = useMemo(() => {
    const counts = {
      total: campaignsInScope.length,
      active: 0,
      completed: 0,
      archived: 0,
    }

    for (const campaign of campaignsInScope) {
      if (campaign.status === 'ACTIVE') counts.active += 1
      if (campaign.status === 'COMPLETED') counts.completed += 1
      if (campaign.status === 'ARCHIVED') counts.archived += 1
    }

    return counts
  }, [campaignsInScope])

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

      {isCampaignsLoading ? (
        <Card className="border border-border/60">
          <CardContent className="py-10">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading campaign stats...
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <Card className="border border-border/60">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total campaigns</CardTitle>
                <Folder className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{campaignStats.total.toLocaleString()}</div>
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
                <div className="text-2xl font-bold">{campaignStats.active.toLocaleString()}</div>
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
                <div className="text-2xl font-bold">{campaignStats.completed.toLocaleString()}</div>
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
                <div className="text-2xl font-bold">{campaignStats.archived.toLocaleString()}</div>
                <CardDescription className="text-xs">
                  Campaigns stored for history
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          {selectedCampaignId === ALL_CAMPAIGNS_VALUE && campaigns.length > 0 && (
            <Card className="border border-border/60">
              <CardHeader>
                <CardTitle>Recent campaigns</CardTitle>
                <CardDescription>
                  Latest campaigns with status and creation date.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {campaigns.slice(0, 5).map((campaign) => (
                    <div
                      key={campaign.id}
                      className="rounded-md border border-border/60 p-3 text-sm"
                    >
                      <div className="font-medium">{campaign.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Created on {formatDate(campaign.createdAt)}
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <Badge variant="outline">{campaign.status}</Badge>
                      </div>
                    </div>
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
