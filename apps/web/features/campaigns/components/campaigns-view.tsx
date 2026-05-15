'use client'

import { type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, CalendarDays, Layers3, Loader2, PlusCircle, Upload } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import {
  ApiError,
  type CampaignImportResult,
  type CampaignSummary,
  importCampaignCsv,
  listCampaigns,
} from '@/features/campaigns/services/campaign-service'
import { previewCampaignCsv, type CsvPreviewResult } from '@/features/campaigns/utils/csv-preview'
import { CustomerTrackingView } from './customer-tracking-view'

const CREATE_CAMPAIGN_DRAFT_STORAGE_KEY = 'collectra:create-campaign-draft'

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return error.message
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

function formatDateOnly(value: string) {
  // Display dates as day-month-year for consistency
  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString('en-GB')
  } catch {
    return String(value)
  }
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



export function CampaignsView({
  mode = 'create',
  preferredCampaignId = '',
}: {
  mode?: 'create' | 'tables'
  preferredCampaignId?: string
}) {
  const showCreateSection = mode === 'create'
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([])

  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(preferredCampaignId || 'ALL')

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
  const [fileInputKey, setFileInputKey] = useState(0)
  const [dueDatePickerOpen, setDueDatePickerOpen] = useState(false)
  const previewRequestIdRef = useRef(0)

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
      }
    }

    load()
  }, [refreshCampaigns])

  useEffect(() => {
    if (!showCreateSection || typeof window === 'undefined') {
      return
    }

    const raw = window.localStorage.getItem(CREATE_CAMPAIGN_DRAFT_STORAGE_KEY)
    if (!raw) {
      return
    }

    try {
      const parsed = JSON.parse(raw) as { campaignName?: string; description?: string; importDueDate?: string }
      setCampaignName(parsed.campaignName ?? '')
      setDescription(parsed.description ?? '')
      setImportDueDate(parsed.importDueDate ?? '')
    } catch {
      window.localStorage.removeItem(CREATE_CAMPAIGN_DRAFT_STORAGE_KEY)
    }
  }, [showCreateSection])

  useEffect(() => {
    if (!showCreateSection || typeof window === 'undefined') {
      return
    }

    const hasDraft = Boolean(campaignName.trim() || description.trim() || importDueDate)
    if (!hasDraft) {
      window.localStorage.removeItem(CREATE_CAMPAIGN_DRAFT_STORAGE_KEY)
      return
    }

    window.localStorage.setItem(
      CREATE_CAMPAIGN_DRAFT_STORAGE_KEY,
      JSON.stringify({
        campaignName,
        description,
        importDueDate,
      }),
    )
  }, [campaignName, description, importDueDate, showCreateSection])

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
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(CREATE_CAMPAIGN_DRAFT_STORAGE_KEY)
      }
      router.push(`/campaigns/tables/${encodeURIComponent(result.campaign.id)}`)
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

  useEffect(() => {
    if (showCreateSection || campaigns.length === 0) {
      return
    }

    const visibleCampaigns = campaigns.filter((campaign) => campaign.status !== 'ARCHIVED')
    const campaignPool = visibleCampaigns.length > 0 ? visibleCampaigns : campaigns

    if (preferredCampaignId) {
      if (campaignPool.some((campaign) => campaign.id === preferredCampaignId)) {
        setSelectedCampaignId(preferredCampaignId)
        return
      }
    }

    if (campaignPool.some((campaign) => campaign.id === selectedCampaignId)) {
      return
    }

    setSelectedCampaignId(campaignPool[0]!.id)
  }, [campaigns, preferredCampaignId, selectedCampaignId, showCreateSection])

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-auto p-4 md:gap-8 md:p-8">
      {showCreateSection ? (
        <>
          <div className="relative overflow-hidden rounded-3xl border bg-linear-to-br from-background via-background to-muted/40 p-6 shadow-sm">
            <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl space-y-3">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Campaigns</h1>
                  <p className="mt-2 max-w-xl text-sm text-muted-foreground md:text-base">
                    Import CSV files, preview data before sending, and create a campaign with confidence.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline">
                  <Link href="/campaigns/tables">
                    Open Tables
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
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Campaign Tables</h1>
              <p className="text-sm text-muted-foreground">Explore customer tracking and campaign debt records.</p>
            </div>

            <Button asChild>
              <Link href="/create">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Campaign
              </Link>
            </Button>
          </div>

          <CustomerTrackingView campaigns={campaigns} campaignId={selectedCampaignId} />
        </>
      )}
    </div>
  )
}
