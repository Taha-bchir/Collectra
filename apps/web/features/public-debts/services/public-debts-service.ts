import axios from 'axios'

import { ApiError } from '@/lib/api-client'

export type PublicDebtView = {
  debtId: string
  amount: number
  dueDate: string
  promiseDate?: string | null
  status: 'IMPORTED' | 'UNPAID' | 'NOTIFIED' | 'PROMISE_TO_PAY' | 'PAID' | 'OVERDUE_AFTER_PROMISE'
  campaignName: string
  workspaceName?: string | null
  tokenExpiresAt: string | null
  customer: {
    fullName: string
    email: string | null
    phone: string | null
  }
}

const baseURL = process.env.NEXT_PUBLIC_API_URL!.replace(/\/$/, '')

const client = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
})

export async function getPublicDebtByToken(token: string): Promise<PublicDebtView> {
  try {
    console.log('[API] Fetching debt for token:', token.substring(0, 10) + '...')
    const { data } = await client.get<{ data: PublicDebtView }>(`/api/v1/public/debts/${token}`)
    console.log('[API] Debt fetched successfully. Status:', data.data.status)
    return data.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 0
      const payload = error.response?.data as
        | { error?: { message?: string }; message?: string }
        | undefined

      const message =
        payload?.error?.message || payload?.message || error.message || 'Failed to load debt details'

      console.error('[API] Error fetching debt:', message)
      throw new ApiError(message, status, payload)
    }

    throw new ApiError(error instanceof Error ? error.message : 'Failed to load debt details', 0)
  }
}

export async function createPublicPromiseByToken(token: string, promisedDate: string) {
  try {
    const { data } = await client.post<{
      data: { debtId: string; status: PublicDebtView['status']; promiseDate: string }
    }>(`/api/v1/public/debts/${token}/promise`, {
      promisedDate,
    })

    return data.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 0
      const payload = error.response?.data as
        | {
            error?: { message?: string } | string
            message?: string
            details?: Array<{ message?: string; path?: Array<string | number> }>
          }
        | undefined

      const validationHint =
        Array.isArray(payload?.details) && payload.details.length > 0
          ? payload.details.map((issue) => issue.message).filter(Boolean).join('. ')
          : ''

      const errorBody =
        typeof payload?.error === 'string'
          ? payload.error
          : payload?.error?.message

      const message =
        errorBody ||
        payload?.message ||
        validationHint ||
        error.message ||
        'Failed to save promise date'
      throw new ApiError(message, status, payload)
    }

    throw new ApiError(error instanceof Error ? error.message : 'Failed to save promise date', 0)
  }
}

export async function createPublicFakePaymentByToken(token: string) {
  try {
    const { data } = await client.post<{
      data: { debtId: string; status: PublicDebtView['status'] }
    }>(`/api/v1/public/debts/${token}/fake-payment`)

    return data.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 0
      const payload = error.response?.data as
        | { error?: { message?: string }; message?: string }
        | undefined

      const message = payload?.error?.message || payload?.message || error.message || 'Failed to process fake payment'
      throw new ApiError(message, status, payload)
    }

    throw new ApiError(error instanceof Error ? error.message : 'Failed to process fake payment', 0)
  }
}

export async function createPublicStripeCheckoutSessionByToken(token: string) {
  try {
    const { data } = await client.post<{
      data: { sessionId: string; checkoutUrl: string }
    }>(`/api/v1/public/debts/${token}/stripe/checkout-session`)

    return data.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 0
      const payload = error.response?.data as
        | { error?: { message?: string }; message?: string }
        | undefined

      const message =
        payload?.error?.message ||
        payload?.message ||
        error.message ||
        'Failed to create Stripe checkout session'
      throw new ApiError(message, status, payload)
    }

    throw new ApiError(
      error instanceof Error ? error.message : 'Failed to create Stripe checkout session',
      0,
    )
  }
}

export async function trackPublicDebtClickByToken(token: string) {
  try {
    const { data } = await client.post<{
      data: { debtId: string; tracked: true }
    }>(`/api/v1/public/debts/${token}/track-click`)

    return data.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 0
      const payload = error.response?.data as
        | { error?: { message?: string }; message?: string }
        | undefined

      const message = payload?.error?.message || payload?.message || error.message || 'Failed to track link click'
      throw new ApiError(message, status, payload)
    }

    throw new ApiError(error instanceof Error ? error.message : 'Failed to track link click', 0)
  }
}

export async function verifyStripePaymentByToken(token: string, sessionId?: string | null) {
  try {
    const url = `/api/v1/public/debts/${token}/verify-payment${sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : ''}`
    const { data } = await client.get<{
      data: { debtId: string; debtStatus: PublicDebtView['status']; isPaid: boolean }
    }>(url)

    return data.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 0
      const payload = error.response?.data as
        | { error?: { message?: string }; message?: string }
        | undefined

      const message = payload?.error?.message || payload?.message || error.message || 'Failed to verify payment status'
      throw new ApiError(message, status, payload)
    }

    throw new ApiError(
      error instanceof Error ? error.message : 'Failed to verify payment status',
      0,
    )
  }
}

export function getPublicDebtInvoiceUrl(token: string) {
  return `${baseURL}/api/v1/public/debts/${encodeURIComponent(token)}/invoice`
}

