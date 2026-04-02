import type { Prisma } from '@repo/database'
import { ActionType, CampaignStatus, DebtStatus, PrismaClient } from '@repo/database'
import type {
  CampaignDetails,
  CampaignCsvImportInput,
  CampaignCsvParseResult,
  CampaignImportResult,
  CampaignImportSkippedRow,
  CampaignParsedCsvRow,
  CampaignSummary,
} from '@repo/types'
import { HTTPException } from 'hono/http-exception'
import { randomUUID } from 'node:crypto'
import { logger } from '../utils/logger.js'
import { BrevoEmailService } from './brevo-email.js'

const STATUS_MAPPING: Record<string, DebtStatus> = {
  imported: DebtStatus.IMPORTED,
  new: DebtStatus.IMPORTED,
  notify: DebtStatus.NOTIFIED,
  notified: DebtStatus.NOTIFIED,
  sent: DebtStatus.NOTIFIED,
  promise: DebtStatus.PROMISE_TO_PAY,
  promised: DebtStatus.PROMISE_TO_PAY,
  promise_to_pay: DebtStatus.PROMISE_TO_PAY,
  promised_to_pay: DebtStatus.PROMISE_TO_PAY,
  paid: DebtStatus.PAID,
  paied: DebtStatus.PAID,
  payed: DebtStatus.PAID,
  settled: DebtStatus.PAID,
  overdue: DebtStatus.OVERDUE_AFTER_PROMISE,
  late: DebtStatus.OVERDUE_AFTER_PROMISE,
  unpaid: DebtStatus.OVERDUE_AFTER_PROMISE,
  defaulted: DebtStatus.OVERDUE_AFTER_PROMISE,
}

const HEADER_ALIASES = {
  fullName: ['fullname', 'full_name', 'name', 'clientname', 'customername', 'debtorname', 'nom'],
  email: ['email', 'mail', 'e-mail'],
  phone: ['phone', 'mobile', 'telephone', 'tel'],
  address: ['address', 'adresse', 'location'],
  amount: ['amount', 'montant', 'debt', 'debtamount', 'balance'],
  dueDate: ['duedate', 'due_date', 'deadline', 'date', 'dateecheance'],
  status: ['status', 'statut', 'state'],
} as const

const DEFAULT_DETAILS_PAGE_SIZE = 25
const MAX_DETAILS_PAGE_SIZE = 100

export class CampaignsService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(workspaceId: string): Promise<CampaignSummary<Date>[]> {
    const campaigns = await this.prisma.campaign.findMany({
      where: { workspaceId },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            debts: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      status: campaign.status,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
      debtsCount: campaign._count.debts,
    }))
  }

  async getById(
    workspaceId: string,
    id: string,
    options?: { page?: number; pageSize?: number }
  ): Promise<CampaignDetails<Date, DebtStatus>> {
    const pageSize = clampPageSize(options?.pageSize)
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      select: {
        id: true,
        workspaceId: true,
        name: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            debts: true,
          },
        },
      },
    })

    if (!campaign || campaign.workspaceId !== workspaceId) {
      throw new HTTPException(404, { message: 'Campaign not found or not in your workspace' })
    }

    const total = campaign._count.debts
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const page = clampPage(options?.page, totalPages)

    const debts = await this.prisma.debtRecord.findMany({
      where: {
        campaignId: campaign.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        amount: true,
        dueDate: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        client: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            address: true,
          },
        },
      },
    })

    return {
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      status: campaign.status,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
      debtsCount: campaign._count.debts,
      debts: debts.map((debt) => ({
        id: debt.id,
        amount: Number(debt.amount),
        dueDate: debt.dueDate,
        status: debt.status,
        createdAt: debt.createdAt,
        updatedAt: debt.updatedAt,
        client: {
          id: debt.client.id,
          fullName: debt.client.fullName,
          email: debt.client.email,
          phone: debt.client.phone,
          address: debt.client.address,
        },
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    }
  }

  async importFromCsv(
    workspaceId: string,
    input: CampaignCsvImportInput
  ): Promise<CampaignImportResult<Date, DebtStatus>> {
    const csvText = input.csvText?.trim()
    if (!csvText) {
      throw new HTTPException(400, { message: 'CSV file is empty' })
    }

    const parsed = this.parseCsvRows(csvText)

    if (!parsed.rows.length) {
      const firstReason = parsed.skippedRows[0]?.reason ?? 'No valid rows found in CSV'
      throw new HTTPException(400, { message: `CSV has no importable rows: ${firstReason}` })
    }

    const campaignName =
      input.campaignName.trim()

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

        const emails = Array.from(
          new Set(parsed.rows.map((row) => row.email).filter((value): value is string => !!value))
        )
        const phones = Array.from(
          new Set(parsed.rows.map((row) => row.phone).filter((value): value is string => !!value))
        )

        const identityFilters: Prisma.ClientWhereInput[] = [
          ...emails.map((email) => ({
            email: {
              equals: email,
              mode: 'insensitive' as const,
            },
          })),
          ...phones.map((phone) => ({ phone })),
        ]

        const existingClients =
          identityFilters.length > 0
            ? await tx.client.findMany({
                where: {
                  workspaceId,
                  OR: identityFilters,
                },
                select: {
                  id: true,
                  email: true,
                  phone: true,
                  createdAt: true,
                },
                orderBy: {
                  createdAt: 'asc',
                },
              })
            : []

        const existingClientByEmail = new Map<string, string>()
        const existingClientByPhone = new Map<string, string>()

        for (const client of existingClients) {
          if (client.email) {
            const emailKey = client.email.toLowerCase()
            if (!existingClientByEmail.has(emailKey)) {
              existingClientByEmail.set(emailKey, client.id)
            }
          }

          if (client.phone && !existingClientByPhone.has(client.phone)) {
            existingClientByPhone.set(client.phone, client.id)
          }
        }

        const pendingClients: Array<{
          id: string
          fullName: string
          email: string | null
          phone: string | null
          address: string | null
        }> = []

        const pendingClientByEmail = new Map<string, number>()
        const pendingClientByPhone = new Map<string, number>()

        const debtRows: Prisma.DebtRecordCreateManyInput[] = []
        const debtEmailNotifications: Array<{
          toEmail: string
          fullName: string
          campaignName: string
          campaignId: string
          amount: number
          dueDate: Date
          debtId: string
          customerId: string
        }> = []

        for (const row of parsed.rows) {
          const emailKey = row.email?.toLowerCase() ?? null
          const phoneKey = row.phone

          let clientId: string | null = null

          if (emailKey) {
            clientId = existingClientByEmail.get(emailKey) ?? null
          }

          if (!clientId && phoneKey) {
            clientId = existingClientByPhone.get(phoneKey) ?? null
          }

          if (!clientId) {
            let pendingIndex: number | undefined

            if (emailKey) {
              pendingIndex = pendingClientByEmail.get(emailKey)
            }

            if (pendingIndex === undefined && phoneKey) {
              pendingIndex = pendingClientByPhone.get(phoneKey)
            }

            if (pendingIndex === undefined) {
              const newClientId = randomUUID()

              pendingClients.push({
                id: newClientId,
                fullName: row.fullName,
                email: row.email,
                phone: row.phone,
                address: row.address,
              })

              pendingIndex = pendingClients.length - 1
            } else {
              const pendingClient = pendingClients[pendingIndex]

              if (!pendingClient) {
                throw new HTTPException(500, { message: 'Unable to resolve CSV client identity' })
              }

              if (!pendingClient.email && row.email) {
                pendingClient.email = row.email
              }

              if (!pendingClient.phone && row.phone) {
                pendingClient.phone = row.phone
              }

              if (!pendingClient.address && row.address) {
                pendingClient.address = row.address
              }
            }

            if (emailKey) {
              pendingClientByEmail.set(emailKey, pendingIndex)
            }

            if (phoneKey) {
              pendingClientByPhone.set(phoneKey, pendingIndex)
            }

            const pendingClient = pendingClients[pendingIndex]

            if (!pendingClient) {
              throw new HTTPException(500, { message: 'Unable to resolve CSV client identity' })
            }

            clientId = pendingClient.id
          }

          const debtId = randomUUID()

          debtRows.push({
            id: debtId,
            campaignId: campaign.id,
            clientId,
            amount: row.amount,
            dueDate: row.dueDate,
            status: row.status,
          })

          if (row.email) {
            debtEmailNotifications.push({
              toEmail: row.email,
              fullName: row.fullName,
              campaignName: campaign.name,
              campaignId: campaign.id,
              amount: row.amount,
              dueDate: row.dueDate,
              debtId,
              customerId: clientId,
            })
          }
        }

        for (const chunk of chunkArray(pendingClients, 500)) {
          if (!chunk.length) {
            continue
          }

          await tx.client.createMany({
            data: chunk.map((client) => ({
              id: client.id,
              workspaceId,
              fullName: client.fullName,
              email: client.email,
              phone: client.phone,
              address: client.address,
            })),
          })
        }

        for (const chunk of chunkArray(debtRows, 500)) {
          if (!chunk.length) {
            continue
          }

          await tx.debtRecord.createMany({
            data: chunk,
          })
        }

        return {
          campaign,
          importedRows: debtRows.length,
          debtEmailNotifications,
        }
      },
      {
        // Large CSV imports can exceed Prisma's default interactive transaction timeout.
        maxWait: 10_000,
        timeout: 120_000,
      }
    )

    let emailStats = {
      attempted: 0,
      sent: 0,
      failed: 0,
      skipped: importResult.debtEmailNotifications.length,
      sentDebtIds: [] as string[],
    }

    try {
      const emailService = new BrevoEmailService()
      const emailResult = await emailService.sendCsvImportedDebtEmails(importResult.debtEmailNotifications)
      emailStats = emailResult

      if (emailResult.sentDebtIds.length > 0) {
        const sentNotifications = importResult.debtEmailNotifications.filter((notification) =>
          emailResult.sentDebtIds.includes(notification.debtId)
        )

        if (sentNotifications.length > 0) {
          await this.prisma.customerActionHistory.createMany({
            data: sentNotifications.map((notification) => ({
              debtId: notification.debtId,
              customerId: notification.customerId,
              actionType: ActionType.EMAIL_SENT,
              metadata: {
                channel: 'brevo',
                source: 'csv-import',
                campaignId: importResult.campaign.id,
              },
            })),
          })
        }
      }

      if (emailResult.attempted > 0 || emailResult.skipped > 0) {
        logger.info(
          {
            campaignId: importResult.campaign.id,
            attempted: emailResult.attempted,
            sent: emailResult.sent,
            failed: emailResult.failed,
            skipped: emailResult.skipped,
            scope: 'campaigns.importCsv.emails',
          },
          'Completed CSV import email dispatch'
        )
      }
    } catch (error) {
      emailStats = {
        attempted: importResult.debtEmailNotifications.length,
        sent: 0,
        failed: importResult.debtEmailNotifications.length,
        skipped: 0,
        sentDebtIds: [],
      }

      logger.warn(
        {
          campaignId: importResult.campaign.id,
          error,
          scope: 'campaigns.importCsv.emails',
        },
        'CSV import completed but email dispatch failed'
      )
    }

    return {
      campaign: importResult.campaign,
      stats: {
        totalRows: parsed.totalRows,
        importedRows: importResult.importedRows,
        skippedRows: parsed.skippedRows.length,
      },
      emailStats,
      skippedRows: parsed.skippedRows,
      statusMapping: STATUS_MAPPING,
    }
  }

  private parseCsvRows(csvText: string): CampaignCsvParseResult<DebtStatus, Date> {
    const lines = parseCsv(csvText)
    if (!lines.length) {
      return { totalRows: 0, rows: [], skippedRows: [] }
    }

    const headerRow = lines[0]
    if (!headerRow) {
      throw new HTTPException(400, { message: 'CSV header row is missing' })
    }

    const headerMap = this.resolveHeaderMap(headerRow)

    const parsedRows: CampaignParsedCsvRow<DebtStatus, Date>[] = []
    const skippedRows: CampaignImportSkippedRow[] = []

    let totalRows = 0

    for (let index = 1; index < lines.length; index += 1) {
      const row = lines[index]
      if (!row || isEmptyRow(row)) {
        continue
      }

      totalRows += 1
      const rowNumber = index + 1

      const fullName = getCell(row, headerMap.fullName)
      const rawAmount = getCell(row, headerMap.amount)
      const rawDueDate = getCell(row, headerMap.dueDate)
      const rawStatus = getCell(row, headerMap.status)

      if (!fullName) {
        skippedRows.push({ rowNumber, reason: 'Missing full name' })
        continue
      }

      const amount = parseAmount(rawAmount)
      if (amount === null || amount <= 0) {
        skippedRows.push({ rowNumber, reason: 'Invalid amount' })
        continue
      }

      const dueDate = parseDateValue(rawDueDate)
      if (!dueDate) {
        skippedRows.push({ rowNumber, reason: 'Invalid due date' })
        continue
      }

      const status = mapStatus(rawStatus)
      if (!status) {
        skippedRows.push({ rowNumber, reason: `Unknown status: ${rawStatus || '(empty)'}` })
        continue
      }

      const rawEmail = getCell(row, headerMap.email)
      if (!rawEmail) {
        skippedRows.push({ rowNumber, reason: 'Missing email' })
        continue
      }

      const email = normalizeEmail(rawEmail)
      if (email === 'INVALID') {
        skippedRows.push({ rowNumber, reason: 'Invalid email format' })
        continue
      }

      const phone = nullableTrim(getCell(row, headerMap.phone))
      const address = nullableTrim(getCell(row, headerMap.address))

      parsedRows.push({
        rowNumber,
        fullName,
        email,
        phone,
        address,
        amount,
        dueDate,
        status,
      })
    }

    return {
      totalRows,
      rows: parsedRows,
      skippedRows,
    }
  }

  private resolveHeaderMap(headers: string[]) {
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

    const headerMap = {
      fullName: findColumn(HEADER_ALIASES.fullName),
      email: findColumn(HEADER_ALIASES.email),
      phone: findColumn(HEADER_ALIASES.phone),
      address: findColumn(HEADER_ALIASES.address),
      amount: findColumn(HEADER_ALIASES.amount),
      dueDate: findColumn(HEADER_ALIASES.dueDate),
      status: findColumn(HEADER_ALIASES.status),
    }

    if (headerMap.fullName === -1) {
      throw new HTTPException(400, {
        message: 'CSV must include a full-name column (e.g. fullName, name, clientName)',
      })
    }

    if (headerMap.email === -1) {
      throw new HTTPException(400, {
        message: 'CSV must include an email column',
      })
    }

    if (headerMap.amount === -1) {
      throw new HTTPException(400, {
        message: 'CSV must include an amount column',
      })
    }

    if (headerMap.dueDate === -1) {
      throw new HTTPException(400, {
        message: 'CSV must include a due-date column',
      })
    }

    return headerMap
  }
}

function clampPageSize(input?: number) {
  if (!input || !Number.isFinite(input)) {
    return DEFAULT_DETAILS_PAGE_SIZE
  }

  const normalized = Math.floor(input)
  if (normalized < 1) {
    return DEFAULT_DETAILS_PAGE_SIZE
  }

  return Math.min(normalized, MAX_DETAILS_PAGE_SIZE)
}

function clampPage(input: number | undefined, totalPages: number) {
  if (!input || !Number.isFinite(input)) {
    return 1
  }

  const normalized = Math.floor(input)
  if (normalized < 1) {
    return 1
  }

  return Math.min(normalized, totalPages)
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

function normalizeHeader(header: string) {
  return stripBom(header)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function mapStatus(rawStatus: string) {
  if (!rawStatus || !rawStatus.trim()) {
    return DebtStatus.IMPORTED
  }

  const normalized = rawStatus
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z_]/g, '')

  return STATUS_MAPPING[normalized] ?? null
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

function normalizeEmail(raw: string): string | null | 'INVALID' {
  const value = nullableTrim(raw)
  if (!value) {
    return null
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(value)) {
    return 'INVALID'
  }

  return value.toLowerCase()
}

function nullableTrim(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function getCell(row: string[], index: number) {
  if (index < 0) {
    return ''
  }
  return row[index]?.trim() ?? ''
}

function isEmptyRow(row: string[]) {
  return row.every((cell) => !cell || !cell.trim())
}

function stripBom(value: string) {
  return value.replace(/^\uFEFF/, '')
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (!items.length) {
    return []
  }

  const safeSize = Math.max(1, Math.floor(size))
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += safeSize) {
    chunks.push(items.slice(index, index + safeSize))
  }

  return chunks
}
