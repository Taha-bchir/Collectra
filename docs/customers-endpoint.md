# Customers Endpoint Behavior

## Scope
This document describes the current logical behavior of `GET /api/v1/customers` and how the response is composed.

## 1) Endpoint Contract

### Before
- Endpoint: `GET /api/v1/customers`
- Query support:
  - `search` only
- Response:
  - `data: Customer[]`
- Behavior:
  - Returned raw customer rows only.
  - No debt summary included.

### After
- Endpoint: `GET /api/v1/customers`
- Query support:
  - `status` (optional)
  - `search` (optional)
  - `campaignId` (optional)
  - `page` (optional)
  - `limit` (optional)
- Response:
  - `data: Array<{ customer, debt }>`
  - `pagination: { page, limit, total, totalPages }`
- Behavior:
  - Returns one customer + matching debt summary per row.
  - Supports combined filtering and pagination.

## 2) Filtering Logic

### Before
1. Filter by `workspaceId`.
2. Optional text search on customer fields (`fullName`, `email`, `phone`).
3. No debt-based filtering.

### After
1. Build debt filter first:
   - tenant scope (`campaign.workspaceId`)
   - optional `status`
   - optional `campaignId`
2. Build customer filter:
   - tenant scope (`workspaceId`)
   - optional `search` on `fullName` or `email`
   - `debts.some(debtFilter)` to ensure each listed customer has at least one matching debt
3. Result rows only include customers that satisfy both customer and debt constraints.

## 3) Pagination Logic

### Before
- Service accepted `limit`/`offset` internally.
- Route did not expose standard page-based contract.
- No explicit pagination metadata in response.

### After
1. Read `page` and `limit` from request.
2. Clamp `limit` to safe bounds.
3. Count total matching customers.
4. Compute `totalPages` and normalize current page.
5. Fetch paged customer slice.
6. Return explicit pagination object.

## 4) Data Composition Logic

### Before
- Query returned customers directly.
- UI needed extra debt requests if debt details were required.

### After
1. Fetch paged customers first.
2. Fetch debts for returned customer IDs using the same debt filter.
3. Sort debts by `clientId` and latest `createdAt`.
4. Keep first debt per customer as summary.
5. Merge into final row format:
   - `customer` object
   - `debt` object (`amount`, `status`, `campaignName`, dates)

## 5) Tenant Isolation

### Before
- Tenant scope applied through workspace context for customer list.

### After
- Tenant scope is enforced in both parts of the query:
  - customer scope (`workspaceId`)
  - debt scope (`campaign.workspaceId`)
- Prevents cross-tenant leakage when using debt-based filters.

## 6) Performance and Indexing

### Before
- No dedicated composite indexes for the new customer+debt listing access pattern.

### After
Added indexes to support tenant-scoped filters, joins, and ordering:
- `Campaign(workspaceId)`
- `Client(workspaceId)`
- `Client(workspaceId, fullName)`
- `Client(workspaceId, email)`
- `Debt(campaignId, status, createdAt)`
- `Debt(campaignId, clientId)`
- `Debt(clientId, createdAt)`

These are applied via migration `20260408143000_add_customer_debt_list_indexes`.

## 7) Net Functional Outcome

### Before
- Customers list was customer-only and limited for debt-focused list UIs.

### After
- Customers list now directly supports debt dashboard/table rendering without additional per-row calls, while preserving tenant safety and pagination.
