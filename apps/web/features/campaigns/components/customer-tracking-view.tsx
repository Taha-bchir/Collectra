'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Loader2, Search, Eye, MoreVertical, FileText, PencilIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

type FilterStatus = 'ALL' | DebtStatus

function formatDate(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString()
}

function formatDateTime(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString()
}

function formatAmount(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function getDebtBadgeVariant(status: DebtStatus) {
  if (status === 'PAID') return 'default'
  if (status === 'OVERDUE_AFTER_PROMISE') return 'destructive'
  if (status === 'PROMISE_TO_PAY') return 'secondary'
  return 'outline'
}

function formatDebtStatus(status: DebtStatus) {
  if (status === 'PROMISE_TO_PAY') return 'Promise to pay'
  if (status === 'OVERDUE_AFTER_PROMISE') return 'Overdue'
  if (status === 'UNPAID') return 'Unpaid'
  if (status === 'NOTIFIED') return 'Notified'
  if (status === 'IMPORTED') return 'Imported'
  return 'Paid'
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
  selectedCampaignId?: string
}

export function CustomerTrackingView({ campaigns, selectedCampaignId = 'ALL' }: CustomerTrackingViewProps) {
  const [rows, setRows] = useState<CustomerListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<FilterStatus>('ALL')
  const [campaignId, setCampaignId] = useState<string>(selectedCampaignId)
  const [page, setPage] = useState(1)
  const [editingCustomer, setEditingCustomer] = useState<CustomerListItem['customer'] | null>(null)
  const [openingDebtId, setOpeningDebtId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
  })
  const [savingEdit, setSavingEdit] = useState(false)

  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await listCustomers({
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
        status: status === 'ALL' ? undefined : status,
        campaignId: campaignId === 'ALL' ? undefined : campaignId,
      })

      setRows(result.data)
      setPagination(result.pagination)
    } catch (nextError) {
      setError(getErrorMessage(nextError, 'Failed to load customers'))
    } finally {
      setLoading(false)
    }
  }, [campaignId, page, search, status])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setCampaignId(selectedCampaignId)
    setPage(1)
  }, [selectedCampaignId])

  const openEditDialog = useCallback((customer: CustomerListItem['customer']) => {
    setEditingCustomer(customer)
    setEditForm({
      fullName: customer.fullName,
      email: customer.email ?? '',
      phone: customer.phone ?? '',
      address: customer.address ?? '',
    })
  }, [])

  const handleSaveEditCustomer = useCallback(async () => {
    if (!editingCustomer) return

    const fullName = editForm.fullName.trim()
    if (!fullName) {
      toast.error('Customer name is required')
      return
    }

    const payload: UpdateCustomerInput = {
      fullName,
      email: editForm.email.trim() ? editForm.email.trim() : null,
      phone: editForm.phone.trim() ? editForm.phone.trim() : null,
      address: editForm.address.trim() ? editForm.address.trim() : null,
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
                  fullName: updated.fullName,
                  email: updated.email,
                  phone: updated.phone,
                  address: updated.address,
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
  }, [editForm.address, editForm.email, editForm.fullName, editForm.phone, editingCustomer])

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
    return `${pagination.total} customer row(s)`
  }, [loading, pagination.total])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customers Tracking</CardTitle>
        <CardDescription>Explore customer debts and open detailed communication tracking per customer.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[1fr_220px_260px_auto]">
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
              <SelectItem value="UNPAID">Unpaid</SelectItem>
              <SelectItem value="NOTIFIED">Notified</SelectItem>
              <SelectItem value="PROMISE_TO_PAY">Promise to pay</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
              <SelectItem value="OVERDUE_AFTER_PROMISE">Overdue</SelectItem>
              <SelectItem value="IMPORTED">Imported</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={campaignId}
            onValueChange={(value) => {
              setCampaignId(value)
              setPage(1)
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Filter campaign" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All campaigns</SelectItem>
              {campaigns.map((campaign) => (
                <SelectItem key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={() => {
              setSearch(searchInput.trim())
              setPage(1)
            }}
          >
            Apply
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">{totalLabel}</p>

        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading customers...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-md border p-6 text-sm text-muted-foreground">
            No customers found for the selected filters.
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Debt amount</TableHead>
                  <TableHead>Due date</TableHead>
                  <TableHead>Link opens</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={`${row.customer.id}:${row.debt.id}`}>
                    <TableCell className="font-medium text-sm">{row.debt.campaignName}</TableCell>
                    <TableCell className="font-medium">{row.customer.fullName}</TableCell>
                    <TableCell>
                      <div className="text-xs">
                        <p>{row.customer.email || '-'}</p>
                        <p className="text-muted-foreground">{row.customer.phone || '-'}</p>
                      </div>
                    </TableCell>
                    <TableCell>{formatAmount(row.debt.amount)}</TableCell>
                    <TableCell>{formatDate(row.debt.dueDate)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {row.debt.linkOpenCount > 0 ? (
                        <div className="text-xs">
                          <p className="font-medium">{row.debt.linkOpenCount}</p>
                          <p className="text-muted-foreground">
                            Last: {formatDateTime(row.debt.linkOpenTimes[0] ?? null)}
                          </p>
                          {row.debt.linkOpenTimes.length > 1 ? (
                            <p
                              className="text-muted-foreground"
                              title={row.debt.linkOpenTimes.map((time) => formatDateTime(time)).join('\n')}
                            >
                              View all times
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getDebtBadgeVariant(row.debt.status)}>
                        {formatDebtStatus(row.debt.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                            <span className="sr-only">Open menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/customers/${row.customer.id}`} className="cursor-pointer">
                              <Eye className="mr-2 h-4 w-4" />
                              <span>Open tracking</span>
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={openingDebtId === row.debt.id}
                            onSelect={() => {
                              void handleOpenDebtDetails(row.debt.id)
                            }}
                          >
                            {openingDebtId === row.debt.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <FileText className="mr-2 h-4 w-4" />
                            )}
                            <span>View debt details</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => openEditDialog(row.customer)}>
                            <PencilIcon className="mr-2 h-4 w-4" />
                            <span>Edit customer</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
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
              <DialogDescription>Update customer contact fields for the selected row.</DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Full name</label>
                <Input
                  value={editForm.fullName}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, fullName: event.target.value }))}
                  placeholder="Customer full name"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="customer@email.com"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Phone</label>
                <Input
                  value={editForm.phone}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, phone: event.target.value }))}
                  placeholder="+212..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Address</label>
                <Input
                  value={editForm.address}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, address: event.target.value }))}
                  placeholder="Street, city"
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
      </CardContent>
    </Card>
  )
}
