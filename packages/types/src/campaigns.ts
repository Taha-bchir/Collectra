import type { Enums } from './types.js'

export type CampaignStatus = Enums<'CampaignStatus'>

export type CampaignSummary<TDate = string> = {
  id: string
  name: string
  description: string | null
  status: CampaignStatus
  createdAt: TDate
  updatedAt: TDate
  debtsCount: number
}

export type CampaignDebtDetail<TDate = string, TDebtStatus = string> = {
  id: string
  amount: number
  dueDate: TDate
  promiseDate?: TDate | null
  status: TDebtStatus
  createdAt: TDate
  updatedAt: TDate
  client: {
    id: string
    fullName: string
    email: string | null
    phone: string | null
    address: string | null
  }
}

export type CampaignDebtsPagination = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type CampaignDetails<TDate = string, TDebtStatus = string> = CampaignSummary<TDate> & {
  debts: CampaignDebtDetail<TDate, TDebtStatus>[]
  pagination: CampaignDebtsPagination
}

export type CampaignImportSkippedRow = {
  rowNumber: number
  reason: string
}

export type CampaignImportResult<TDate = string, TDebtStatus = string> = {
  campaign: Pick<CampaignSummary<TDate>, 'id' | 'name' | 'description' | 'status' | 'createdAt'>
  stats: {
    totalRows: number
    importedRows: number
    skippedRows: number
  }
  emailStats: {
    attempted: number
    sent: number
    failed: number
    skipped: number
  }
  skippedRows: CampaignImportSkippedRow[]
  statusMapping: Record<string, TDebtStatus>
}

export type CampaignCsvImportInput = {
  campaignName: string
  description?: string
  fileName?: string
  csvText: string
}

export type CampaignParsedCsvRow<TDebtStatus = string, TDate = Date> = {
  rowNumber: number
  fullName: string
  email: string | null
  phone: string | null
  address: string | null
  amount: number
  dueDate: TDate
  status: TDebtStatus
}

export type CampaignCsvParseResult<TDebtStatus = string, TDate = Date> = {
  totalRows: number
  rows: CampaignParsedCsvRow<TDebtStatus, TDate>[]
  skippedRows: CampaignImportSkippedRow[]
}
