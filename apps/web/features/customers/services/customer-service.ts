import axios from 'axios'

import { AUTH_ROUTES } from '@/features/auth/services/auth-service'
import { ApiError, createCookieAuthApiClient } from '@/lib/api-client'

export type DebtStatus = 'IMPORTED' | 'UNPAID' | 'NOTIFIED' | 'PROMISE_TO_PAY' | 'PAID' | 'OVERDUE_AFTER_PROMISE'

export type CustomerListQuery = {
  search?: string
  status?: DebtStatus
  clicked?: boolean
  campaignId?: string
  page?: number
  limit?: number
  pageSize?: number
}

export type UpdateCustomerInput = {
  fullName?: string
  email?: string | null
  phone?: string | null
  address?: string | null
}

export type CustomerListItem = {
  customer: {
    id: string
    fullName: string
    email: string | null
    phone: string | null
    address: string | null
    createdAt: string
    updatedAt: string
  }
  debt: {
    id: string
    campaignId: string
    campaignName: string
    amount: number
    currency: string
    dueDate: string
    promiseDate: string | null
    status: DebtStatus
    linkOpenCount: number
    linkOpenTimes: string[]
    createdAt: string
    updatedAt: string
  }
}

export type CustomerListResponse = {
  data: CustomerListItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export type CustomerTrackingStatus =
  | 'SENT'
  | 'CLICKED'
  | 'SPAM'

export type CustomerTrackingEvent = {
  id: string
  debtId: string | null
  timestamp: string
  actionType: string
  eventName: string | null
  channel: string | null
  metadata?: Record<string, unknown> | null
}

export type CustomerDebtTracking = {
  debtId: string
  campaignId: string
  campaignName: string
  debtStatus: DebtStatus
  sentCount: number
  deliveredCount: number
  openedCount: number
  clickedCount: number
  spamCount: number
  bouncedCount: number
  unsubscribedCount: number
  publicLinkVisitCount: number
  notSent: boolean
  notSeen: boolean
  status: CustomerTrackingStatus
  lastEventAt: string | null
  lastSeenAt: string | null
  events: CustomerTrackingEvent[]
}

export type CustomerCommunicationTracking = {
  customerId: string
  summary: {
    totalDebts: number
    sentDebts: number
    notSentDebts: number
    deliveredCount: number
    openedCount: number
    clickedCount: number
    spamCount: number
    bouncedCount: number
    unsubscribedCount: number
    publicLinkVisitCount: number
    lastEventAt: string | null
  }
  debts: CustomerDebtTracking[]
}

export type CustomerDetails = {
  id: string
  fullName: string
  email: string | null
  phone: string | null
  address: string | null
  createdAt: string
  updatedAt: string
  debts: Array<{
    id: string
    campaignId: string
    campaignName: string
    amount: number
    currency: string
    dueDate: string
    promiseDate: string | null
    status: DebtStatus
    createdAt: string
    updatedAt: string
    promises: Array<{
      id: string
      debtId: string
      promisedDate: string
      status: 'ACTIVE' | 'KEPT' | 'BROKEN' | 'CANCELLED'
      createdAt: string
      updatedAt: string
    }>
  }>
  actionHistory: Array<{
    id: string
    debtId: string | null
    customerId: string
    actionType: string
    timestamp: string
    performedBy: string | null
    metadata?: Record<string, unknown> | null
    createdAt: string
  }>
}

export type DebtPersonalLinkResult = {
  link: string
  token: string
  expiresAt: string
}

export const CUSTOMER_ROUTES = {
  list: '/api/v1/customers/',
  listWithSlash: '/api/v1/customers',
  byId: (id: string) => `/api/v1/customers/${id}`,
  tracking: (id: string) => `/api/v1/customers/${id}/tracking`,
  debtPersonalLink: (debtId: string) => `/api/v1/debts/${debtId}/personal-link`,
} as const

const baseURL = process.env.NEXT_PUBLIC_API_URL!.replace(/\/$/, '')

let customersClient: ReturnType<typeof createCookieAuthApiClient> | null = null

function getCustomersClient() {
  if (customersClient) return customersClient

  const refreshClient = axios.create({
    baseURL: baseURL.replace(/\/$/, ''),
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true,
  })

  customersClient = createCookieAuthApiClient({
    baseURL,
    useCookies: true,
    refreshUrl: AUTH_ROUTES.refresh,
    onRefresh: async () => {
      await refreshClient.post(AUTH_ROUTES.refresh, {})
    },
  })

  return customersClient
}

export async function listCustomers(query: CustomerListQuery = {}): Promise<CustomerListResponse> {
  const client = getCustomersClient()

  try {
    const { data } = await client.get<CustomerListResponse>(CUSTOMER_ROUTES.list, {
      params: query,
    })
    return data
  } catch (error) {
    const isNotFound =
      (error instanceof ApiError && error.status === 404) ||
      (axios.isAxiosError(error) && error.response?.status === 404)

    if (isNotFound) {
      const { data } = await client.get<CustomerListResponse>(CUSTOMER_ROUTES.listWithSlash, {
        params: query,
      })
      return data
    }

    throw error
  }
}

export async function getCustomerById(id: string): Promise<CustomerDetails> {
  const client = getCustomersClient()
  const { data } = await client.get<{ data: CustomerDetails }>(CUSTOMER_ROUTES.byId(id))
  return data.data
}

export async function getCustomerTracking(id: string): Promise<CustomerCommunicationTracking> {
  const client = getCustomersClient()
  const { data } = await client.get<{ data: CustomerCommunicationTracking }>(CUSTOMER_ROUTES.tracking(id))
  return data.data
}

export async function getDebtPersonalLink(debtId: string): Promise<DebtPersonalLinkResult> {
  const client = getCustomersClient()
  const { data } = await client.get<{ data: DebtPersonalLinkResult }>(CUSTOMER_ROUTES.debtPersonalLink(debtId))
  return data.data
}

export async function updateCustomer(id: string, payload: UpdateCustomerInput): Promise<CustomerDetails> {
  const client = getCustomersClient()
  const { data } = await client.patch<{ data: CustomerDetails }>(CUSTOMER_ROUTES.byId(id), payload)
  return data.data
}

export { ApiError }
