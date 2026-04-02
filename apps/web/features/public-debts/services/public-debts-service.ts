import axios from 'axios'

import { ApiError } from '@/lib/api-client'

export type PublicDebtView = {
  debtId: string
  amount: number
  dueDate: string
  promiseDate?: string | null
  status: 'IMPORTED' | 'NOTIFIED' | 'PROMISE_TO_PAY' | 'PAID' | 'OVERDUE_AFTER_PROMISE'
  campaignName: string
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
    const { data } = await client.get<{ data: PublicDebtView }>(`/api/v1/public/debts/${token}`)
    return data.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 0
      const payload = error.response?.data as
        | { error?: { message?: string }; message?: string }
        | undefined

      const message =
        payload?.error?.message || payload?.message || error.message || 'Failed to load debt details'

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
        | { error?: { message?: string }; message?: string }
        | undefined

      const message = payload?.error?.message || payload?.message || error.message || 'Failed to save promise date'
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
