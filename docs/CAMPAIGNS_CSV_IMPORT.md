# Campaigns CSV Import

This document describes the campaign import workflow implemented in API and dashboard UI.

## Overview

One CSV file creates one campaign.

Flow:

1. User selects CSV in dashboard at `/campaigns`.
2. Frontend previews rows and validation errors before insert.
3. Backend imports valid rows and skips invalid rows.
4. API returns campaign data, import stats, and skipped row reasons.

## API Endpoints

Base path: `/api/v1/campaigns`

- `GET /api/v1/campaigns`
- `GET /api/v1/campaigns/{id}`
- `POST /api/v1/campaigns/import-csv` (`multipart/form-data`)

All routes are authenticated and workspace-scoped.

## CSV Schema

Required columns:

- `fullName`
- `amount`
- `dueDate`

Optional columns:

- `email`
- `phone`
- `address`
- `status`

Accepted header aliases are handled both in frontend preview and backend parser.

## Status Mapping

Input values are normalized to debt statuses:

- `imported`, `new` -> `IMPORTED`
- `notify`, `notified`, `sent` -> `NOTIFIED`
- `promise`, `promised`, `promise_to_pay`, `promised_to_pay` -> `PROMISE_TO_PAY`
- `paid`, `paied`, `payed`, `settled` -> `PAID`
- `overdue`, `late`, `unpaid`, `defaulted` -> `OVERDUE_AFTER_PROMISE`

If `status` is omitted, backend defaults to `IMPORTED`.

## Validation Behavior

Frontend preview (`apps/web/features/campaigns/utils/csv-preview.ts`):

- Detects delimiter (`,`, `;`, `TAB`)
- Verifies required columns
- Validates `fullName`, `amount`, `dueDate`, optional `email`, and optional `status`
- Shows row-level errors before import

Backend import (`apps/api/src/services/campaigns.ts`):

- Re-validates rows server-side
- Skips invalid rows with explicit reasons
- Creates/links clients by workspace + email/phone
- Creates debts under the created campaign

## Dashboard UI

Page: `apps/web/app/(dashboard)/campaigns/page.tsx`

Features:

- CSV file input with local preview
- Campaign name and description form
- Preview stats (`total`, `valid`, `invalid`)
- Error table (first 15 row errors)
- Campaign list table with status and debt count
- Campaign details panel via `GET /api/v1/campaigns/{id}`
