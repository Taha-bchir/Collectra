'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Archive, ArrowRight, CheckCircle2, FolderKanban, Loader2, MoreVertical, PlusCircle, RefreshCcw, Search, Sparkles, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  ApiError,
  deleteCampaign,
  listCampaigns,
  type CampaignSummary,
  updateCampaignStatus,
} from '@/features/campaigns/services/campaign-service'

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
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const initialSearch = searchParams.get('search')?.trim() ?? ''
  const initialStatusFilter = (searchParams.get('status')?.trim().toUpperCase() ?? 'ALL') as 'ALL' | CampaignSummary['status']
  const initialSortBy = (searchParams.get('sort')?.trim() ?? 'newest') as 'newest' | 'oldest' | 'debts-desc' | 'debts-asc'
  const [search, setSearch] = useState(initialSearch)
  const [statusFilter, setStatusFilter] = useState<'ALL' | CampaignSummary['status']>(
    ['ALL', 'ACTIVE', 'COMPLETED', 'ARCHIVED'].includes(initialStatusFilter) ? initialStatusFilter : 'ALL',
  )
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'debts-desc' | 'debts-asc'>(
    ['newest', 'oldest', 'debts-desc', 'debts-asc'].includes(initialSortBy) ? initialSortBy : 'newest',
  )
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null)
  const [campaignDeletingId, setCampaignDeletingId] = useState<string | null>(null)
  const [campaignToDelete, setCampaignToDelete] = useState<CampaignSummary | null>(null)

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

  useEffect(() => {
    const params = new URLSearchParams()
    if (search.trim()) {
      params.set('search', search.trim())
    }
    if (statusFilter !== 'ALL') {
      params.set('status', statusFilter)
    }
    if (sortBy !== 'newest') {
      params.set('sort', sortBy)
    }

    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [pathname, router, search, sortBy, statusFilter])

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

  const filteredCampaigns = useMemo(() => {
    const query = search.trim().toLowerCase()

    const filtered = campaigns.filter((campaign) => {
      const matchesQuery =
        query.length === 0 ||
        campaign.name.toLowerCase().includes(query) ||
        campaign.description?.toLowerCase().includes(query)

      const matchesStatus = statusFilter === 'ALL' || campaign.status === statusFilter

      return matchesQuery && matchesStatus
    })

    return filtered.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }

      if (sortBy === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      }

      if (sortBy === 'debts-desc') {
        return b.debtsCount - a.debtsCount
      }

      return a.debtsCount - b.debtsCount
    })
  }, [campaigns, search, sortBy, statusFilter])

  const handleToggleCampaignDone = useCallback(async (campaign: CampaignSummary) => {
    const nextStatus: CampaignSummary['status'] = campaign.status === 'COMPLETED' ? 'ACTIVE' : 'COMPLETED'
    setStatusUpdatingId(campaign.id)

    try {
      const updated = await updateCampaignStatus(campaign.id, { status: nextStatus })
      setCampaigns((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      toast.success(nextStatus === 'COMPLETED' ? 'Campaign marked as done' : 'Campaign marked as not done')
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setStatusUpdatingId(null)
    }
  }, [])

  const handleToggleCampaignArchive = useCallback(async (campaign: CampaignSummary) => {
    const nextStatus: CampaignSummary['status'] = campaign.status === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED'
    setStatusUpdatingId(campaign.id)

    try {
      const updated = await updateCampaignStatus(campaign.id, { status: nextStatus })
      setCampaigns((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      toast.success(nextStatus === 'ARCHIVED' ? 'Campaign archived' : 'Campaign unarchived')
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setStatusUpdatingId(null)
    }
  }, [])

  const handleConfirmDeleteCampaign = useCallback(async () => {
    if (!campaignToDelete) {
      return
    }

    setCampaignDeletingId(campaignToDelete.id)

    try {
      await deleteCampaign(campaignToDelete.id)
      setCampaigns((prev) => prev.filter((item) => item.id !== campaignToDelete.id))
      toast.success('Campaign deleted')
      setCampaignToDelete(null)
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setCampaignDeletingId(null)
    }
  }, [campaignToDelete])

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-auto p-4 md:gap-8 md:p-8">
      <div className="relative overflow-hidden rounded-3xl border bg-linear-to-br from-background via-background to-muted/40 p-6 shadow-sm">
        <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl space-y-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-muted-foreground">
              <Sparkles className="h-4 w-4" />
              Campaign workspace
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Campaigns</h1>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
                Track all campaigns you created, manage their status, and inspect customer records in one place.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/create">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Campaign
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="space-y-1 pb-3">
            <CardDescription>Total campaigns</CardDescription>
            <CardTitle className="text-3xl">{campaigns.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-1 pb-3">
            <CardDescription>Active campaigns</CardDescription>
            <CardTitle className="text-3xl">{campaignCounts.active}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-1 pb-3">
            <CardDescription>Completed campaigns</CardDescription>
            <CardTitle className="text-3xl">{campaignCounts.completed}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="space-y-1 pb-3">
            <CardDescription>Archived campaigns</CardDescription>
            <CardTitle className="text-3xl">{campaignCounts.archived}</CardTitle>
          </CardHeader>
        </Card>
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full max-w-md">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search campaigns by name or description"
                className="pl-9"
              />
            </div>

            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as 'ALL' | CampaignSummary['status'])}
              >
                <SelectTrigger className="w-full sm:w-45">
                  <SelectValue placeholder="Filter status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All statuses</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="ARCHIVED">Archived</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                <SelectTrigger className="w-full sm:w-45">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                  <SelectItem value="debts-desc">Most debts</SelectItem>
                  <SelectItem value="debts-asc">Least debts</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">Total: {campaigns.length}</Badge>
            <Badge variant="outline">Shown: {filteredCampaigns.length}</Badge>
            <Badge variant="default">Active: {campaignCounts.active}</Badge>
            <Badge variant="secondary">Completed: {campaignCounts.completed}</Badge>
            <Badge variant="outline">Archived: {campaignCounts.archived}</Badge>
          </div>

          {filteredCampaigns.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center">
                <p className="text-lg font-semibold">No campaigns match these filters</p>
                <p className="mt-1 text-sm text-muted-foreground">Try changing search text or status filters.</p>
              </CardContent>
            </Card>
          ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredCampaigns.map((campaign) => (
              <Card key={campaign.id} className="transition-colors hover:bg-muted/20">
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="line-clamp-1 text-base">{campaign.name}</CardTitle>
                    <div className="flex items-center gap-1">
                      <Badge variant={getStatusVariant(campaign.status)}>{campaign.status}</Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">Open campaign actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            disabled={statusUpdatingId === campaign.id || campaignDeletingId === campaign.id}
                            onSelect={() => {
                              void handleToggleCampaignDone(campaign)
                            }}
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            <span>{campaign.status === 'COMPLETED' ? 'Mark as not done' : 'Mark as done'}</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={statusUpdatingId === campaign.id || campaignDeletingId === campaign.id}
                            onSelect={() => {
                              void handleToggleCampaignArchive(campaign)
                            }}
                          >
                            <Archive className="mr-2 h-4 w-4" />
                            <span>{campaign.status === 'ARCHIVED' ? 'Unarchive campaign' : 'Archive campaign'}</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={statusUpdatingId === campaign.id || campaignDeletingId === campaign.id}
                            onSelect={() => {
                              setCampaignToDelete(campaign)
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>Delete campaign</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {campaign.description?.trim() || 'No description provided for this campaign.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    <p>Debt records: {campaign.debtsCount}</p>
                    <p>Created: {formatDate(campaign.createdAt)}</p>
                  </div>

                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/campaigns/tables/${encodeURIComponent(campaign.id)}`}>
                      View In Tables
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          )}
        </>
      )}

      <AlertDialog open={Boolean(campaignToDelete)} onOpenChange={(open) => (!open ? setCampaignToDelete(null) : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              {campaignToDelete
                ? `This will permanently delete "${campaignToDelete.name}" and ${campaignToDelete.debtsCount} related debt row(s).`
                : 'This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={campaignDeletingId !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleConfirmDeleteCampaign()
              }}
              disabled={campaignDeletingId !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {campaignDeletingId !== null ? 'Deleting...' : 'Delete campaign'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
