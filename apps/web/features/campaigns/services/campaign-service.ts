import axios from 'axios'
import type { CampaignDetails, CampaignImportResult, CampaignSummary } from '@repo/types'

import { getApiBaseUrl } from '@/config/env'
import { AUTH_ROUTES } from '@/features/auth/services/auth-service'
import { ApiError, createCookieAuthApiClient } from '@/lib/api-client'

export type { CampaignDetails, CampaignImportResult, CampaignSummary } from '@repo/types'

export type ImportCampaignCsvPayload = {
  file: File
  campaignName?: string
  description?: string
}

export type DebtPersonalLinkResult = {
  link: string
  token: string
  expiresAt: string
}

export type GetCampaignByIdOptions = {
  page?: number
  pageSize?: number
}

export const CAMPAIGN_ROUTES = {
  list: '/api/v1/campaigns',
  listWithSlash: '/api/v1/campaigns/',
  getById: (id: string) => `/api/v1/campaigns/${id}`,
  importCsv: '/api/v1/campaigns/import-csv',
  debtPersonalLink: (debtId: string) => `/api/v1/debts/${debtId}/personal-link`,
} as const

const baseURL = getApiBaseUrl()

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
  const { data } = await client.get<{ data: CampaignDetails }>(CAMPAIGN_ROUTES.getById(id), {
    params: {
      page: options?.page,
      pageSize: options?.pageSize,
    },
  })
  return data.data
}

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

export { ApiError }
