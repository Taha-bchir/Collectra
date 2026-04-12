'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Search, Eye } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  ApiError,
  type CustomerListItem,
  type DebtStatus,
  listCustomers,
} from '@/features/customers/services/customer-service'
import { listCampaigns, type CampaignSummary } from '@/features/campaigns/services/campaign-service'

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

export default function CustomersPage() {
  const [rows, setRows] = useState<CustomerListItem[]>([])
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<FilterStatus>('ALL')
  const [campaignId, setCampaignId] = useState<string>('ALL')
  const [page, setPage] = useState(1)

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
    const loadCampaigns = async () => {
      try {
        const items = await listCampaigns()
        setCampaigns(items)
      } catch {
        // Keep selector usable with default "ALL" when campaigns list fails.
      }
    }

    loadCampaigns()
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const totalLabel = useMemo(() => {
    if (loading) return 'Loading customers...'
    return `${pagination.total} customer row(s)`
  }, [loading, pagination.total])

  const groupedByCampaign = useMemo(() => {
    const map = new Map<string, { campaignId: string; campaignName: string; rows: CustomerListItem[] }>()

    for (const row of rows) {
      const key = row.debt.campaignId
      const existing = map.get(key)

      if (existing) {
        existing.rows.push(row)
        continue
      }

      map.set(key, {
        campaignId: row.debt.campaignId,
        campaignName: row.debt.campaignName,
        rows: [row],
      })
    }

    return Array.from(map.values()).sort((a, b) => a.campaignName.localeCompare(b.campaignName))
  }, [rows])

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8 overflow-auto">
      <Card className="border border-border/60">
        <CardHeader>
          <CardTitle className="text-xl">Customers Tracking</CardTitle>
          <CardDescription>
            Explore customer debts and open detailed communication tracking per customer.
          </CardDescription>
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
            <div className="space-y-4">
              {groupedByCampaign.map((group) => (
                <Card key={group.campaignId} className="border border-border/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{group.campaignName}</CardTitle>
                    <CardDescription>{group.rows.length} customer row(s)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Customer</TableHead>
                            <TableHead>Contact</TableHead>
                            <TableHead>Debt amount</TableHead>
                            <TableHead>Due date</TableHead>
                            <TableHead>Link opens</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Tracking</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.rows.map((row) => (
                            <TableRow key={`${row.customer.id}:${row.debt.id}`}>
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
                                <Badge variant={getDebtBadgeVariant(row.debt.status)}>{formatDebtStatus(row.debt.status)}</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button asChild variant="outline" size="sm">
                                  <Link href={`/customers/${row.customer.id}`}>
                                    <Eye className="mr-1.5 h-4 w-4" />
                                    Open tracking
                                  </Link>
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              ))}
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
        </CardContent>
      </Card>
    </div>
  )
}
