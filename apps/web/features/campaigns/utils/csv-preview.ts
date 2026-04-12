const REQUIRED_FIELDS = ['fullName', 'email', 'amount', 'dueDate'] as const

const HEADER_ALIASES: Record<string, readonly string[]> = {
  fullName: ['fullname', 'full_name', 'name', 'clientname', 'customername', 'debtorname', 'nom'],
  email: ['email', 'mail', 'e-mail'],
  phone: ['phone', 'mobile', 'telephone', 'tel'],
  address: ['address', 'adresse', 'location'],
  amount: ['amount', 'montant', 'debt', 'debtamount', 'balance'],
  dueDate: ['duedate', 'due_date', 'deadline', 'date', 'dateecheance'],
  status: ['status', 'statut', 'state'],
}

const STATUS_MAPPING: Record<string, string> = {
  imported: 'IMPORTED',
  new: 'IMPORTED',
  notify: 'NOTIFIED',
  notified: 'NOTIFIED',
  sent: 'NOTIFIED',
  promise: 'PROMISE_TO_PAY',
  promised: 'PROMISE_TO_PAY',
  promise_to_pay: 'PROMISE_TO_PAY',
  promised_to_pay: 'PROMISE_TO_PAY',
  paid: 'PAID',
  paied: 'PAID',
  payed: 'PAID',
  settled: 'PAID',
  overdue: 'OVERDUE_AFTER_PROMISE',
  late: 'OVERDUE_AFTER_PROMISE',
  unpaid: 'UNPAID',
  not_paid: 'UNPAID',
  impaye: 'UNPAID',
  defaulted: 'OVERDUE_AFTER_PROMISE',
  promis: 'PROMISE_TO_PAY',
}

export type CsvPreviewIssue = {
  rowNumber: number
  reason: string
}

export type CsvPreviewRow = {
  rowNumber: number
  values: string[]
}

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

  if (!rows.length) {
    return {
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      delimiter: detectDelimiter(csvText),
      detectedColumns: {},
      missingRequiredColumns: [...REQUIRED_FIELDS],
      issues: [{ rowNumber: 1, reason: 'CSV is empty' }],
      headers: [],
      previewRows: [],
    }
  }

  const headers = rows[0]?.map((header) => header.trim()) ?? []
  const headerMap = resolveHeaderMap(headers)
  const previewRows = buildPreviewRows(rows)

  const missingRequiredColumns = REQUIRED_FIELDS.filter((field) => headerMap[field] === -1)

  if (missingRequiredColumns.length) {
    return {
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      delimiter: detectDelimiter(csvText),
      detectedColumns: headerMap,
      missingRequiredColumns,
      issues: missingRequiredColumns.map((column, index) => ({
        rowNumber: index + 1,
        reason: `Missing required column: ${column}`,
      })),
      headers,
      previewRows,
    }
  }

  let totalRows = 0
  let validRows = 0
  const issues: CsvPreviewIssue[] = []

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index]
    if (!row || isEmptyRow(row)) {
      continue
    }

    totalRows += 1
    const rowNumber = index + 1

    const fullName = getCell(row, headerMap.fullName)
    const amountRaw = getCell(row, headerMap.amount)
    const dueDateRaw = getCell(row, headerMap.dueDate)
    const statusRaw = getCell(row, headerMap.status)
    const emailRaw = getCell(row, headerMap.email)

    if (!fullName) {
      issues.push({ rowNumber, reason: 'Missing full name' })
      continue
    }

    const amount = parseAmount(amountRaw)
    if (amount === null || amount <= 0) {
      issues.push({ rowNumber, reason: 'Invalid amount' })
      continue
    }

    if (!parseDateValue(dueDateRaw)) {
      issues.push({ rowNumber, reason: 'Invalid due date' })
      continue
    }

    if (!emailRaw) {
      issues.push({ rowNumber, reason: 'Missing email' })
      continue
    }

    if (emailRaw && normalizeEmail(emailRaw) === null) {
      issues.push({ rowNumber, reason: 'Invalid email format' })
      continue
    }

    if (statusRaw && !mapStatus(statusRaw)) {
      issues.push({ rowNumber, reason: `Unknown status: ${statusRaw}` })
      continue
    }

    validRows += 1
  }

  return {
    totalRows,
    validRows,
    invalidRows: issues.length,
    delimiter: detectDelimiter(csvText),
    detectedColumns: headerMap,
    missingRequiredColumns: [],
    issues,
    headers,
    previewRows,
  }
}

function buildPreviewRows(rows: string[][], maxRows = 12): CsvPreviewRow[] {
  const preview: CsvPreviewRow[] = []

  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index]
    if (!row || isEmptyRow(row)) {
      continue
    }

    preview.push({
      rowNumber: index + 1,
      values: row,
    })

    if (preview.length >= maxRows) {
      break
    }
  }

  return preview
}

function parseCsv(csvText: string): string[][] {
  const delimiter = detectDelimiter(csvText)
  const rows: string[][] = []

  let row: string[] = []
  let value = ''
  let inQuotes = false

  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i]
    const next = csvText[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (!inQuotes && char === delimiter) {
      row.push(stripBom(value.trim()))
      value = ''
      continue
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') {
        i += 1
      }

      row.push(stripBom(value.trim()))
      value = ''

      if (!isEmptyRow(row)) {
        rows.push(row)
      }

      row = []
      continue
    }

    value += char
  }

  if (value.length > 0 || row.length > 0) {
    row.push(stripBom(value.trim()))
    if (!isEmptyRow(row)) {
      rows.push(row)
    }
  }

  return rows
}

function detectDelimiter(csvText: string): ',' | ';' | '\t' {
  const firstLine = csvText.split(/\r?\n/).find((line) => line.trim().length > 0) || ''
  const candidates: Array<',' | ';' | '\t'> = [',', ';', '\t']

  let selected: ',' | ';' | '\t' = ','
  let maxCount = -1

  for (const candidate of candidates) {
    const count = firstLine.split(candidate).length - 1
    if (count > maxCount) {
      maxCount = count
      selected = candidate
    }
  }

  return selected
}

function resolveHeaderMap(headers: string[]) {
  const normalizedHeaders = headers.map((value) => normalizeHeader(value))

  const findColumn = (aliases: readonly string[]) => {
    for (const alias of aliases) {
      const index = normalizedHeaders.findIndex((header) => header === alias)
      if (index !== -1) {
        return index
      }
    }
    return -1
  }

  return {
    fullName: findColumn(HEADER_ALIASES.fullName),
    email: findColumn(HEADER_ALIASES.email),
    phone: findColumn(HEADER_ALIASES.phone),
    address: findColumn(HEADER_ALIASES.address),
    amount: findColumn(HEADER_ALIASES.amount),
    dueDate: findColumn(HEADER_ALIASES.dueDate),
    status: findColumn(HEADER_ALIASES.status),
  }
}

function normalizeHeader(header: string) {
  return stripBom(header)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function getCell(row: string[], index: number) {
  if (index < 0) {
    return ''
  }
  return row[index]?.trim() ?? ''
}

function parseAmount(raw: string) {
  const cleaned = raw.replace(/\s/g, '').replace(/,/g, '.')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function parseDateValue(raw: string) {
  const value = raw.trim()
  if (!value) {
    return null
  }

  const direct = new Date(value)
  if (!Number.isNaN(direct.getTime())) {
    return direct
  }

  const dateMatch = value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/)
  if (!dateMatch) {
    return null
  }

  const day = Number(dateMatch[1])
  const month = Number(dateMatch[2])
  const year = Number(dateMatch[3])

  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null
  }

  return parsed
}

function mapStatus(rawStatus: string) {
  const normalized = rawStatus
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z_]/g, '')

  return STATUS_MAPPING[normalized] ?? null
}

function normalizeEmail(raw: string) {
  const value = raw.trim()
  if (!value) {
    return null
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(value) ? value.toLowerCase() : null
}

function isEmptyRow(row: string[]) {
  return row.every((cell) => !cell || !cell.trim())
}

function stripBom(value: string) {
  return value.replace(/^\uFEFF/, '')
}
