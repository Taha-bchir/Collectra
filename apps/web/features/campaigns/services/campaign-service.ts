import axios from 'axios'
import type { CampaignDetails, CampaignImportResult, CampaignSummary } from '@repo/types'

import { AUTH_ROUTES } from '@/features/auth/services/auth-service'
import { ApiError, createCookieAuthApiClient } from '@/lib/api-client'

export type { CampaignDetails, CampaignImportResult, CampaignSummary } from '@repo/types'

export type ImportCampaignCsvPayload = {
  file: File
  campaignName: string
  dueDate: string
  currency: string
  description?: string
}

export type DebtPersonalLinkResult = {
  link: string
  token: string
  expiresAt: string
}

export type CampaignEmailStats = {
  campaignId: string
  stats: {
    sent: number
    opened: number
    clicked: number
    other: number
  }
  summary: {
    total: number
    uniqueDebts: number
    uniqueCustomers: number
  }
  lastEventAt: string | null
}

export type GetCampaignByIdOptions = {
  page?: number
  pageSize?: number
}

export type DebtStatus = 'IMPORTED' | 'UNPAID' | 'NOTIFIED' | 'PROMISE_TO_PAY' | 'PAID' | 'OVERDUE_AFTER_PROMISE'

export type UpdateDebtInput = {
  status?: DebtStatus
  dueDate?: string
  promiseDate?: string | null
}

export type UpdateCampaignDueDateInput = {
  dueDate: string
}

export type UpdateCampaignStatusInput = {
  status: CampaignSummary['status']
}

export type SyncCampaignBrevoLogsInput = {
  lookbackDays?: number
  pageSize?: number
}

export const CAMPAIGN_ROUTES = {
  list: '/api/v1/campaigns',
  listWithSlash: '/api/v1/campaigns/',
  getById: (id: string) => `/api/v1/campaigns/${id}`,
  getByIdWithSlash: (id: string) => `/api/v1/campaigns/${id}/`,
  importCsv: '/api/v1/campaigns/import-csv',
  updateDueDate: (id: string) => `/api/v1/campaigns/${id}/due-date`,
  updateStatus: (id: string) => `/api/v1/campaigns/${id}/status`,
  delete: (id: string) => `/api/v1/campaigns/${id}`,
  emailStats: (id: string) => `/api/v1/campaigns/${id}/email-stats`,
  debtPersonalLink: (debtId: string) => `/api/v1/debts/${debtId}/personal-link`,
  updateDebt: (debtId: string) => `/api/v1/debts/${debtId}`,
  syncBrevoLogs: (id: string) => `/api/v1/campaigns/${id}/brevo-logs/sync`,
} as const

const baseURL = process.env.NEXT_PUBLIC_API_URL!.replace(/\/$/, '')

let campaignsClient: ReturnType<typeof createCookieAuthApiClient> | null = null

function getCampaignsClient() {
  if (campaignsClient) return campaignsClient

  const refreshClient = axios.create({
    baseURL: baseURL.replace(/\/$/, ''),
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true,
  })

  campaignsClient = createCookieAuthApiClient({
    baseURL,
    useCookies: true,
    refreshUrl: AUTH_ROUTES.refresh,
    onRefresh: async () => {
      await refreshClient.post(AUTH_ROUTES.refresh, {})
    },
  })

  return campaignsClient
}

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

export async function getCampaignById(
  id: string,
  options?: GetCampaignByIdOptions
): Promise<CampaignDetails> {
  const client = getCampaignsClient()
  try {
    const { data } = await client.get<{ data: CampaignDetails }>(CAMPAIGN_ROUTES.getById(id), {
      params: {
        page: options?.page,
        pageSize: options?.pageSize,
      },
    })
    return data.data
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      const { data } = await client.get<{ data: CampaignDetails }>(CAMPAIGN_ROUTES.getByIdWithSlash(id), {
        params: {
          page: options?.page,
          pageSize: options?.pageSize,
        },
      })
      return data.data
    }

    throw error
  }
}

export async function importCampaignCsv(payload: ImportCampaignCsvPayload): Promise<CampaignImportResult> {
  const client = getCampaignsClient()
  const formData = new FormData()

  formData.append('file', payload.file)
  formData.append('campaignName', payload.campaignName.trim())
  formData.append('dueDate', payload.dueDate)
  formData.append('currency', payload.currency.trim().toLowerCase())

  if (payload.description?.trim()) {
    formData.append('description', payload.description.trim())
  }

  const { data } = await client.post<{ data: CampaignImportResult }>(CAMPAIGN_ROUTES.importCsv, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  return data.data
}

export async function getDebtPersonalLink(debtId: string): Promise<DebtPersonalLinkResult> {
  const client = getCampaignsClient()
  const { data } = await client.get<{ data: DebtPersonalLinkResult }>(CAMPAIGN_ROUTES.debtPersonalLink(debtId))
  return data.data
}

export async function getCampaignEmailStats(id: string): Promise<CampaignEmailStats> {
  const client = getCampaignsClient()
  const { data } = await client.get<{ data: CampaignEmailStats }>(CAMPAIGN_ROUTES.emailStats(id), {
    timeout: 10000,
  })
  return data.data
}

export async function updateDebt(debtId: string, input: UpdateDebtInput) {
  const client = getCampaignsClient()
  const { data } = await client.patch<{ data: unknown }>(CAMPAIGN_ROUTES.updateDebt(debtId), input)
  return data.data
}

export async function updateCampaignDueDate(campaignId: string, input: UpdateCampaignDueDateInput) {
  const client = getCampaignsClient()
  const { data } = await client.patch<{ data: { campaignId: string; dueDate: string; updatedCount: number } }>(
    CAMPAIGN_ROUTES.updateDueDate(campaignId),
    input
  )
  return data.data
}

export async function updateCampaignStatus(campaignId: string, input: UpdateCampaignStatusInput) {
  const client = getCampaignsClient()
  const { data } = await client.patch<{ data: CampaignSummary }>(CAMPAIGN_ROUTES.updateStatus(campaignId), input)
  return data.data
}

export async function deleteCampaign(campaignId: string) {
  const client = getCampaignsClient()
  const { data } = await client.delete<{ data: { id: string } }>(CAMPAIGN_ROUTES.delete(campaignId))
  return data.data
}

export async function syncCampaignBrevoLogs(campaignId: string, input: SyncCampaignBrevoLogsInput = {}) {
  const client = getCampaignsClient()
  const { data } = await client.post<{
    data: {
      campaignId: string
      lookbackDays: number
      pageSize: number
      emailsScanned: number
      pagesFetched: number
      rowsFetched: number
      created: number
      deduplicated: number
      unresolved: number
    }
  }>(CAMPAIGN_ROUTES.syncBrevoLogs(campaignId), input, {
    timeout: 10000,
  })

  return data.data
}

export { ApiError }
