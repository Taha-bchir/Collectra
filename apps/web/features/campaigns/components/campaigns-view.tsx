'use client'

import { type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, CalendarDays, CheckCircle2, Layers3, Loader2, Sparkles, Trash2, Upload } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import {
  ApiError,
  type CampaignImportResult,
  type CampaignSummary,
  importCampaignCsv,
  listCampaigns,
  updateCampaignStatus,
  deleteCampaign,
} from '@/features/campaigns/services/campaign-service'
import { previewCampaignCsv, type CsvPreviewResult } from '@/features/campaigns/utils/csv-preview'
import { CustomerTrackingView } from './customer-tracking-view'

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

function formatDateOnly(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString()
}

function getTodayAtMidnight() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

function toDateInputValue(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}



function getStatusVariant(status: CampaignSummary['status']) {
  if (status === 'ACTIVE') return 'default'
  if (status === 'ARCHIVED') return 'outline'
  if (status === 'COMPLETED') return 'secondary'
  return 'secondary'
}

const CAMPAIGNS_PAGE_SIZE = 4
type CampaignCompletionFilter = 'ALL' | 'DONE' | 'NOT_DONE'

export function CampaignsView({ mode = 'create' }: { mode?: 'create' | 'tables' }) {
  const showCreateSection = mode === 'create'
  const router = useRouter()
  const searchParams = useSearchParams()
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([])
  const [campaignsLoading, setCampaignsLoading] = useState(true)

  const [campaignSearch, setCampaignSearch] = useState('')
  const [campaignCompletionFilter, setCampaignCompletionFilter] = useState<CampaignCompletionFilter>('ALL')
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('ALL')
  const [campaignsPage, setCampaignsPage] = useState(1)

  const [campaignName, setCampaignName] = useState('')
  const [description, setDescription] = useState('')
  const [importDueDate, setImportDueDate] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<CsvPreviewResult | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const [importing, setImporting] = useState(false)
  const [confirmImportOpen, setConfirmImportOpen] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [lastImportResult, setLastImportResult] = useState<CampaignImportResult | null>(null)
  const [campaignStatusUpdatingId, setCampaignStatusUpdatingId] = useState<string | null>(null)
  const [campaignDeletingId, setCampaignDeletingId] = useState<string | null>(null)
  const [campaignToDelete, setCampaignToDelete] = useState<CampaignSummary | null>(null)
  const [fileInputKey, setFileInputKey] = useState(0)
  const [dueDatePickerOpen, setDueDatePickerOpen] = useState(false)
  const previewRequestIdRef = useRef(0)

  const preferredCampaignId = useMemo(() => searchParams.get('campaignId')?.trim() ?? '', [searchParams])
  const todayDate = useMemo(() => getTodayAtMidnight(), [])
  const minDueDate = useMemo(() => toDateInputValue(todayDate), [todayDate])
  const selectedImportDueDate = useMemo(() => {
    if (!importDueDate) {
      return undefined
    }

    const selected = new Date(`${importDueDate}T00:00:00`)
    if (Number.isNaN(selected.getTime())) {
      return undefined
    }

    return selected
  }, [importDueDate])

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

  const handleFileChange = useCallback(async (nextFile: File | null) => {
    const requestId = previewRequestIdRef.current + 1
    previewRequestIdRef.current = requestId

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

      // Ignore stale parsing results when user switches files quickly.
      if (previewRequestIdRef.current !== requestId) {
        return
      }

      const result = previewCampaignCsv(text)
      setPreview(result)

      if (result.validRows === 0) {
        setPreviewError('No valid rows found. Please fix CSV rows before importing.')
      }
    } catch {
      if (previewRequestIdRef.current !== requestId) {
        return
      }

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

    if (!importDueDate) {
      return false
    }

    if (importDueDate < minDueDate) {
      return false
    }

    if (preview.missingRequiredColumns.length > 0) {
      return false
    }

    return preview.validRows > 0
  }, [campaignName, importDueDate, file, preview, importing, minDueDate])

  const handleImport = useCallback(async (): Promise<boolean> => {
    if (!file || !preview) {
      toast.error('Select a CSV file first')
      return false
    }

    if (importDueDate < minDueDate) {
      const message = `Campaign due date must be today or later (${formatDateOnly(minDueDate)}).`
      setImportError(message)
      toast.error(message)
      return false
    }

    setImporting(true)
    setImportError(null)

    try {
      const result = await importCampaignCsv({
        file,
        campaignName,
        dueDate: importDueDate,
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

      setCampaignName('')
      setDescription('')
      setImportDueDate('')
      setFile(null)
      setFileInputKey((current) => current + 1)
      setPreview(null)
      setPreviewError(null)
      setImportError(null)
      router.push(`/campaigns/tables?campaignId=${encodeURIComponent(result.campaign.id)}`)
      return true
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to import campaign CSV')
      setImportError(message)
      toast.error(message)
      return false
    } finally {
      setImporting(false)
    }
  }, [campaignName, description, file, importDueDate, preview, router, minDueDate])

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
  const preferredCampaignPage = useMemo(() => {
    if (showCreateSection || !preferredCampaignId) {
      return null
    }

    const preferredIndex = filteredCampaigns.findIndex((campaign) => campaign.id === preferredCampaignId)
    if (preferredIndex === -1) {
      return null
    }

    return Math.floor(preferredIndex / CAMPAIGNS_PAGE_SIZE) + 1
  }, [filteredCampaigns, preferredCampaignId, showCreateSection])

  useEffect(() => {
    if (showCreateSection || !preferredCampaignId || campaigns.length === 0) {
      return
    }

    if (campaigns.some((campaign) => campaign.id === preferredCampaignId)) {
      setSelectedCampaignId(preferredCampaignId)
    }
  }, [campaigns, preferredCampaignId, showCreateSection])

  useEffect(() => {
    if (preferredCampaignPage === null) {
      return
    }

    setCampaignsPage(preferredCampaignPage)
  }, [preferredCampaignPage])

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

  const hasCampaignFilters = campaignSearch.trim().length > 0 || campaignCompletionFilter !== 'ALL'


  const handleToggleCampaignDone = useCallback(async (campaign: CampaignSummary) => {
    const nextStatus = campaign.status === 'COMPLETED' ? 'ACTIVE' : 'COMPLETED'
    setCampaignStatusUpdatingId(campaign.id)

    try {
      const updated = await updateCampaignStatus(campaign.id, { status: nextStatus })

      setCampaigns((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))

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
      setSelectedCampaignId((prev) => (prev === campaignToDelete.id ? 'ALL' : prev))

      toast.success('Campaign deleted')
      setCampaignToDelete(null)
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to delete campaign'))
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
                {showCreateSection
                  ? 'Import CSV files, preview data before sending, and create a campaign with confidence.'
                  : 'Track all campaigns you created, manage their status, and inspect customer records in one place.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={showCreateSection ? '/campaigns/tables' : '/create'}>
                {showCreateSection ? 'Open Tables' : 'Create Campaign'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="relative z-10 mt-6 grid gap-3 text-xs md:grid-cols-3">
          <div className="rounded-2xl border bg-background/80 p-4 backdrop-blur">
            <p className="font-medium">Structured imports</p>
            <p className="mt-1 text-muted-foreground">Validate rows before the campaign is created.</p>
          </div>
          <div className="rounded-2xl border bg-background/80 p-4 backdrop-blur">
            <p className="font-medium">Clean campaign tracking</p>
            <p className="mt-1 text-muted-foreground">Monitor completion, edits, and deletion from tables.</p>
          </div>
          <div className="rounded-2xl border bg-background/80 p-4 backdrop-blur">
            <p className="font-medium">Fast workspace navigation</p>
            <p className="mt-1 text-muted-foreground">Jump between creation and review without friction.</p>
          </div>
        </div>
      </div>

      {showCreateSection ? (
        <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <Card className="border-dashed bg-muted/20">
            <CardHeader>
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Layers3 className="h-4 w-4" />
                Import checklist
              </div>
              <CardTitle className="text-2xl">Create a new campaign</CardTitle>
              <CardDescription>
                Use a CSV file with the required columns and review the preview before importing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border bg-background p-4">
                <p className="text-sm font-medium">Required columns</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  <code>fullName</code>, <code>email</code>, <code>phone</code>, <code>amount</code>
                </p>
              </div>
              <div className="rounded-2xl border bg-background p-4">
                <p className="text-sm font-medium">Optional columns</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  <code>address</code>, <code>status</code>
                </p>
              </div>
              <div className="rounded-2xl border bg-primary/5 p-4 text-sm text-muted-foreground">
                Preview first, import second. That keeps bad rows from polluting the campaign.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Import CSV as Campaign</CardTitle>
              <CardDescription>
                Fill the campaign details, preview the CSV, then confirm the import.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
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
                  <label className="text-sm font-medium">Campaign due date</label>
                  <Popover open={dueDatePickerOpen} onOpenChange={setDueDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        disabled={importing}
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {importDueDate ? formatDateOnly(importDueDate) : 'Select due date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedImportDueDate}
                        onSelect={(date) => {
                          if (!date) {
                            return
                          }

                          setImportDueDate(toDateInputValue(date))
                          setDueDatePickerOpen(false)
                        }}
                        disabled={{ before: todayDate }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">CSV file</label>
                  <Input
                    key={fileInputKey}
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
                <div className="space-y-3 rounded-2xl border bg-muted/20 p-4">
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
                      <div className="overflow-x-auto rounded-md border bg-background">
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
                      <div className="overflow-x-auto rounded-md border bg-background">
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
                      Due date: <span className="font-medium">{importDueDate || '(Missing)'}</span>
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
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="space-y-1 pb-3">
                <CardDescription>Total campaigns</CardDescription>
                <CardTitle className="text-3xl">{campaignCounters.total}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="space-y-1 pb-3">
                <CardDescription>Done campaigns</CardDescription>
                <CardTitle className="text-3xl">{campaignCounters.done}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="space-y-1 pb-3">
                <CardDescription>In progress</CardDescription>
                <CardTitle className="text-3xl">{campaignCounters.notDone}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>Imported Campaigns</CardTitle>
                  <CardDescription>Search, filter, and manage the campaigns already imported in your workspace.</CardDescription>
                </div>
                <Button asChild variant="outline">
                  <Link href="/create">
                    <Upload className="mr-2 h-4 w-4" />
                    Create new campaign
                  </Link>
                </Button>
              </div>
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
                <div className="rounded-2xl border p-6 text-center text-sm text-muted-foreground">
                  Loading campaigns...
                </div>
              ) : filteredCampaigns.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-8 text-center">
                  <p className="font-medium">
                    {campaigns.length === 0 ? 'No campaigns have been created yet.' : 'No campaigns match the current filters.'}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {campaigns.length === 0
                      ? 'Create your first campaign to start managing imported debt rows.'
                      : 'Clear the search or filter to see more results.'}
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <Button asChild>
                      <Link href="/create">Create Campaign</Link>
                    </Button>
                    {hasCampaignFilters && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setCampaignSearch('')
                          setCampaignCompletionFilter('ALL')
                        }}
                      >
                        Clear filters
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-3">
                    {pagedCampaigns.map((campaign) => {
                      const isDone = campaign.status === 'COMPLETED'
                      const isUpdatingStatus = campaignStatusUpdatingId === campaign.id
                      const isDeleting = campaignDeletingId === campaign.id
                      const isSelected = selectedCampaignId === campaign.id

                      return (
                        <div
                          key={campaign.id}
                          className={`cursor-pointer rounded-2xl border p-4 transition-colors hover:bg-muted/30 ${isSelected ? 'border-primary bg-primary/5' : 'bg-background'}`}
                          onClick={() => {
                            setSelectedCampaignId((prev) => (prev === campaign.id ? 'ALL' : campaign.id))
                          }}
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold leading-none">{campaign.name}</p>
                                {isSelected && <Badge variant="outline">Selected</Badge>}
                              </div>
                              {campaign.description ? (
                                <p className="line-clamp-2 text-xs text-muted-foreground">{campaign.description}</p>
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

          <CustomerTrackingView campaigns={campaigns} selectedCampaignId={selectedCampaignId} />
        </>
      )}
    </div>
  )
}
