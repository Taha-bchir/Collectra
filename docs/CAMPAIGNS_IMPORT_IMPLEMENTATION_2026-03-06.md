# Campaigns CSV Import Implementation (2026-03-06)

This version documents each functional part with its corresponding code snippet.

## 1) API Routes (List, Get, Import)

File: `apps/api/src/routes/v1/campaigns/actions.ts`

```ts
handler.openapi(
  listCampaignsSchema,
  withRouteTryCatch('campaigns.list', async (c) => {
    const workspaceId = requireWorkspaceId(c)
    const service = new CampaignsService(c.get('prisma'))
    const campaigns = await service.list(workspaceId)

    return c.json({
      data: campaigns.map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
        status: campaign.status,
        createdAt: campaign.createdAt.toISOString(),
        updatedAt: campaign.updatedAt.toISOString(),
        debtsCount: campaign.debtsCount,
      })),
    })
  })
)

handler.openapi(
  importCampaignCsvSchema,
  withRouteTryCatch('campaigns.importCsv', async (c) => {
    const workspaceId = requireWorkspaceId(c)
    const body = await c.req.parseBody()
    const uploaded = body.file
    const file = Array.isArray(uploaded) ? uploaded[0] : uploaded

    if (!(file instanceof File)) {
      throw new HTTPException(400, { message: 'Missing CSV file in form-data field "file"' })
    }

    const service = new CampaignsService(c.get('prisma'))
    const result = await service.importFromCsv(workspaceId, {
      campaignName: typeof body.campaignName === 'string' ? body.campaignName : undefined,
      description: typeof body.description === 'string' ? body.description : undefined,
      fileName: file.name,
      csvText: await file.text(),
    })

    return c.json({ data: { campaign: result.campaign, stats: result.stats, skippedRows: result.skippedRows, statusMapping: result.statusMapping } }, 201)
  })
)
```

What this does:

- Enforces tenant workspace via `requireWorkspaceId`.
- Normalizes outgoing campaign payload.
- Accepts multipart CSV and delegates parsing/import to service.

## 2) Tenant Authorization

File: `apps/api/src/middleware/authorization.ts`

```ts
const PROTECTED_PATTERNS = [
  '/api/v1/campaigns',
  '/api/v1/campaigns/*',
  // ...other protected paths
] as const

const TENANT_SCOPED_PREFIXES = [
  '/api/v1/campaigns',
  // ...other tenant-scoped prefixes
] as const
```

What this does:

- Forces auth on campaigns routes.
- Resolves current workspace so campaign operations are scoped to tenant data.

## 3) OpenAPI Multipart Schema

File: `apps/api/src/schema/v1/campaigns.schema.ts`

```ts
export const importCampaignCsvSchema = createRoute({
  method: 'post',
  path: '/import-csv',
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            campaignName: z.string().min(1).max(120).optional(),
            description: z.string().max(500).optional(),
            // Accept runtime File objects while preserving binary OpenAPI docs.
            file: z.any().openapi({
              type: 'string',
              format: 'binary',
              description: 'CSV file',
            }),
          }),
        },
      },
    },
  },
})
```

What this fixed:

- Prevented `400` caused by strict runtime mismatch when multipart parser provided `File` object.

## 4) Campaign Service Logic

File: `apps/api/src/services/campaigns.ts`

### 4.1 Create campaign + import debts in one transaction

```ts
const importResult = await this.prisma.$transaction(async (tx) => {
  const campaign = await tx.campaign.create({
    data: {
      workspaceId,
      name: campaignName,
      description: input.description?.trim() || null,
      status: CampaignStatus.ACTIVE,
    },
    select: { id: true, name: true, description: true, status: true, createdAt: true },
  })

  let importedRows = 0

  for (const row of parsed.rows) {
    const identityFilters: Prisma.ClientWhereInput[] = []
    if (row.email) identityFilters.push({ email: { equals: row.email, mode: 'insensitive' as const } })
    if (row.phone) identityFilters.push({ phone: row.phone })

    const existingClient = identityFilters.length > 0
      ? await tx.client.findFirst({ where: { workspaceId, OR: identityFilters }, orderBy: { createdAt: 'asc' }, select: { id: true } })
      : null

    const client = existingClient || await tx.client.create({
      data: { workspaceId, fullName: row.fullName, email: row.email, phone: row.phone, address: row.address },
      select: { id: true },
    })

    await tx.debtRecord.create({
      data: {
        campaignId: campaign.id,
        clientId: client.id,
        amount: row.amount,
        dueDate: row.dueDate,
        status: row.status,
      },
    })

    importedRows += 1
  }

  return { campaign, importedRows }
})
```

### 4.2 Status mapping

```ts
const STATUS_MAPPING: Record<string, DebtStatus> = {
  imported: DebtStatus.IMPORTED,
  new: DebtStatus.IMPORTED,
  notify: DebtStatus.NOTIFIED,
  notified: DebtStatus.NOTIFIED,
  sent: DebtStatus.NOTIFIED,
  promise: DebtStatus.PROMISE_TO_PAY,
  paid: DebtStatus.PAID,
  overdue: DebtStatus.OVERDUE_AFTER_PROMISE,
  // ...aliases
}
```

### 4.3 Required header validation

```ts
if (headerMap.fullName === -1) {
  throw new HTTPException(400, { message: 'CSV must include a full-name column (e.g. fullName, name, clientName)' })
}
if (headerMap.amount === -1) {
  throw new HTTPException(400, { message: 'CSV must include an amount column' })
}
if (headerMap.dueDate === -1) {
  throw new HTTPException(400, { message: 'CSV must include a due-date column' })
}
```

## 5) Frontend API Client

File: `apps/web/features/campaigns/services/campaign-service.ts`

```ts
export const CAMPAIGN_ROUTES = {
  list: '/api/v1/campaigns',
  listWithSlash: '/api/v1/campaigns/',
  getById: (id: string) => `/api/v1/campaigns/${id}`,
  importCsv: '/api/v1/campaigns/import-csv',
} as const

export async function listCampaigns(): Promise<CampaignSummary[]> {
  const client = getCampaignsClient()
  try {
    const { data } = await client.get<{ data: CampaignSummary[] }>(CAMPAIGN_ROUTES.list)
    return data.data
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      const { data } = await client.get<{ data: CampaignSummary[] }>(CAMPAIGN_ROUTES.listWithSlash)
      return data.data
    }
    throw error
  }
}
```

What this does:

- Handles slash/no-slash list path compatibility.
- Uses cookie auth + refresh strategy same as existing app pattern.

## 6) Frontend CSV Preview Parser

File: `apps/web/features/campaigns/utils/csv-preview.ts`

```ts
export type CsvPreviewResult = {
  totalRows: number
  validRows: number
  invalidRows: number
  delimiter: ',' | ';' | '\t'
  detectedColumns: Record<string, number>
  missingRequiredColumns: string[]
  issues: CsvPreviewIssue[]
  headers: string[]
  previewRows: CsvPreviewRow[]
}

export function previewCampaignCsv(csvText: string): CsvPreviewResult {
  const rows = parseCsv(csvText)
  // ...validate headers + rows
  // ...build issues
  // ...return headers + previewRows for table rendering
}
```

What this does:

- Parses CSV client-side before upload.
- Produces both validation and display-ready table data.

## 7) Dashboard Page Logic

File: `apps/web/app/(dashboard)/campaigns/page.tsx`

### 7.1 Confirm-before-import

```tsx
<Button onClick={() => setConfirmImportOpen(true)} disabled={!canImport}>
  Confirm And Import CSV
</Button>

<AlertDialog open={confirmImportOpen} onOpenChange={setConfirmImportOpen}>
  <AlertDialogAction onClick={handleConfirmImport} disabled={!canImport || importing}>
    {importing ? 'Importing...' : 'Confirm Import'}
  </AlertDialogAction>
</AlertDialog>
```

### 7.2 Keep dialog open until success

```ts
const handleConfirmImport = useCallback(async (event: MouseEvent<HTMLButtonElement>) => {
  event.preventDefault()
  const success = await handleImport()
  if (success) {
    setConfirmImportOpen(false)
  }
}, [handleImport])
```

### 7.3 Immediate table visibility after import

```ts
const fallbackCampaign: CampaignSummary = {
  id: result.campaign.id,
  name: result.campaign.name,
  description: result.campaign.description,
  status: result.campaign.status,
  createdAt: result.campaign.createdAt,
  updatedAt: result.campaign.createdAt,
  debtsCount: result.stats.importedRows,
}

setCampaigns((prev) => [fallbackCampaign, ...prev.filter((item) => item.id !== fallbackCampaign.id)])
```

### 7.4 Fallback rendering if list fetch is delayed

```ts
const renderedCampaigns = useMemo(() => {
  if (!lastImportResult) return campaigns
  if (campaigns.some((campaign) => campaign.id === lastImportResult.campaign.id)) return campaigns

  return [
    {
      id: lastImportResult.campaign.id,
      name: lastImportResult.campaign.name,
      description: lastImportResult.campaign.description,
      status: lastImportResult.campaign.status,
      createdAt: lastImportResult.campaign.createdAt,
      updatedAt: lastImportResult.campaign.createdAt,
      debtsCount: lastImportResult.stats.importedRows,
    },
    ...campaigns,
  ]
}, [campaigns, lastImportResult])
```

### 7.5 CSV table preview rendering

```tsx
{preview.headers.length > 0 && preview.previewRows.length > 0 && (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Row</TableHead>
        {preview.headers.map((header, index) => (
          <TableHead key={`${header || 'column'}-${index}`}>{header || `Column ${index + 1}`}</TableHead>
        ))}
      </TableRow>
    </TableHeader>
    <TableBody>
      {preview.previewRows.map((row) => (
        <TableRow key={`preview-row-${row.rowNumber}`}>
          <TableCell>{row.rowNumber}</TableCell>
          {preview.headers.map((_, index) => (
            <TableCell key={`preview-cell-${row.rowNumber}-${index}`}>{row.values[index] || ''}</TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  </Table>
)}
```

### 7.6 Inline persistent import error

```tsx
{importError && (
  <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
    {importError}
  </div>
)}
```

## 8) Navigation Wiring

File: `apps/web/config/nav-config.ts`

```ts
{
  title: 'Campaigns',
  href: '/campaigns',
  icon: Megaphone,
}
```

## 9) Test Data Files

Folder: `test-data/campaigns-csv`

- `01-valid-basic.csv`
- `02-valid-semicolon-aliases.csv`
- `03-valid-tab-delimiter.csv`
- `04-mixed-invalid-rows.csv`
- `05-missing-required-column.csv`
- `06-minimal-required-only.csv`

## 10) Commands Used For Validation

```bash
pnpm --filter api build
pnpm --filter web build
```

Both passed after all fixes.
