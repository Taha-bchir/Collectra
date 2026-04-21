'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, FolderKanban, Loader2, PlusCircle, RefreshCcw } from 'lucide-react'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ApiError, listCampaigns, type CampaignSummary } from '@/features/campaigns/services/campaign-service'

function formatDate(value: string) {
  return new Date(value).toLocaleDateString()
}

function getStatusVariant(status: CampaignSummary['status']) {
  if (status === 'ACTIVE') return 'default'
  if (status === 'ARCHIVED') return 'outline'
  return 'secondary'
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return 'Failed to load campaigns'
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadCampaigns = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const items = await listCampaigns()
      setCampaigns(items)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
      setCampaigns([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCampaigns()
  }, [loadCampaigns])

  const campaignCounts = useMemo(() => {
    return campaigns.reduce(
      (acc, campaign) => {
        if (campaign.status === 'ACTIVE') acc.active += 1
        if (campaign.status === 'COMPLETED') acc.completed += 1
        if (campaign.status === 'ARCHIVED') acc.archived += 1
        return acc
      },
      { active: 0, completed: 0, archived: 0 }
    )
  }, [campaigns])

  const hasCampaigns = campaigns.length > 0

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-auto p-4 md:gap-8 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Campaigns</h1>
          <p className="mt-1 text-muted-foreground">
            {hasCampaigns
              ? 'Manage the campaigns you created and jump directly to detailed tables.'
              : 'Create your first campaign by importing a CSV file.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/create">
              <PlusCircle className="mr-2 h-4 w-4" />
              Create Campaign
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/campaigns/tables">Open Tables</Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading your campaigns...
          </CardContent>
        </Card>
      ) : errorMessage ? (
        <Card>
          <CardHeader>
            <CardTitle>Unable to load campaigns</CardTitle>
            <CardDescription>{errorMessage}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => void loadCampaigns()} variant="outline">
              <RefreshCcw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : !hasCampaigns ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="rounded-full bg-primary/10 p-3 text-primary">
              <FolderKanban className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-semibold">No campaigns yet</p>
              <p className="text-sm text-muted-foreground">
                Start by importing your first CSV to create a campaign.
              </p>
            </div>
            <Button asChild>
              <Link href="/create">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Your First Campaign
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">Total: {campaigns.length}</Badge>
            <Badge variant="default">Active: {campaignCounts.active}</Badge>
            <Badge variant="secondary">Completed: {campaignCounts.completed}</Badge>
            <Badge variant="outline">Archived: {campaignCounts.archived}</Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {campaigns.map((campaign) => (
              <Card key={campaign.id} className="transition-colors hover:bg-muted/20">
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="line-clamp-1 text-base">{campaign.name}</CardTitle>
                    <Badge variant={getStatusVariant(campaign.status)}>{campaign.status}</Badge>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {campaign.description?.trim() || 'No description provided for this campaign.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    <p>Debts: {campaign.debtsCount}</p>
                    <p>Created: {formatDate(campaign.createdAt)}</p>
                  </div>

                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/campaigns/tables?campaignId=${encodeURIComponent(campaign.id)}`}>
                      View In Tables
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
