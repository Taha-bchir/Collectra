# CSV Import — How It Works

**Feature:** Campaign creation via CSV file upload  
**Endpoint:** `POST /api/v1/campaigns/import-csv`  
**Access:** Staff only (requires workspace authentication)

---

## Overview

A staff member uploads a `.csv` file from the campaigns dashboard. The API parses it, creates a new `Campaign`, deduplicates `Client` records, and inserts one `DebtRecord` per valid row — all inside a single database transaction. Invalid rows are skipped and returned with reasons instead of aborting the whole import.

---

## End-to-End Flow

```bash
┌──────────────────────────────────────────────────────────────┐
│  Browser (Next.js)                                            │
│                                                               │
│  1. User picks .csv file + optional name/description         │
│  2. FormData { file, campaignName?, description? }           │
│  3. POST /api/v1/campaigns/import-csv (multipart/form-data) │
└────────────────────┬─────────────────────────────────────────┘
                     │ HTTP multipart request (auth cookie)
                     ▼
┌──────────────────────────────────────────────────────────────┐
│  Hono Route Handler (campaigns/actions.ts)                    │
│                                                               │
│  4. Parse multipart body — extract File, campaignName, desc  │
│  5. Validate: must be .csv extension, File instance          │
│  6. Read file content as text (file.text())                  │
│  7. Delegate to CampaignsService.importFromCsv()             │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│  CampaignsService.importFromCsv() (services/campaigns.ts)    │
│                                                               │
│  8.  Detect delimiter (comma / semicolon / tab)              │
│  9.  Parse CSV text → string[][]  (handles quoted fields,    │
│      CRLF, BOM)                                              │
│  10. Resolve header aliases → column index map               │
│  11. Iterate rows → validate → build parsedRows[]            │
│  12. Prisma $transaction:                                     │
│       a. CREATE Campaign                                      │
│       b. For each row:                                        │
│           - Find existing Client by email OR phone            │
│           - Create Client if not found                        │
│           - CREATE DebtRecord                                 │
│  13. Return { campaign, stats, skippedRows, statusMapping }  │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────┐
│  HTTP 201 Response                                            │
│                                                               │
│  { data: { campaign, stats, skippedRows, statusMapping } }   │
└──────────────────────────────────────────────────────────────┘
```

---

## 1. Frontend — File Selection & Upload

**File:** `apps/web/app/(dashboard)/campaigns/page.tsx`  
**Service:** `apps/web/features/campaigns/services/campaign-service.ts`

The user selects a file from an `<input type="file" accept=".csv">`. On confirmation, the form data is sent via `importCampaignCsv()`:

```ts
// campaign-service.ts
export async function importCampaignCsv(payload: ImportCampaignCsvPayload): Promise<CampaignImportResult> {
  const client = getCampaignsClient()   // authenticated axios client (cookie-based)
  const formData = new FormData()

  formData.append('file', payload.file)

  if (payload.campaignName?.trim()) {
    formData.append('campaignName', payload.campaignName.trim())
  }

  if (payload.description?.trim()) {
    formData.append('description', payload.description.trim())
  }

  const { data } = await client.post<{ data: CampaignImportResult }>(
    CAMPAIGN_ROUTES.importCsv,       // '/api/v1/campaigns/import-csv'
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )

  return data.data
}
```

The payload type:

```ts
export type ImportCampaignCsvPayload = {
  file: File
  campaignName?: string
  description?: string
}
```

---

## 2. API Route Handler

**File:** `apps/api/src/routes/v1/campaigns/actions.ts`

The handler receives the multipart body, validates the file, reads it as text, and delegates parsing to the service:

```ts
handler.openapi(importCampaignCsvSchema, withRouteTryCatch('campaigns.importCsv', async (c) => {
  const workspaceId = requireWorkspaceId(c)   // tenant isolation — throws 403 if missing

  const body = await c.req.parseBody()

  const uploaded = body.file
  const file = Array.isArray(uploaded) ? uploaded[0] : uploaded

  // Validation
  if (!(file instanceof File)) {
    throw new HTTPException(400, { message: 'Missing CSV file in form-data field "file"' })
  }

  if (!file.name.toLowerCase().endsWith('.csv')) {
    throw new HTTPException(400, { message: 'Uploaded file must be a .csv file' })
  }

  const csvText = await file.text()    // reads the raw CSV string from the File object

  const campaignName = typeof body.campaignName === 'string' ? body.campaignName.trim() || undefined : undefined
  const description  = typeof body.description  === 'string' ? body.description.trim()  || undefined : undefined

  const service = new CampaignsService(c.get('prisma'))
  const result = await service.importFromCsv(workspaceId, {
    campaignName,
    description,
    fileName: file.name,
    csvText,
  })

  return c.json({ data: { campaign, stats, skippedRows, statusMapping } }, 201)
}))
```

---

## 3. CSV Parsing

**File:** `apps/api/src/services/campaigns.ts`

### 3a. Delimiter Detection

The parser inspects the **first non-empty line** and counts occurrences of `,`, `;`, and `\t`. The most frequent one wins:

```ts
function detectDelimiter(csvText: string): ',' | ';' | '\t' {
  const firstLine = csvText.split(/\r?\n/).find(line => line.trim().length > 0) || ''
  const candidates: Array<',' | ';' | '\t'> = [',', ';', '\t']

  let selected: ',' | ';' | '\t' = ','
  let maxCount = -1

  for (const candidate of candidates) {
    const count = firstLine.split(candidate).length - 1
    if (count > maxCount) { maxCount = count; selected = candidate }
  }

  return selected
}
```

### 3b. Full CSV Parser

A character-by-character state machine handles RFC 4180 correctly:

- **Quoted fields** — `"value with, comma"` parsed as one cell
- **Escaped quotes** — `""` inside quotes becomes `"`
- **CRLF + LF** — both line endings handled
- **BOM stripping** — `\uFEFF` removed from any cell
- **Trailing lines** — last row without newline is captured

```ts
function parseCsv(csvText: string): string[][] {
  const delimiter = detectDelimiter(csvText)
  const rows: string[][] = []
  let row: string[] = []
  let value = ''
  let inQuotes = false

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i]
    const next = csvText[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') { value += '"'; i++ }   // escaped quote
      else inQuotes = !inQuotes
      continue
    }

    if (!inQuotes && char === delimiter) {
      row.push(stripBom(value.trim())); value = ''; continue
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') i++    // skip \n in CRLF
      row.push(stripBom(value.trim())); value = ''
      if (!isEmptyRow(row)) rows.push(row)
      row = []; continue
    }

    value += char
  }

  // flush last row
  if (value.length > 0 || row.length > 0) {
    row.push(stripBom(value.trim()))
    if (!isEmptyRow(row)) rows.push(row)
  }

  return rows
}
```

### 3c. Header Alias Resolution

The first row is treated as the header. Column names are **normalized** (lowercased, all non-alphanumeric stripped) and then matched against an alias table. This makes the CSV format flexible:

```ts
const HEADER_ALIASES = {
  fullName: ['fullname', 'full_name', 'name', 'clientname', 'customername', 'debtorname', 'nom'],
  email:    ['email', 'mail', 'e-mail'],
  phone:    ['phone', 'mobile', 'telephone', 'tel'],
  address:  ['address', 'adresse', 'location'],
  amount:   ['amount', 'montant', 'debt', 'debtamount', 'balance'],
  dueDate:  ['duedate', 'due_date', 'deadline', 'date', 'dateecheance'],
  status:   ['status', 'statut', 'state'],
}
```

**Required columns:** `fullName`, `amount`, `dueDate` — missing any of these returns HTTP 400.  
**Optional columns:** `email`, `phone`, `address`, `status`

### 3d. Row Validation

Each data row goes through a validation pipeline. On failure, the row is added to `skippedRows` with a reason and processing continues:

| Field | Rule | Skip reason if invalid |
| `fullName` | Non-empty string | `"Missing full name"` |
| `amount` | Parseable number, `> 0` | `"Invalid amount"` |
| `dueDate` | ISO date, `DD/MM/YYYY`, `DD-MM-YYYY`, `DD.MM.YYYY` | `"Invalid due date"` |
| `status` | Matches alias table (see below) | `"Unknown status: <value>"` |
| `email` | Valid email format if present | `"Invalid email format"` |

**Amount parsing** — strips whitespace and replaces `,` with `.` before `Number()`:

```ts
function parseAmount(raw: string) {
  const cleaned = raw.replace(/\s/g, '').replace(/,/g, '.')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}
```

**Date parsing** — tries `new Date(value)` first, then `DD/MM/YYYY`-style regex:

```ts
function parseDateValue(raw: string) {
  const direct = new Date(raw.trim())
  if (!isNaN(direct.getTime())) return direct

  const match = raw.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/)
  if (!match) return null

  return new Date(Date.UTC(year, month - 1, day))  // validates calendar correctness
}
```

### 3e. Status Mapping

Status values are normalized (lowercased, spaces→underscores) and matched against a wide alias table supporting both English and French terms:

```ts
const STATUS_MAPPING: Record<string, DebtStatus> = {
  imported: 'IMPORTED',  new: 'IMPORTED',
  notify: 'NOTIFIED',    notified: 'NOTIFIED',   sent: 'NOTIFIED',
  promise: 'PROMISE_TO_PAY',  promised: 'PROMISE_TO_PAY',  promise_to_pay: 'PROMISE_TO_PAY',
  paid: 'PAID',          paied: 'PAID',           payed: 'PAID',   settled: 'PAID',
  overdue: 'OVERDUE_AFTER_PROMISE',  late: 'OVERDUE_AFTER_PROMISE',  unpaid: 'OVERDUE_AFTER_PROMISE',
}
```

If status is **empty**, it defaults to `IMPORTED`. If it's present but unrecognized, the row is **skipped**.

---

## 4. Database Transaction

**File:** `apps/api/src/services/campaigns.ts → importFromCsv()`

The entire import runs in a **Prisma interactive transaction** with extended timeouts to handle large files (200+ rows):

```ts
await this.prisma.$transaction(async (tx) => {
  // Step 1: Create the Campaign
  const campaign = await tx.campaign.create({
    data: { workspaceId, name: campaignName, description, status: 'ACTIVE' }
  })

  for (const row of parsed.rows) {
    // Step 2: Client deduplication
    // Build identity filters for email (case-insensitive) and/or phone
    const existingClient = await tx.client.findFirst({
      where: { workspaceId, OR: identityFilters }
    })

    // Step 3: Create Client if not found
    const client = existingClient ?? await tx.client.create({ data: { ...row } })

    // Step 4: Create DebtRecord linked to campaign + client
    await tx.debtRecord.create({
      data: { campaignId: campaign.id, clientId: client.id, amount, dueDate, status }
    })
  }
}, {
  maxWait: 10_000,   // max 10s to acquire transaction connection
  timeout: 120_000,  // max 2 min total transaction duration (covers 200+ row imports)
})
```

**Client deduplication logic:**

- If the row has an email → look for an existing `Client` in this workspace with the same email (case-insensitive)
- If the row has a phone → also check by phone
- If both match different clients, the first created one is used (`orderBy: createdAt asc`)
- If no match → a new `Client` is created
- This prevents creating duplicate customer records on re-import

---

## 5. Response

On success the API returns **HTTP 201** with:

```json
{
  "data": {
    "campaign": {
      "id": "uuid",
      "name": "my-file",
      "description": null,
      "status": "ACTIVE",
      "createdAt": "2026-03-13T10:00:00.000Z"
    },
    "stats": {
      "totalRows": 220,
      "importedRows": 218,
      "skippedRows": 2
    },
    "skippedRows": [
      { "rowNumber": 45, "reason": "Invalid amount" },
      { "rowNumber": 102, "reason": "Invalid email format" }
    ],
    "statusMapping": {
      "paid": "PAID",
      "notified": "NOTIFIED"
      // ... full alias map returned so client can display it
    }
  }
}
```

---

## 6. Supported CSV Formats

The parser is intentionally flexible. All of these work:

**Comma-delimited (standard):**

```csv
fullName,email,phone,amount,dueDate,status
Alice Martin,alice@example.com,+33612345678,1500.00,2026-06-01,notified
```

**Semicolon-delimited (common in French Excel exports):**

```csv
nom;mail;telephone;montant;dateEcheance;statut
Alice Martin;alice@example.com;+33612345678;1500,00;01/06/2026;notifié
```

**Tab-delimited:**

```csv
name email amount dueDate status
Alice Martin alice@example.com 1500 2026-06-01 paid
```

**Quoted fields with commas:**

```csv
fullName,address,amount,dueDate,status
"Martin, Alice","12 rue de la Paix, Paris",1500,2026-06-01,imported
```

**Test files available in:** `test-data/campaigns-csv/`

| File | Purpose |
| `01-valid-basic.csv` | Standard comma-delimited, all fields |
| `02-valid-semicolon-aliases.csv` | Semicolon delimiter + French header aliases |
| `03-valid-tab-delimiter.csv` | Tab-delimited |
| `04-mixed-invalid-rows.csv` | Mix of valid + invalid rows to test skip logic |
| `05-missing-required-column.csv` | Triggers 400 (missing required header) |
| `06-minimal-required-only.csv` | Only fullName, amount, dueDate |
| `07-pagination-220-users.csv` | 220 rows for pagination testing |

---

## 7. Error Handling

| Situation | HTTP | Message |
| No file in body | 400 | `Missing CSV file in form-data field "file"` |
| Non-CSV extension | 400 | `Uploaded file must be a .csv file` |
| Empty file | 400 | `CSV file is empty` |
| No importable rows | 400 | `CSV has no importable rows: <first skip reason>` |
| Missing required header | 400 | `CSV must include a full-name column (...)` |
| Not authenticated | 401 | Unauthorized |
| No active workspace | 403 | Forbidden |
| DB error / timeout | 500 | Internal server error |

Individual row errors do **not** fail the request — they appear in `skippedRows`.

---

## 8. Database Models Involved

```prisma
model Campaign {
  id          String         @id @default(uuid()) @db.Uuid
  workspaceId String         @db.Uuid
  name        String
  description String?
  status      CampaignStatus @default(DRAFT)
  debts       DebtRecord[]
}

model Client {
  id          String   @id @default(uuid()) @db.Uuid
  workspaceId String   @db.Uuid
  fullName    String
  email       String?
  phone       String?
  address     String?
  debts       DebtRecord[]
}

model DebtRecord {
  id         String     @id @default(uuid()) @db.Uuid
  campaignId String     @db.Uuid
  clientId   String     @db.Uuid
  amount     Decimal
  dueDate    DateTime
  status     DebtStatus @default(IMPORTED)
}
```

One import creates: **1 Campaign** + **N Clients** (deduped) + **N DebtRecords**.
