# Customers Endpoint Changes (2026-04-08)

## Goal implemented
Add a tenant-scoped customers list endpoint that supports pagination and filters and returns customer + debt summary in one response.

## API contract updates

### Updated endpoint
- `GET /api/v1/customers`

### New query params
- `status` (optional, debt status)
- `search` (optional, customer `fullName` or `email`)
- `campaignId` (optional)
- `page` (optional, min 1)
- `limit` (optional, min 1, max 100)

### New response shape
```json
{
  "data": [
    {
      "customer": {
        "id": "...",
        "fullName": "...",
        "email": "...",
        "phone": "...",
        "address": "...",
        "createdAt": "...",
        "updatedAt": "..."
      },
      "debt": {
        "id": "...",
        "campaignId": "...",
        "campaignName": "...",
        "amount": 0,
        "dueDate": "...",
        "promiseDate": null,
        "status": "UNPAID",
        "createdAt": "...",
        "updatedAt": "..."
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 0,
    "totalPages": 1
  }
}
```

## Files changed

### Endpoint schema
- `apps/api/src/schema/v1/customers.schema.ts`
- Added:
  - `CustomerDebtSummarySchema`
  - `CustomerWithDebtSummarySchema`
  - `PaginationSchema`
- Updated `listCustomersSchema` query and 200 response to the new structure.

### Route handler
- `apps/api/src/routes/v1/customers/actions.ts`
- `customers.list` now calls `listWithDebtSummary(...)` and returns `{ data, pagination }`.

### Service logic
- `apps/api/src/services/customers.ts`
- Added `listWithDebtSummary(workspaceId, options)`:
  - Tenant-scoped filtering by workspace
  - Optional filters: `status`, `search`, `campaignId`
  - Pagination with `page`/`limit`
  - Returns one debt summary row per listed customer (latest debt by `createdAt` for matching filters)

## Performance/index updates

### Prisma schema indexes
- `packages/database/prisma/schema.prisma`
- Added indexes:
  - `Campaign(workspaceId)`
  - `Client(workspaceId)`
  - `Client(workspaceId, fullName)`
  - `Client(workspaceId, email)`
  - `Debt(campaignId, status, createdAt)`
  - `Debt(campaignId, clientId)`
  - `Debt(clientId, createdAt)`

### Migration added
- `packages/database/prisma/migrations/20260408143000_add_customer_debt_list_indexes/migration.sql`
- Creates all indexes above with `CREATE INDEX IF NOT EXISTS`.

## TypeScript config fixes

### Fixed TS6 diagnostics
- `apps/api/tsconfig.json`
- `packages/types/tsconfig.json`

Both files now explicitly set:
- `rootDir: "./src"` (fixes common source directory warning)
- `ignoreDeprecations: "6.0"` (silences TS6 `baseUrl` deprecation warning)

## Testing support added
- Postman collection:
  - `docs/postman/customers-endpoint-tests.postman_collection.json`
- Includes 5 scenarios:
  - Pagination only
  - Status filter
  - Search filter
  - Campaign filter
  - Combined filters

## Swagger testing
You can test this endpoint in Swagger at:
- `http://localhost:3000/docs`

Use `Authorize` with `Bearer <access_token>`, then execute `GET /api/v1/customers` with desired query params.
