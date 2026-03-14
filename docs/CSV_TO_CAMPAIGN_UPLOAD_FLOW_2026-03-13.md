# How A CSV File Is Uploaded As A Campaign

This document explains exactly how Collectra turns an uploaded `.csv` file into a new campaign with debts.

## 1. Frontend Sends The File

File: `apps/web/features/campaigns/services/campaign-service.ts`

The web app builds a `FormData` request and posts it to the API:

```ts
export async function importCampaignCsv(payload: ImportCampaignCsvPayload): Promise<CampaignImportResult> {
  const client = getCampaignsClient()
  const formData = new FormData()

  formData.append('file', payload.file)

  if (payload.campaignName?.trim()) {
    formData.append('campaignName', payload.campaignName.trim())
  }

  if (payload.description?.trim()) {
    formData.append('description', payload.description.trim())
  }

  const { data } = await client.post<{ data: CampaignImportResult }>(
    CAMPAIGN_ROUTES.importCsv,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  )

  return data.data
}
```

The endpoint used is:

```ts
CAMPAIGN_ROUTES.importCsv = '/api/v1/campaigns/import-csv'
```

## 2. API Receives And Validates The Upload

File: `apps/api/src/routes/v1/campaigns/actions.ts`

Route handler behavior:

```ts
const body = await c.req.parseBody()

const uploaded = body.file
const file = Array.isArray(uploaded) ? uploaded[0] : uploaded

if (!(file instanceof File)) {
  throw new HTTPException(400, { message: 'Missing CSV file in form-data field "file"' })
}

if (!file.name.toLowerCase().endsWith('.csv')) {
  throw new HTTPException(400, { message: 'Uploaded file must be a .csv file' })
}

const csvText = await file.text()
```

Important points:

- The API expects multipart form-data.
- The uploaded part must be named `file`.
- Extension must be `.csv`.
- The file is read into memory as text with `file.text()`.

## 3. API Calls The Import Service

Still in `apps/api/src/routes/v1/campaigns/actions.ts`, the route forwards data to the service:

```ts
const service = new CampaignsService(c.get('prisma'))
const result = await service.importFromCsv(workspaceId, {
  campaignName,
  description,
  fileName: file.name,
  csvText,
})
```

`workspaceId` is required, so the import is tenant-scoped.

## 4. Service Parses CSV And Prepares Rows

File: `apps/api/src/services/campaigns.ts`

Inside `importFromCsv`:

```ts
const csvText = input.csvText?.trim()
if (!csvText) {
  throw new HTTPException(400, { message: 'CSV file is empty' })
}

const parsed = this.parseCsvRows(csvText)

if (!parsed.rows.length) {
  const firstReason = parsed.skippedRows[0]?.reason ?? 'No valid rows found in CSV'
  throw new HTTPException(400, { message: `CSV has no importable rows: ${firstReason}` })
}
```

What parsing includes:

- Auto-detect delimiter: comma, semicolon, or tab.
- Resolve header aliases (`fullName`, `amount`, `dueDate`, etc.).
- Validate each row.
- Keep invalid rows in `skippedRows` with reason.
- Keep valid rows in `parsed.rows` for DB insertion.

## 5. Campaign Is Created And Rows Are Inserted In One Transaction

File: `apps/api/src/services/campaigns.ts`

Core transaction logic:

```ts
const importResult = await this.prisma.$transaction(
  async (tx) => {
    const campaign = await tx.campaign.create({
      data: {
        workspaceId,
        name: campaignName,
        description: input.description?.trim() || null,
        status: CampaignStatus.ACTIVE,
      },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        createdAt: true,
      },
    })

    let importedRows = 0

    for (const row of parsed.rows) {
      const identityFilters: Prisma.ClientWhereInput[] = []

      if (row.email) {
        identityFilters.push({
          email: {
            equals: row.email,
            mode: 'insensitive' as const,
          },
        })
      }

      if (row.phone) {
        identityFilters.push({ phone: row.phone })
      }

      const existingClient =
        identityFilters.length > 0
          ? await tx.client.findFirst({
              where: {
                workspaceId,
                OR: identityFilters,
              },
              orderBy: { createdAt: 'asc' },
              select: { id: true },
            })
          : null

      const client =
        existingClient ||
        (await tx.client.create({
          data: {
            workspaceId,
            fullName: row.fullName,
            email: row.email,
            phone: row.phone,
            address: row.address,
          },
          select: { id: true },
        }))

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

    return {
      campaign,
      importedRows,
    }
  },
  {
    maxWait: 10_000,
    timeout: 120_000,
  }
)
```

Why transaction matters:

- Either the whole import commits consistently.
- Or it rolls back if a failure happens mid-import.

## 6. Response Returned To Frontend

Route returns `201 Created` with:

```json
{
  "data": {
    "campaign": {
      "id": "...",
      "name": "...",
      "description": "...",
      "status": "ACTIVE",
      "createdAt": "..."
    },
    "stats": {
      "totalRows": 220,
      "importedRows": 215,
      "skippedRows": 5
    },
    "skippedRows": [
      { "rowNumber": 34, "reason": "Invalid amount" }
    ],
    "statusMapping": {
      "paid": "PAID"
    }
  }
}
```

## 7. Data Model Result

For one CSV upload:

- One new `Campaign` is created.
- For each valid row, one `DebtRecord` is created.
- `Client` rows are reused when email/phone already exists in the same workspace, otherwise new clients are created.

Files involved:

- `apps/web/features/campaigns/services/campaign-service.ts`
- `apps/api/src/routes/v1/campaigns/actions.ts`
- `apps/api/src/services/campaigns.ts`
- `apps/api/src/schema/v1/campaigns.schema.ts`
