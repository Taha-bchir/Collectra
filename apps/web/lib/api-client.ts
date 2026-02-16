import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'

type RequestConfigWithRetry = InternalAxiosRequestConfig & { _retry?: boolean }

/**
 * API error with status and optional response data.
 * No store imports - used by stores and normalizers.
 */
export class ApiError extends Error {
  status: number
  data: unknown

  constructor(message: string, status: number, data?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

/** Bearer token auth (e.g. tokens in memory/localStorage). */
export interface CreateApiClientConfig {
  baseURL: string
  getToken: () => string | null
  onRefresh: () => Promise<string>
}

/** Cookie-based auth: no token in JS; refresh via POST with credentials. */
export interface CreateCookieAuthApiClientConfig {
  baseURL: string
  useCookies: true
  refreshUrl: string
  onRefresh: () => Promise<void>
}

function normalizeError(err: unknown): ApiError {
  if (err instanceof ApiError) return err
  if (axios.isAxiosError(err)) {
    const status = err.response?.status ?? 0
    const payload = err.response?.data
    let message: string | undefined
    if (payload && typeof payload === 'object') {
      const body = payload as Record<string, unknown>
      if (typeof body?.error === 'object' && body.error !== null && 'message' in body.error) {
        message = (body.error as { message?: string }).message as string | undefined
      }
      if (!message && typeof body?.message === 'string') message = body.message
    }
    const apiError = new ApiError(message ?? err.message ?? 'Request failed', status, payload)
    if (status === 403) {
      console.error('[api-client] 403 Forbidden:', { message: apiError.message, data: payload, headers: err.response?.headers })
    }
    return apiError
  }
  return new ApiError(err instanceof Error ? err.message : 'Request failed', 0, undefined)
}

/**
 * Creates an axios instance with Bearer token auth:
 * - Request interceptor: adds Authorization Bearer when getToken() returns a value
 * - Response interceptor: on 401 calls onRefresh(), retries with new token
 */
export function createApiClient(config: CreateApiClientConfig): AxiosInstance {
  const { baseURL, getToken, onRefresh } = config
  const client = axios.create({
    baseURL: baseURL.replace(/\/$/, ''),
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true,
  })

  client.interceptors.request.use((req: InternalAxiosRequestConfig) => {
    const token = getToken()
    if (token) {
      req.headers.Authorization = `Bearer ${token}`
    }
    return req
  })

  let isRefreshing = false
  let refreshSubscribers: ((token: string) => void)[] = []

  function onRefreshed(token: string) {
    refreshSubscribers.forEach((cb) => cb(token))
    refreshSubscribers = []
  }

  client.interceptors.response.use(
    (res) => res,
    async (err) => {
      const originalRequest = err.config
      const config = originalRequest as RequestConfigWithRetry
      if (err.response?.status === 401 && config && !config._retry) {
        if (!isRefreshing) {
          isRefreshing = true
          config._retry = true
          try {
            const newToken = await onRefresh()
            isRefreshing = false
            onRefreshed(newToken)
            config.headers.Authorization = `Bearer ${newToken}`
            return client(config)
          } catch (refreshErr) {
            isRefreshing = false
            throw normalizeError(refreshErr)
          }
        }
        return new Promise((resolve, reject) => {
          refreshSubscribers.push((token: string) => {
            config.headers.Authorization = `Bearer ${token}`
            client(config).then(resolve).catch(reject)
          })
        })
      }
      throw normalizeError(err)
    },
  )

  return client
}

/**
 * Creates an axios instance for cookie-based auth (no tokens in JS):
 * - No Authorization header; browser sends HTTP-only cookies
 * - On 401: calls onRefresh() (e.g. POST refresh with credentials), then retries
 */
export function createCookieAuthApiClient(config: CreateCookieAuthApiClientConfig): AxiosInstance {
  const { baseURL, refreshUrl, onRefresh } = config
  const client = axios.create({
    baseURL: baseURL.replace(/\/$/, ''),
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true,
  })

  client.interceptors.request.use((req) => {
    if (typeof window !== 'undefined') {
      const cookies = document.cookie.split('; ').reduce((acc: Record<string, string>, cookie) => {
        const [key, value] = cookie.split('=')
        acc[key] = value
        return acc
      }, {})
      if (cookies.access_token) {
        console.log('[api-client] Request with cookies:', { url: req.url, hasAccessToken: true })
      }
    }
    return req
  })

  let isRefreshing = false
  let refreshSubscribers: (() => void)[] = []

  function onRefreshed() {
    refreshSubscribers.forEach((cb) => cb())
    refreshSubscribers = []
  }

  client.interceptors.response.use(
    (res) => res,
    async (err) => {
      const originalRequest = err.config
      const config = originalRequest as RequestConfigWithRetry
      if (err.response?.status === 401 && config && !config._retry) {
        if (!isRefreshing) {
          isRefreshing = true
          config._retry = true
          try {
            await onRefresh()
            isRefreshing = false
            onRefreshed()
            return client(config)
          } catch (refreshErr) {
            isRefreshing = false
            throw normalizeError(refreshErr)
          }
        }
        return new Promise((resolve, reject) => {
          refreshSubscribers.push(() => {
            client(config).then(resolve).catch(reject)
          })
        })
      }
      throw normalizeError(err)
    },
  )

  return client
}
