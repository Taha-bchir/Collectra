'use client'

import { Fragment, type MouseEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Loader2, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { CampaignEmailStatsCard } from '@/components/campaign-email-stats'
import {
  ApiError,
  type CampaignDetails,
  type CampaignImportResult,
  type CampaignSummary,
  type DebtStatus,
  getDebtPersonalLink,
  getCampaignById,
  importCampaignCsv,
  listCampaigns,
  updateCampaignDueDate,
  updateCampaignStatus,
  deleteCampaign,
  updateDebt,
} from '@/features/campaigns/services/campaign-service'
import { previewCampaignCsv, type CsvPreviewResult } from '@/features/campaigns/utils/csv-preview'

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return error.message
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString()
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString()
}

function formatAmount(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

type UiDebtStatus = 'UNPAID' | 'PROMISE' | 'PAID' | 'OVERDUE'
type UiDebtFilter = 'ALL' | UiDebtStatus

function mapDebtStatusToUiStatus(status: DebtStatus): UiDebtStatus {
  if (status === 'PAID') return 'PAID'
  if (status === 'PROMISE_TO_PAY') return 'PROMISE'
  if (status === 'OVERDUE_AFTER_PROMISE') return 'OVERDUE'
  return 'UNPAID'
}

function mapUiStatusToDebtStatus(status: UiDebtStatus): DebtStatus {
  if (status === 'PAID') return 'PAID'
  if (status === 'PROMISE') return 'PROMISE_TO_PAY'
  if (status === 'OVERDUE') return 'OVERDUE_AFTER_PROMISE'
  return 'UNPAID'
}

function formatUiDebtStatus(status: UiDebtStatus) {
  if (status === 'UNPAID') return 'Unpaid'
  if (status === 'PROMISE') return 'Promise'
  if (status === 'PAID') return 'Paid'
  return 'Overdue'
}

function getUiDebtStatusVariant(status: UiDebtStatus) {
  if (status === 'PAID') return 'default'
  if (status === 'OVERDUE') return 'destructive'
  if (status === 'PROMISE') return 'secondary'
  return 'outline'
}

function getStatusVariant(status: CampaignSummary['status']) {
  if (status === 'ACTIVE') return 'default'
  if (status === 'ARCHIVED') return 'outline'
  if (status === 'COMPLETED') return 'secondary'
  return 'secondary'
}

const DETAILS_PAGE_SIZE = 12
const CAMPAIGNS_PAGE_SIZE = 4
const MANUAL_STATUS_OPTIONS: UiDebtStatus[] = ['UNPAID', 'PROMISE', 'PAID', 'OVERDUE']
type CampaignCompletionFilter = 'ALL' | 'DONE' | 'NOT_DONE'

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([])
  const [campaignsLoading, setCampaignsLoading] = useState(true)

  const [selectedCampaign, setSelectedCampaign] = useState<CampaignDetails | null>(null)
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)
  const [selectedCampaignLoading, setSelectedCampaignLoading] = useState(false)
  const [selectedCampaignError, setSelectedCampaignError] = useState<string | null>(null)
  const [campaignSearch, setCampaignSearch] = useState('')
  const [campaignCompletionFilter, setCampaignCompletionFilter] = useState<CampaignCompletionFilter>('ALL')
  const [campaignsPage, setCampaignsPage] = useState(1)

  const [campaignName, setCampaignName] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<CsvPreviewResult | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const [importing, setImporting] = useState(false)
  const [confirmImportOpen, setConfirmImportOpen] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [lastImportResult, setLastImportResult] = useState<CampaignImportResult | null>(null)
  const [linkLoadingDebtId, setLinkLoadingDebtId] = useState<string | null>(null)
  const [statusUpdatingDebtId, setStatusUpdatingDebtId] = useState<string | null>(null)
  const [campaignDueDateUpdating, setCampaignDueDateUpdating] = useState(false)
  const [campaignStatusUpdatingId, setCampaignStatusUpdatingId] = useState<string | null>(null)
  const [campaignDeletingId, setCampaignDeletingId] = useState<string | null>(null)
  const [campaignToDelete, setCampaignToDelete] = useState<CampaignSummary | null>(null)
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null)
  const [pendingDebtStatuses, setPendingDebtStatuses] = useState<Record<string, UiDebtStatus>>({})
  const [statusFilter, setStatusFilter] = useState<UiDebtFilter>('UNPAID')
  const [campaignDueDateLimit, setCampaignDueDateLimit] = useState('')

  const refreshCampaigns = useCallback(async () => {
    const items = await listCampaigns()
    setCampaigns(items)
    return items
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        await refreshCampaigns()
      } catch (error) {
        toast.error(getErrorMessage(error, 'Failed to load campaigns'))
      } finally {
        setCampaignsLoading(false)
      }
    }

    load()
  }, [refreshCampaigns])

  const handleSelectCampaign = useCallback(async (campaignId: string, page = 1) => {
    setSelectedCampaignId(campaignId)
    setSelectedCampaignLoading(true)
    setSelectedCampaignError(null)

    try {
      const details = await getCampaignById(campaignId, { page, pageSize: DETAILS_PAGE_SIZE })
      setSelectedCampaign(details)
      const firstUnpaidDebt = details.debts.find((debt) => debt.status !== 'PAID')
      setCampaignDueDateLimit(firstUnpaidDebt ? firstUnpaidDebt.dueDate.slice(0, 10) : '')
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to load campaign details')
      setSelectedCampaignError(message)
      setSelectedCampaign(null)
      toast.error(message)
    } finally {
      setSelectedCampaignLoading(false)
    }
  }, [])

  const handleFileChange = useCallback(async (nextFile: File | null) => {
    setFile(nextFile)
    setPreview(null)
    setPreviewError(null)
    setImportError(null)
    setLastImportResult(null)

    if (!nextFile) {
      return
    }

    if (!nextFile.name.toLowerCase().endsWith('.csv')) {
      setPreviewError('Please select a .csv file')
      return
    }

    try {
      const text = await nextFile.text()
      const result = previewCampaignCsv(text)
      setPreview(result)

      if (result.validRows === 0) {
        setPreviewError('No valid rows found. Please fix CSV rows before importing.')
      }
    } catch {
      setPreviewError('Unable to read CSV file')
    }
  }, [])

  const canImport = useMemo(() => {
    if (!file || !preview || importing) {
      return false
    }

    if (!campaignName.trim()) {
      return false
    }

    if (preview.missingRequiredColumns.length > 0) {
      return false
    }

    return preview.validRows > 0
  }, [campaignName, file, preview, importing])

  const handleImport = useCallback(async (): Promise<boolean> => {
    if (!file || !preview) {
      toast.error('Select a CSV file first')
      return false
    }

    setImporting(true)
    setImportError(null)

    try {
      const result = await importCampaignCsv({
        file,
        campaignName,
        description,
      })

      setLastImportResult(result)
      toast.success(
        `Campaign imported: ${result.stats.importedRows} debt(s) inserted. Emails sent: ${result.emailStats.sent}, failed: ${result.emailStats.failed}, skipped: ${result.emailStats.skipped}`
      )

      const fallbackCampaign: CampaignSummary = {
        id: result.campaign.id,
        name: result.campaign.name,
        description: result.campaign.description,
        status: result.campaign.status,
        createdAt: result.campaign.createdAt,
        updatedAt: result.campaign.createdAt,
        debtsCount: result.stats.importedRows,
      }

      // Optimistically show the imported campaign right away.
      setCampaigns((prev) => [fallbackCampaign, ...prev.filter((item) => item.id !== fallbackCampaign.id)])

      try {
        const items = await listCampaigns()
        const mergedItems = items.some((item) => item.id === fallbackCampaign.id)
          ? items
          : [fallbackCampaign, ...items]

        setCampaigns(mergedItems)
      } catch {
        // Keep optimistic list when refreshing fails.
      }

      await handleSelectCampaign(result.campaign.id, 1)

      setCampaignName('')
      setDescription('')
      setFile(null)
      setPreview(null)
      setPreviewError(null)
      setImportError(null)
      return true
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to import campaign CSV')
      setImportError(message)
      toast.error(message)
      return false
    } finally {
      setImporting(false)
    }
  }, [campaignName, description, file, handleSelectCampaign, preview])

  const handleConfirmImport = useCallback(async (event: MouseEvent<HTMLButtonElement>) => {
    // Keep dialog open by default; close only after a successful import.
    event.preventDefault()
    const success = await handleImport()
    if (success) {
      setConfirmImportOpen(false)
    }
  }, [handleImport])

  const renderedCampaigns = useMemo(() => {
    if (!lastImportResult) {
      return campaigns
    }

    if (campaigns.some((campaign) => campaign.id === lastImportResult.campaign.id)) {
      return campaigns
    }

    const fallbackCampaign: CampaignSummary = {
      id: lastImportResult.campaign.id,
      name: lastImportResult.campaign.name,
      description: lastImportResult.campaign.description,
      status: lastImportResult.campaign.status,
      createdAt: lastImportResult.campaign.createdAt,
      updatedAt: lastImportResult.campaign.createdAt,
      debtsCount: lastImportResult.stats.importedRows,
    }

    return [fallbackCampaign, ...campaigns]
  }, [campaigns, lastImportResult])

  const filteredCampaigns = useMemo(() => {
    const query = campaignSearch.trim().toLowerCase()
    return renderedCampaigns
      .filter((campaign) => {
        if (campaignCompletionFilter === 'DONE') {
          return campaign.status === 'COMPLETED'
        }

        if (campaignCompletionFilter === 'NOT_DONE') {
          return campaign.status !== 'COMPLETED'
        }

        return true
      })
      .filter((campaign) => (query ? campaign.name.toLowerCase().includes(query) : true))
  }, [campaignCompletionFilter, campaignSearch, renderedCampaigns])

  const campaignCounters = useMemo(() => {
    const total = renderedCampaigns.length
    const done = renderedCampaigns.filter((campaign) => campaign.status === 'COMPLETED').length
    return {
      total,
      done,
      notDone: total - done,
    }
  }, [renderedCampaigns])

  const totalCampaignPages = Math.max(1, Math.ceil(filteredCampaigns.length / CAMPAIGNS_PAGE_SIZE))

  useEffect(() => {
    setCampaignsPage(1)
  }, [campaignSearch, campaignCompletionFilter])

  useEffect(() => {
    setCampaignsPage((current) => Math.min(current, totalCampaignPages))
  }, [totalCampaignPages])

  const pagedCampaigns = useMemo(() => {
    const startIndex = (campaignsPage - 1) * CAMPAIGNS_PAGE_SIZE
    return filteredCampaigns.slice(startIndex, startIndex + CAMPAIGNS_PAGE_SIZE)
  }, [campaignsPage, filteredCampaigns])

  const handleOpenCustomerLink = useCallback(async (debtId: string) => {
    setLinkLoadingDebtId(debtId)

    try {
      const result = await getDebtPersonalLink(debtId)
      window.open(result.link, '_blank', 'noopener,noreferrer')
      toast.success('Customer link opened in a new tab')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to generate customer link'))
    } finally {
      setLinkLoadingDebtId(null)
    }
  }, [])

  const handleUpdateCampaignDueDateLimit = useCallback(async () => {
    if (!selectedCampaignId || !campaignDueDateLimit) {
      return
    }

    setCampaignDueDateUpdating(true)

    try {
      const dueDate = new Date(`${campaignDueDateLimit}T23:59:59.999Z`).toISOString()
      const result = await updateCampaignDueDate(selectedCampaignId, { dueDate })

      setSelectedCampaign((prev) => {
        if (!prev) return prev

        return {
          ...prev,
          debts: prev.debts.map((debt) =>
            debt.status === 'PAID'
              ? debt
              : {
                  ...debt,
                  dueDate: result.dueDate,
                },
          ),
        }
      })

      toast.success(`Date limit updated for ${result.updatedCount} user(s)`)
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update campaign date limit'))
    } finally {
      setCampaignDueDateUpdating(false)
    }
  }, [campaignDueDateLimit, selectedCampaignId])

  const handleDebtStatusSelection = useCallback((debtId: string, status: UiDebtStatus) => {
    setPendingDebtStatuses((prev) => ({ ...prev, [debtId]: status }))
  }, [])

  const handleUpdateDebtStatus = useCallback(
    async (debtId: string, currentStatus: DebtStatus) => {
      const currentUiStatus = mapDebtStatusToUiStatus(currentStatus)
      const nextUiStatus = pendingDebtStatuses[debtId] ?? currentUiStatus
      const nextStatus = mapUiStatusToDebtStatus(nextUiStatus)

      if (nextUiStatus === currentUiStatus || !selectedCampaignId) {
        return
      }

      setStatusUpdatingDebtId(debtId)

      try {
        await updateDebt(debtId, {
          status: nextStatus,
          ...(nextStatus !== 'PROMISE_TO_PAY' ? { promiseDate: null } : {}),
        })

        toast.success('Debt status updated')

        setSelectedCampaign((prev) => {
          if (!prev) return prev

          return {
            ...prev,
            debts: prev.debts.map((debt) =>
              debt.id === debtId
                ? {
                    ...debt,
                    status: nextStatus,
                    promiseDate: nextStatus !== 'PROMISE_TO_PAY' ? null : debt.promiseDate,
                  }
                : debt,
            ),
          }
        })

        setPendingDebtStatuses((prev) => ({ ...prev, [debtId]: nextUiStatus }))
      } catch (error) {
        toast.error(getErrorMessage(error, 'Failed to update debt status'))
      } finally {
        setStatusUpdatingDebtId(null)
      }
    },
    [pendingDebtStatuses, selectedCampaignId],
  )

  const handleToggleCampaignDone = useCallback(async (campaign: CampaignSummary) => {
    const nextStatus = campaign.status === 'COMPLETED' ? 'ACTIVE' : 'COMPLETED'
    setCampaignStatusUpdatingId(campaign.id)

    try {
      const updated = await updateCampaignStatus(campaign.id, { status: nextStatus })

      setCampaigns((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))

      setSelectedCampaign((prev) => {
        if (!prev || prev.id !== updated.id) return prev
        return {
          ...prev,
          status: updated.status,
          updatedAt: updated.updatedAt,
        }
      })

      toast.success(nextStatus === 'COMPLETED' ? 'Campaign marked as done' : 'Campaign marked as not done')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to update campaign status'))
    } finally {
      setCampaignStatusUpdatingId(null)
    }
  }, [])

  const handleConfirmDeleteCampaign = useCallback(async () => {
    if (!campaignToDelete) return

    setCampaignDeletingId(campaignToDelete.id)

    try {
      await deleteCampaign(campaignToDelete.id)

      setCampaigns((prev) => prev.filter((item) => item.id !== campaignToDelete.id))

      if (selectedCampaignId === campaignToDelete.id) {
        setSelectedCampaignId(null)
        setSelectedCampaign(null)
        setSelectedCampaignError(null)
      }

      toast.success('Campaign deleted')
      setCampaignToDelete(null)
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to delete campaign'))
    } finally {
      setCampaignDeletingId(null)
    }
  }, [campaignToDelete, selectedCampaignId])

  const displayedDebts = useMemo(() => {
    if (!selectedCampaign) {
      return []
    }

    if (statusFilter === 'ALL') {
      return selectedCampaign.debts
    }

    return selectedCampaign.debts.filter(
      (debt) => mapDebtStatusToUiStatus(debt.status as DebtStatus) === statusFilter,
    )
  }, [selectedCampaign, statusFilter])

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:gap-8 md:p-8 overflow-auto">
      <div>
        <h1 className="text-3xl font-bold">Campaigns</h1>
        <p className="text-muted-foreground mt-1">
          Upload debts from CSV with a pre-import preview, then browse imported campaigns.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Import CSV as Campaign</CardTitle>
          <CardDescription>
            Required CSV columns: <code>fullName</code>, <code>email</code>, <code>amount</code>, <code>dueDate</code>.
            Optional columns: <code>phone</code>, <code>address</code>, <code>status</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Campaign name</label>
              <Input
                value={campaignName}
                onChange={(event) => setCampaignName(event.target.value)}
                placeholder="March Recovery Batch"
                maxLength={120}
                disabled={importing}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">CSV file</label>
              <Input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
                disabled={importing}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description (optional)</label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Imported from manager export 2026-03-05"
              maxLength={400}
              disabled={importing}
            />
          </div>

          {previewError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {previewError}
            </div>
          )}

          {preview && (
            <div className="space-y-3 rounded-md border bg-muted/20 p-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="outline">Rows: {preview.totalRows}</Badge>
                <Badge variant="secondary">Valid: {preview.validRows}</Badge>
                <Badge variant={preview.invalidRows > 0 ? 'destructive' : 'outline'}>
                  Invalid: {preview.invalidRows}
                </Badge>
                <Badge variant="outline">
                  Delimiter: {preview.delimiter === '\t' ? 'TAB' : preview.delimiter}
                </Badge>
              </div>

              {preview.missingRequiredColumns.length > 0 && (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                  Missing required columns: {preview.missingRequiredColumns.join(', ')}
                </div>
              )}

              {preview.headers.length > 0 && preview.previewRows.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">CSV table preview (first {preview.previewRows.length} rows)</p>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Row</TableHead>
                          {preview.headers.map((header, index) => (
                            <TableHead key={`${header || 'column'}-${index}`}>
                              {header || `Column ${index + 1}`}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.previewRows.map((row) => (
                          <TableRow key={`preview-row-${row.rowNumber}`}>
                            <TableCell>{row.rowNumber}</TableCell>
                            {preview.headers.map((_, index) => (
                              <TableCell key={`preview-cell-${row.rowNumber}-${index}`}>
                                {row.values[index] || ''}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {preview.issues.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Preview errors (first 15)</p>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Row</TableHead>
                          <TableHead>Reason</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.issues.slice(0, 15).map((issue) => (
                          <TableRow key={`${issue.rowNumber}-${issue.reason}`}>
                            <TableCell>{issue.rowNumber}</TableCell>
                            <TableCell>{issue.reason}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}

          <Button onClick={() => setConfirmImportOpen(true)} disabled={!canImport}>
            {importing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Confirm And Import CSV
              </>
            )}
          </Button>

          {importError && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {importError}
            </div>
          )}

          <AlertDialog open={confirmImportOpen} onOpenChange={setConfirmImportOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm CSV Import</AlertDialogTitle>
                <AlertDialogDescription>
                  Please review the preview before confirming import.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="space-y-2 text-sm">
                <p>
                  File: <span className="font-medium">{file?.name ?? 'No file selected'}</span>
                </p>
                <p>
                  Campaign name:{' '}
                  <span className="font-medium">{campaignName.trim() || '(Missing)'}</span>
                </p>
                <p>
                  Preview: <span className="font-medium">{preview?.validRows ?? 0} valid</span> /{' '}
                  <span className="font-medium">{preview?.invalidRows ?? 0} invalid</span>
                </p>
              </div>

              <AlertDialogFooter>
                <AlertDialogCancel disabled={importing}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmImport} disabled={!canImport || importing}>
                  {importing ? 'Importing...' : 'Confirm Import'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {lastImportResult && (
            <div className="rounded-md border bg-primary/5 p-4 text-sm">
              <p className="font-medium">Last import completed</p>
              <p className="mt-1 text-muted-foreground">
                Campaign <span className="font-medium text-foreground">{lastImportResult.campaign.name}</span>:
                {' '}
                {lastImportResult.stats.importedRows} imported / {lastImportResult.stats.skippedRows} skipped.
              </p>
              <p className="mt-1 text-muted-foreground">
                Emails: {lastImportResult.emailStats.sent} sent / {lastImportResult.emailStats.failed} failed / {lastImportResult.emailStats.skipped} skipped.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Imported Campaigns</CardTitle>
          <CardDescription>Latest campaigns in your workspace with quick completion and delete actions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">Total: {campaignCounters.total}</Badge>
            <Badge variant="secondary">Done: {campaignCounters.done}</Badge>
            <Badge variant="outline">Not done: {campaignCounters.notDone}</Badge>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <Input
              value={campaignSearch}
              onChange={(event) => setCampaignSearch(event.target.value)}
              placeholder="Search by campaign name"
            />

            <Select
              value={campaignCompletionFilter}
              onValueChange={(value) => setCampaignCompletionFilter(value as CampaignCompletionFilter)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter completion" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All campaigns</SelectItem>
                <SelectItem value="DONE">Done only</SelectItem>
                <SelectItem value="NOT_DONE">Not done only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {campaignsLoading ? (
            <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
              Loading campaigns...
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
              No campaigns found for this search.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-3">
                {pagedCampaigns.map((campaign) => {
                const isSelected = selectedCampaignId === campaign.id
                const isLoadingSelected = selectedCampaignLoading && isSelected
                const isDone = campaign.status === 'COMPLETED'
                const isUpdatingStatus = campaignStatusUpdatingId === campaign.id
                const isDeleting = campaignDeletingId === campaign.id

                return (
                  <div
                    key={campaign.id}
                    className={`cursor-pointer rounded-lg border p-4 transition-colors hover:bg-muted/30 ${isSelected ? 'border-primary/50 bg-primary/5 shadow-sm' : ''}`}
                    onClick={() => handleSelectCampaign(campaign.id, 1)}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="space-y-1.5">
                        <p className="font-semibold leading-none">{campaign.name}</p>
                        {campaign.description ? (
                          <p className="text-xs text-muted-foreground line-clamp-2">{campaign.description}</p>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant={isDone ? 'secondary' : getStatusVariant(campaign.status)}>
                            {isDone ? 'Done' : 'In progress'}
                          </Badge>
                          <Badge variant="outline">Debts: {campaign.debtsCount}</Badge>
                          <span>Updated: {formatDateTime(campaign.updatedAt)}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant={isDone ? 'outline' : 'secondary'}
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation()
                            void handleToggleCampaignDone(campaign)
                          }}
                          disabled={isUpdatingStatus || isDeleting}
                        >
                          {isUpdatingStatus ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle2 className="mr-1.5 h-4 w-4" />
                              {isDone ? 'Mark not done' : 'Mark done'}
                            </>
                          )}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleSelectCampaign(campaign.id, 1)
                          }}
                          disabled={isLoadingSelected || isDeleting}
                        >
                          {isLoadingSelected ? <Loader2 className="h-4 w-4 animate-spin" /> : 'View'}
                        </Button>

                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation()
                            setCampaignToDelete(campaign)
                          }}
                          disabled={isUpdatingStatus || isDeleting}
                        >
                          {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                )
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Showing {pagedCampaigns.length} of {filteredCampaigns.length} campaign(s)
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCampaignsPage((current) => Math.max(1, current - 1))}
                    disabled={campaignsPage <= 1}
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Page {campaignsPage} / {totalCampaignPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCampaignsPage((current) => Math.min(totalCampaignPages, current + 1))}
                    disabled={campaignsPage >= totalCampaignPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}

          <AlertDialog open={Boolean(campaignToDelete)} onOpenChange={(open) => (!open ? setCampaignToDelete(null) : null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete campaign?</AlertDialogTitle>
                <AlertDialogDescription>
                  {campaignToDelete
                    ? `This will permanently delete "${campaignToDelete.name}" and its campaign debts.`
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Campaign Details</CardTitle>
          <CardDescription>Selected campaign summary with imported users.</CardDescription>
        </CardHeader>
        <CardContent>
          {selectedCampaignLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading campaign details...
            </div>
          ) : selectedCampaignError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {selectedCampaignError}
            </div>
          ) : !selectedCampaign ? (
            <p className="text-sm text-muted-foreground">Select a campaign to view details.</p>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <div>
                  <p className="text-muted-foreground">Name</p>
                  <p className="font-medium">{selectedCampaign.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant={getStatusVariant(selectedCampaign.status)}>{selectedCampaign.status}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Debts count</p>
                  <p className="font-medium">{selectedCampaign.debtsCount}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Description</p>
                  <p>{selectedCampaign.description || 'No description'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p>{formatDateTime(selectedCampaign.createdAt)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Updated</p>
                  <p>{formatDateTime(selectedCampaign.updatedAt)}</p>
                </div>
              </div>

              <CampaignEmailStatsCard campaignId={selectedCampaign.id} />

              <div className="space-y-2">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="space-y-2">
                    <p className="font-medium">Campaign date limit (all unpaid users)</p>
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={campaignDueDateLimit}
                        onChange={(event) => setCampaignDueDateLimit(event.target.value)}
                        className="w-44"
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleUpdateCampaignDueDateLimit}
                        disabled={!campaignDueDateLimit || campaignDueDateUpdating}
                      >
                        {campaignDueDateUpdating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Set for campaign'
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Status filter</p>
                    <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as UiDebtFilter)}>
                      <SelectTrigger className="w-44">
                        <SelectValue placeholder="Filter status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All statuses</SelectItem>
                        <SelectItem value="UNPAID">Unpaid</SelectItem>
                        <SelectItem value="PROMISE">Promise</SelectItem>
                        <SelectItem value="PAID">Paid</SelectItem>
                        <SelectItem value="OVERDUE">Overdue</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <p className="font-medium">Users</p>
                {displayedDebts.length === 0 ? (
                  <p className="text-muted-foreground">
                    No users found for this status filter in this campaign.
                  </p>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Contact</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Date limit</TableHead>
                          <TableHead>Promised date</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Link opens</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {displayedDebts.map((debt) => (
                          <Fragment key={debt.id}>
                          <TableRow>
                            <TableCell className="font-medium">{debt.client.fullName}</TableCell>
                            <TableCell>
                              <div className="text-xs">
                                <p>{debt.client.email || '-'}</p>
                                <p className="text-muted-foreground">{debt.client.phone || '-'}</p>
                              </div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">{formatAmount(debt.amount)}</TableCell>
                            <TableCell className="whitespace-nowrap">{formatDate(debt.dueDate)}</TableCell>
                            <TableCell className="whitespace-nowrap">
                              {debt.promiseDate ? formatDate(debt.promiseDate) : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  debt.emailStatus === 'CLICKED'
                                    ? 'default'
                                    : debt.emailStatus === 'SENT'
                                      ? 'secondary'
                                      : 'outline'
                                }
                              >
                                {debt.emailStatus === 'CLICKED'
                                  ? 'Clicked'
                                  : debt.emailStatus === 'SENT'
                                    ? 'Sent'
                                    : 'Not sent'}
                              </Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {debt.linkOpenCount > 0 ? (
                                <div className="text-xs">
                                  <p className="font-medium">{debt.linkOpenCount}</p>
                                  <p className="text-muted-foreground">
                                    Last: {formatDateTime(debt.linkOpenTimes[0])}
                                  </p>
                                  {debt.linkOpenTimes.length > 1 ? (
                                    <p
                                      className="text-muted-foreground"
                                      title={debt.linkOpenTimes.map((time) => formatDateTime(time)).join('\n')}
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
                              <Badge variant={getUiDebtStatusVariant(mapDebtStatusToUiStatus(debt.status as DebtStatus))}>
                                {formatUiDebtStatus(mapDebtStatusToUiStatus(debt.status as DebtStatus))}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setEditingDebtId((current) => (current === debt.id ? null : debt.id))
                                  }
                                >
                                  {editingDebtId === debt.id ? 'Close' : 'Edit'}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenCustomerLink(debt.id)}
                                  disabled={linkLoadingDebtId === debt.id}
                                >
                                  {linkLoadingDebtId === debt.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    'Open'
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {editingDebtId === debt.id && (
                            <TableRow>
                              <TableCell colSpan={8} className="bg-muted/20">
                                <div className="grid gap-4 lg:grid-cols-1">
                                  <div className="space-y-2">
                                    <p className="text-xs font-medium text-muted-foreground">Update status</p>
                                    <div className="flex items-center gap-2">
                                      <Select
                                        value={pendingDebtStatuses[debt.id] ?? mapDebtStatusToUiStatus(debt.status as DebtStatus)}
                                        onValueChange={(value) =>
                                          handleDebtStatusSelection(debt.id, value as UiDebtStatus)
                                        }
                                      >
                                        <SelectTrigger className="w-47.5">
                                          <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {MANUAL_STATUS_OPTIONS.map((statusOption) => (
                                            <SelectItem key={statusOption} value={statusOption}>
                                              {formatUiDebtStatus(statusOption)}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => handleUpdateDebtStatus(debt.id, debt.status as DebtStatus)}
                                        disabled={statusUpdatingDebtId === debt.id}
                                      >
                                        {statusUpdatingDebtId === debt.id ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          'Save'
                                        )}
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                          </Fragment>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <p className="text-xs text-muted-foreground">
                    Showing {displayedDebts.length} row(s) for filter: {statusFilter.toLowerCase()}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleSelectCampaign(selectedCampaign.id, selectedCampaign.pagination.page - 1)
                      }
                      disabled={selectedCampaignLoading || selectedCampaign.pagination.page <= 1}
                    >
                      Previous
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Page {selectedCampaign.pagination.page} / {selectedCampaign.pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        handleSelectCampaign(selectedCampaign.id, selectedCampaign.pagination.page + 1)
                      }
                      disabled={
                        selectedCampaignLoading ||
                        selectedCampaign.pagination.page >= selectedCampaign.pagination.totalPages
                      }
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
