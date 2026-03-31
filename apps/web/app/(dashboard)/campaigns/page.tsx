'use client'

import { type MouseEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Upload } from 'lucide-react'
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { CampaignEmailStatsCard } from '@/components/campaign-email-stats'
import {
  ApiError,
  type CampaignDetails,
  type CampaignImportResult,
  type CampaignSummary,
  getDebtPersonalLink,
  getCampaignById,
  importCampaignCsv,
  listCampaigns,
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

function formatDebtStatus(status: string) {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function getDebtStatusVariant(status: string) {
  if (status === 'PAID') return 'default'
  if (status === 'OVERDUE_AFTER_PROMISE') return 'destructive'
  if (status === 'PROMISE_TO_PAY') return 'secondary'
  return 'outline'
}

function getStatusVariant(status: CampaignSummary['status']) {
  if (status === 'ACTIVE') return 'default'
  if (status === 'ARCHIVED') return 'outline'
  if (status === 'COMPLETED') return 'secondary'
  return 'secondary'
}

const DETAILS_PAGE_SIZE = 12

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([])
  const [campaignsLoading, setCampaignsLoading] = useState(true)

  const [selectedCampaign, setSelectedCampaign] = useState<CampaignDetails | null>(null)
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)
  const [selectedCampaignLoading, setSelectedCampaignLoading] = useState(false)

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

    try {
      const details = await getCampaignById(campaignId, { page, pageSize: DETAILS_PAGE_SIZE })
      setSelectedCampaign(details)
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to load campaign details'))
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

    if (preview.missingRequiredColumns.length > 0) {
      return false
    }

    return preview.validRows > 0
  }, [file, preview, importing])

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

  const handleCopyCustomerLink = useCallback(async (debtId: string) => {
    setLinkLoadingDebtId(debtId)

    try {
      const result = await getDebtPersonalLink(debtId)
      await navigator.clipboard.writeText(result.link)
      toast.success('Customer link copied to clipboard')
    } catch (error) {
      toast.error(getErrorMessage(error, 'Failed to copy customer link'))
    } finally {
      setLinkLoadingDebtId(null)
    }
  }, [])

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
            Required CSV columns: <code>fullName</code>, <code>amount</code>, <code>dueDate</code>.
            Optional columns: <code>email</code>, <code>phone</code>, <code>address</code>, <code>status</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Campaign name (optional)</label>
              <Input
                value={campaignName}
                onChange={(event) => setCampaignName(event.target.value)}
                placeholder="March Recovery Batch"
                maxLength={120}
                disabled={importing}
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
                  <span className="font-medium">{campaignName.trim() || '(Use file name)'}</span>
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
          <CardDescription>Latest campaigns in your current workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Debts</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaignsLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      Loading campaigns...
                    </TableCell>
                  </TableRow>
                ) : renderedCampaigns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No campaigns found. Import your first CSV.
                    </TableCell>
                  </TableRow>
                ) : (
                  renderedCampaigns.map((campaign) => (
                    <TableRow key={campaign.id}>
                      <TableCell className="font-medium">{campaign.name}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(campaign.status)}>{campaign.status}</Badge>
                      </TableCell>
                      <TableCell>{campaign.debtsCount}</TableCell>
                      <TableCell>{formatDateTime(campaign.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSelectCampaign(campaign.id, 1)}
                          disabled={selectedCampaignLoading && selectedCampaignId === campaign.id}
                        >
                          {selectedCampaignLoading && selectedCampaignId === campaign.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'View'
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Campaign Details</CardTitle>
          <CardDescription>Selected campaign summary with imported users.</CardDescription>
        </CardHeader>
        <CardContent>
          {!selectedCampaign ? (
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
                <p className="font-medium">Imported users and debts</p>
                {selectedCampaign.debts.length === 0 ? (
                  <p className="text-muted-foreground">No debt rows in this campaign.</p>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Address</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Due date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Link</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedCampaign.debts.map((debt) => (
                          <TableRow key={debt.id}>
                            <TableCell className="max-w-45 truncate font-medium">{debt.client.fullName}</TableCell>
                            <TableCell className="max-w-55 truncate">{debt.client.email || '-'}</TableCell>
                            <TableCell className="whitespace-nowrap">{debt.client.phone || '-'}</TableCell>
                            <TableCell className="max-w-55 truncate">{debt.client.address || '-'}</TableCell>
                            <TableCell className="whitespace-nowrap">{formatAmount(debt.amount)}</TableCell>
                            <TableCell>{formatDate(debt.dueDate)}</TableCell>
                            <TableCell>
                              <Badge variant={getDebtStatusVariant(debt.status)}>
                                {formatDebtStatus(debt.status)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
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
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleCopyCustomerLink(debt.id)}
                                  disabled={linkLoadingDebtId === debt.id}
                                >
                                  Copy
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <p className="text-xs text-muted-foreground">
                    Showing {selectedCampaign.debts.length} of {selectedCampaign.pagination.total} rows
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
