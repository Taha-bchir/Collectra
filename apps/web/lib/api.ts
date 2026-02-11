/**
 * Re-exports from the axios-based API client.
 * All HTTP is done via createApiClient (used by stores). No fetch.
 */
export { ApiError, createApiClient, createCookieAuthApiClient } from './api-client'
export type { CreateApiClientConfig, CreateCookieAuthApiClientConfig } from './api-client'
