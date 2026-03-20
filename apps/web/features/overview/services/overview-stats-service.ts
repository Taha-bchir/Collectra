import axios from 'axios'

import { AUTH_ROUTES } from '@/features/auth/services/auth-service'
import { ApiError, createCookieAuthApiClient } from '@/lib/api-client'
import type { DashboardStats, GetDashboardStatsOptions } from '@/features/overview/types'

export const OVERVIEW_STATS_ROUTES = {
  get: '/api/v1/stats',
} as const

const baseURL = process.env.NEXT_PUBLIC_API_URL!.replace(/\/$/, '')

let overviewStatsClient: ReturnType<typeof createCookieAuthApiClient> | null = null

function getOverviewStatsClient() {
  if (overviewStatsClient) return overviewStatsClient

  const refreshClient = axios.create({
    baseURL: baseURL.replace(/\/$/, ''),
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true,
  })

  overviewStatsClient = createCookieAuthApiClient({
    baseURL,
    useCookies: true,
    refreshUrl: AUTH_ROUTES.refresh,
    onRefresh: async () => {
      await refreshClient.post(AUTH_ROUTES.refresh, {})
    },
  })

  return overviewStatsClient
}

export async function getDashboardStats(options: GetDashboardStatsOptions = {}): Promise<DashboardStats> {
  const client = getOverviewStatsClient()

  try {
    const { data } = await client.get<{ data: DashboardStats }>(OVERVIEW_STATS_ROUTES.get, {
      params: {
        campaignId: options.campaignId,
        includeRecentCampaigns: options.includeRecentCampaigns,
        recentCampaignsLimit: options.recentCampaignsLimit,
      },
    })

    return data.data
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      const { data } = await client.get<{ data: DashboardStats }>(`${OVERVIEW_STATS_ROUTES.get}/`, {
        params: {
          campaignId: options.campaignId,
          includeRecentCampaigns: options.includeRecentCampaigns,
          recentCampaignsLimit: options.recentCampaignsLimit,
        },
      })

      return data.data
    }

    throw error
  }
}

export { ApiError }
