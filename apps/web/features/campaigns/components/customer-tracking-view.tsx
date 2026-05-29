'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Search, Eye, MoreVertical, FileText, PencilIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ApiError,
  type CustomerListItem,
  type DebtStatus,
  getDebtPersonalLink,
  listCustomers,
  updateCustomer,
  type UpdateCustomerInput,
} from '@/features/customers/services/customer-service'
import { type CampaignSummary } from '@/features/campaigns/services/campaign-service'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const PAGE_SIZE = 12
const SEARCH_DEBOUNCE_MS = 350
const LIVE_REFRESH_MS = 15000

type FilterStatus = 'ALL' | 'NOT_CONTACTED' | 'UNPAID' | 'NOTIFIED' | 'PROMISE_TO_PAY' | 'CLICKED' | 'PAID' | 'OVERDUE'
type TrackingDisplayStatus =
  | 'NOT_CONTACTED'
  | 'UNPAID'
  | 'NOTIFIED'
  | 'PROMISE_TO_PAY'
  | 'CLICKED'
  | 'PAID'
  | 'OVERDUE'

function formatDate(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString()
}

function formatDateTime(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString()
}

function formatAmount(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: (currency || 'USD').toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function getDebtBadgeVariant(status: TrackingDisplayStatus) {
  if (status === 'PAID' || status === 'CLICKED') return 'default'
  if (status === 'OVERDUE') return 'destructive'
  if (status === 'PROMISE_TO_PAY') return 'secondary'
  return 'outline'
}

function formatDebtStatus(status: TrackingDisplayStatus) {
  if (status === 'PROMISE_TO_PAY') return 'Promise to pay'
  if (status === 'OVERDUE') return 'Overdue'
  if (status === 'UNPAID') return 'Unpaid'
  if (status === 'NOTIFIED') return 'Notified'
  if (status === 'CLICKED') return 'Clicked'
  if (status === 'NOT_CONTACTED') return 'Not contacted'
  return 'Paid'
}

function getTrackingDisplayStatus(row: CustomerListItem): TrackingDisplayStatus {
  if (row.debt.status === 'PAID') return 'PAID'
  if (row.debt.status === 'OVERDUE_AFTER_PROMISE') return 'OVERDUE'
  if (row.debt.status === 'PROMISE_TO_PAY') return 'PROMISE_TO_PAY'

  if (row.debt.linkOpenCount > 0) return 'CLICKED'
  if (row.debt.status === 'NOTIFIED') return 'NOTIFIED'
  if (row.debt.status === 'UNPAID') return 'UNPAID'

  return 'NOT_CONTACTED'
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

interface CustomerTrackingViewProps {
  campaigns: CampaignSummary[]
  campaignId?: string
}

function toFilterStatus(value: string | null): FilterStatus | null {
  if (!value) return null

  const normalized = value.trim().toUpperCase()
  const allowed: FilterStatus[] = ['ALL', 'NOT_CONTACTED', 'UNPAID', 'NOTIFIED', 'PROMISE_TO_PAY', 'CLICKED', 'PAID', 'OVERDUE']
  return allowed.includes(normalized as FilterStatus) ? (normalized as FilterStatus) : null
}

export function CustomerTrackingView({ campaigns, campaignId: routeCampaignId = 'ALL' }: CustomerTrackingViewProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const preferredStatus = useMemo(() => toFilterStatus(searchParams.get('status')), [searchParams])
  const preferredSearch = useMemo(() => searchParams.get('search')?.trim() ?? '', [searchParams])
  const preferredPage = useMemo(() => {
    const parsed = Number(searchParams.get('page') ?? '1')
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
  }, [searchParams])
  const [rows, setRows] = useState<CustomerListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState(preferredSearch)
  const [search, setSearch] = useState(preferredSearch)
  const [status, setStatus] = useState<FilterStatus>(preferredStatus ?? 'ALL')
  const [campaignId, setCampaignId] = useState<string>(routeCampaignId || 'ALL')
  const [page, setPage] = useState(preferredPage)
  const [editingCustomer, setEditingCustomer] = useState<CustomerListItem['customer'] | null>(null)
  const [openingDebtId, setOpeningDebtId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    email: '',
    phone: '',
  })
  const [savingEdit, setSavingEdit] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)
  const [openHistoryDialog, setOpenHistoryDialog] = useState<{
    customerName: string
    times: string[]
  } | null>(null)
  const [mobileDetailsRow, setMobileDetailsRow] = useState<CustomerListItem | null>(null)
  const loadRequestIdRef = useRef(0)

  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  })

  const effectiveCampaignId = campaignId !== 'ALL' ? campaignId : routeCampaignId || 'ALL'

  const load = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    const requestId = loadRequestIdRef.current + 1
    loadRequestIdRef.current = requestId

    if (!silent) {
      setLoading(true)
    }
    setError(null)

    const apiStatus: DebtStatus | undefined =
      status === 'ALL' || status === 'CLICKED'
        ? undefined
        : status === 'NOT_CONTACTED'
          ? 'IMPORTED'
          : status === 'OVERDUE'
            ? 'OVERDUE_AFTER_PROMISE'
            : status

    const clicked = status === 'CLICKED' ? true : undefined

    try {
      const result = await listCustomers({
        page,
        limit: PAGE_SIZE,
        pageSize: PAGE_SIZE,
        search: search || undefined,
        status: apiStatus,
        clicked,
        campaignId: effectiveCampaignId === 'ALL' ? undefined : effectiveCampaignId,
      })

      if (loadRequestIdRef.current !== requestId) {
        return
      }

      setRows(result.data)
      setPagination(result.pagination)
      setLastSyncedAt(new Date())
    } catch (nextError) {
      if (loadRequestIdRef.current !== requestId) {
        return
      }

      setError(getErrorMessage(nextError, 'Failed to load customers'))
    } finally {
      if (loadRequestIdRef.current === requestId) {
        setLoading(false)
      }
    }
  }, [effectiveCampaignId, page, search, status])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, SEARCH_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
    }
  }, [searchInput])

  useEffect(() => {
    if (editingCustomer) {
      return
    }

    const interval = window.setInterval(() => {
      void load({ silent: true })
    }, LIVE_REFRESH_MS)

    return () => {
      window.clearInterval(interval)
    }
  }, [editingCustomer, load])

  useEffect(() => {
    const nextCampaignId = routeCampaignId || 'ALL'
    setCampaignId(nextCampaignId)
    setPage(1)
  }, [routeCampaignId])

  useEffect(() => {
    if (preferredStatus) {
      setStatus(preferredStatus)
      setPage(1)
    }
  }, [preferredStatus])

  useEffect(() => {
    const params = new URLSearchParams()
    if (status !== 'ALL') {
      params.set('status', status)
    }
    if (search.trim()) {
      params.set('search', search.trim())
    }
    if (page > 1) {
      params.set('page', String(page))
    }

    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [effectiveCampaignId, page, pathname, router, search, status])

  const visibleCampaigns = useMemo(() => {
    return campaigns.filter((campaign) => campaign.status !== 'ARCHIVED')
  }, [campaigns])

  useEffect(() => {
    if (routeCampaignId !== 'ALL') {
      return
    }

    if (effectiveCampaignId === 'ALL') {
      return
    }

    const stillVisible = visibleCampaigns.some((campaign) => campaign.id === effectiveCampaignId)
    if (!stillVisible) {
      setCampaignId('ALL')
    }
  }, [effectiveCampaignId, routeCampaignId, visibleCampaigns])

  const openEditDialog = useCallback((customer: CustomerListItem['customer']) => {
    setEditingCustomer(customer)
    setEditForm({
      email: customer.email ?? '',
      phone: customer.phone ?? '',
    })
  }, [])

  const handleSaveEditCustomer = useCallback(async () => {
    if (!editingCustomer) return

    const payload: UpdateCustomerInput = {
      email: editForm.email.trim() ? editForm.email.trim() : null,
      phone: editForm.phone.trim() ? editForm.phone.trim() : null,
    }

    setSavingEdit(true)

    try {
      const updated = await updateCustomer(editingCustomer.id, payload)

      setRows((prev) =>
        prev.map((row) =>
          row.customer.id === editingCustomer.id
            ? {
                ...row,
                customer: {
                  ...row.customer,
                  email: updated.email,
                  phone: updated.phone,
                },
              }
            : row,
        ),
      )

      toast.success('Customer updated')
      setEditingCustomer(null)
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Failed to update customer'))
      toast.error(getErrorMessage(nextError, 'Failed to update customer'))
    } finally {
      setSavingEdit(false)
    }
  }, [editForm.email, editForm.phone, editingCustomer])

  const handleOpenDebtDetails = useCallback(async (debtId: string) => {
    setOpeningDebtId(debtId)

    try {
      const result = await getDebtPersonalLink(debtId)
      const token = result.token || new URL(result.link).searchParams.get('token')

      if (!token) {
        toast.error('Debt token not found')
        return
      }

      window.location.assign(`/client/view?token=${encodeURIComponent(token)}`)
    } catch (nextError) {
      toast.error(getErrorMessage(nextError, 'Failed to open debt details'))
    } finally {
      setOpeningDebtId(null)
    }
  }, [])

  const totalLabel = useMemo(() => {
    if (loading) return 'Loading customers...'
    if (status === 'CLICKED') return `${pagination.total} clicked record(s)`
    return `${pagination.total} debt record(s)`
  }, [loading, pagination.total, status])

  const hasActiveFilters = useMemo(() => {
    return search.length > 0 || status !== 'ALL' || campaignId !== 'ALL'
  }, [search, status, campaignId])

  const emptyStateMessage = useMemo(() => {
    if (campaigns.length === 0) {
      return 'No campaign data available yet. Import a CSV campaign to see customer records here.'
    }

    if (visibleCampaigns.length === 0) {
      return 'No active campaign data available yet.'
    }

    if (hasActiveFilters) {
      return 'No records match your current filters.'
    }

    return 'No customer records found yet for the selected campaign scope.'
  }, [campaigns.length, hasActiveFilters, visibleCampaigns.length])

  const handleResetFilters = useCallback(() => {
    setSearchInput('')
    setSearch('')
    setStatus('ALL')
    setCampaignId('ALL')
    setPage(1)
  }, [])

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[1fr_200px_200px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by customer name or email"
              className="pl-9"
            />
          </div>

          <Select
            value={campaignId}
            onValueChange={(value) => {
              setCampaignId(value)
              setPage(1)
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select campaign" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All campaigns</SelectItem>
              {visibleCampaigns.map((campaign) => (
                <SelectItem key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as FilterStatus)
              setPage(1)
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Filter debt status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="NOT_CONTACTED">Not contacted</SelectItem>
              <SelectItem value="UNPAID">Unpaid</SelectItem>
              <SelectItem value="NOTIFIED">Notified</SelectItem>
              <SelectItem value="PROMISE_TO_PAY">Promise to pay</SelectItem>
              <SelectItem value="CLICKED">Clicked</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
              <SelectItem value="OVERDUE">Overdue</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-2">
          {hasActiveFilters ? (
            <Button variant="ghost" size="sm" onClick={handleResetFilters}>
              Reset filters
            </Button>
          ) : null}
        </div>

        <p className="text-sm text-muted-foreground">
          {totalLabel}
          {lastSyncedAt ? ` • Last synced ${formatDateTime(lastSyncedAt.toISOString())}` : ''}
        </p>

        {error ? (
          <div className="space-y-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <p>{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void load()
              }}
            >
              Retry
            </Button>
          </div>
        ) : loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading customers...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-md border p-6 text-sm text-muted-foreground space-y-3">
            <p>{emptyStateMessage}</p>
            {hasActiveFilters ? (
              <Button variant="outline" size="sm" onClick={handleResetFilters}>
                Clear filters
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead className="hidden md:table-cell">Contact</TableHead>
                  <TableHead>Debt amount</TableHead>
                  <TableHead className="hidden md:table-cell">Due date</TableHead>
                  <TableHead className="hidden sm:table-cell">Link opens</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const displayStatus = getTrackingDisplayStatus(row)
                  return (
                    <TableRow key={`${row.customer.id}:${row.debt.id}`}>
                      <TableCell className="font-medium">{row.customer.fullName}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="text-xs">
                          <p>{row.customer.email || '-'}</p>
                          <p className="text-muted-foreground">{row.customer.phone || '-'}</p>
                        </div>
                      </TableCell>
                      <TableCell>{formatAmount(row.debt.amount, row.debt.currency)}</TableCell>
                      <TableCell className="hidden md:table-cell">{formatDate(row.debt.dueDate)}</TableCell>
                      <TableCell className="hidden whitespace-nowrap sm:table-cell">
                        {row.debt.linkOpenCount > 0 ? (
                          <div className="text-xs">
                            <p className="font-medium">{row.debt.linkOpenCount}</p>
                            <p className="text-muted-foreground">
                              Last: {formatDateTime(row.debt.linkOpenTimes[0] ?? null)}
                            </p>
                            {row.debt.linkOpenTimes.length > 1 ? (
                              <Button
                                variant="link"
                                size="sm"
                                className="h-auto p-0 text-xs text-muted-foreground"
                                onClick={() =>
                                  setOpenHistoryDialog({
                                    customerName: row.customer.fullName,
                                    times: row.debt.linkOpenTimes,
                                  })
                                }
                              >
                                View all times
                              </Button>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getDebtBadgeVariant(displayStatus)}>{formatDebtStatus(displayStatus)}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="md:hidden"
                            onClick={() => setMobileDetailsRow(row)}
                          >
                            Details
                          </Button>
                          <Button asChild variant="ghost" size="sm">
                            <Link
                              href={`/customers/${row.customer.id}?campaignId=${encodeURIComponent(row.debt.campaignId)}&debtId=${encodeURIComponent(row.debt.id)}`}
                            >
                              <Eye className="mr-1.5 h-4 w-4" />
                              Tracking
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={openingDebtId === row.debt.id}
                            onClick={() => {
                              void handleOpenDebtDetails(row.debt.id)
                            }}
                          >
                            {openingDebtId === row.debt.id ? (
                              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                            ) : (
                              <FileText className="mr-1.5 h-4 w-4" />
                            )}
                            Debt
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                                <span className="sr-only">Open menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => openEditDialog(row.customer)}>
                                <PencilIcon className="mr-2 h-4 w-4" />
                                <span>Edit customer</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages || loading}
              onClick={() => setPage((prev) => Math.min(pagination.totalPages, prev + 1))}
            >
              Next
            </Button>
          </div>
        </div>

        <Dialog open={Boolean(editingCustomer)} onOpenChange={(open) => (!open ? setEditingCustomer(null) : null)}>
          <DialogContent>
              <DialogHeader>
                    <DialogTitle>Edit customer</DialogTitle>
                    <DialogDescription>Update customer contact fields (email and phone).</DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label htmlFor="edit-customer-email" className="text-sm font-medium">Email</label>
                  <Input
                    id="edit-customer-email"
                    type="email"
                    value={editForm.email}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))}
                    placeholder="customer@email.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="edit-customer-phone" className="text-sm font-medium">Phone</label>
                  <Input
                    id="edit-customer-phone"
                    value={editForm.phone}
                    onChange={(event) => setEditForm((prev) => ({ ...prev, phone: event.target.value }))}
                    placeholder="+212..."
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setEditingCustomer(null)} disabled={savingEdit}>
                  Cancel
                </Button>
                <Button onClick={() => void handleSaveEditCustomer()} disabled={savingEdit}>
                  {savingEdit ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save changes'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog open={Boolean(openHistoryDialog)} onOpenChange={(open) => (!open ? setOpenHistoryDialog(null) : null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Link open history</DialogTitle>
              <DialogDescription>
                {openHistoryDialog
                  ? `${openHistoryDialog.customerName} opened the debt link ${openHistoryDialog.times.length} time(s).`
                  : 'Link open activity'}
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-3">
              {openHistoryDialog?.times.map((time) => (
                <p key={time} className="text-sm text-muted-foreground">
                  {formatDateTime(time)}
                </p>
              ))}
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={Boolean(mobileDetailsRow)} onOpenChange={(open) => (!open ? setMobileDetailsRow(null) : null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Debt record details</DialogTitle>
              <DialogDescription>
                {mobileDetailsRow
                  ? `Details for ${mobileDetailsRow.customer.fullName}`
                  : 'Customer debt details'}
              </DialogDescription>
            </DialogHeader>
            {mobileDetailsRow ? (
              <div className="space-y-2 text-sm">
                <p><span className="font-medium">Customer:</span> {mobileDetailsRow.customer.fullName}</p>
                <p><span className="font-medium">Email:</span> {mobileDetailsRow.customer.email || '-'}</p>
                <p><span className="font-medium">Phone:</span> {mobileDetailsRow.customer.phone || '-'}</p>
                <p><span className="font-medium">Due date:</span> {formatDate(mobileDetailsRow.debt.dueDate)}</p>
                <p><span className="font-medium">Link opens:</span> {mobileDetailsRow.debt.linkOpenCount}</p>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
