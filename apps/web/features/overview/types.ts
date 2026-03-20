export interface GetDashboardStatsOptions {
	campaignId?: string
	includeRecentCampaigns?: boolean
	recentCampaignsLimit?: number
}

export interface DashboardDebtStatusCounts {
	IMPORTED: number
	NOTIFIED: number
	PROMISE_TO_PAY: number
	PAID: number
	OVERDUE_AFTER_PROMISE: number
}

export interface DashboardRecentCampaignSummary {
	id: string
	name: string
	createdAt: string
	debtsCount: number
	promisedCount: number
	paidCount: number
}

export interface DashboardStats {
	scope: 'workspace' | 'campaign'
	campaignId: string | null
	statuses: DashboardDebtStatusCounts
	totalDebts: number
	totalOverdueAmount: number
	recentCampaigns?: DashboardRecentCampaignSummary[]
}