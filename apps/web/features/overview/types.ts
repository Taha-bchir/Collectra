export interface GetDashboardStatsOptions {
	campaignId?: string
	includeRecentCampaigns?: boolean
	recentCampaignsLimit?: number
}

export type DashboardStats = Record<string, unknown>