# Full Tracking Flow (End-to-End)

Updated: 2026-04-12

This document explains how tracking is implemented across backend and frontend, from email send to dashboard updates.

## 1. Goal

Tracking is designed to answer:
- Was an email sent?
- Did the customer interact with the link?
- Is there a spam-type signal?
- How does UI update without manual refresh?

## 2. Core Data Sources

Tracking data comes from:
- `CustomerActionHistory` (main action timeline per debt/customer)
- `BrevoEventLog` (provider-level raw/normalized event storage)

In practice, dashboard and customer tracking states are derived from action history plus mapped provider events.

## 3. Send Phase (Campaign CSV Import)

When CSV import runs:
- Campaign and debts are created.
- Email notifications are prepared per debt/customer.
- Brevo sender returns which debt emails were successfully sent.
- Successful sends are persisted as `EMAIL_SENT` actions.

Why this matters:
- It creates a reliable baseline for tracking (`SENT`).
- Failed sends are not falsely tracked as sent.

## 4. Click/Open Collection Phase

Two public tracking paths exist:
- Pixel/open path: records open-like provider interaction data.
- Click redirect path: records click event server-side before redirecting user to the client page.

Important current behavior:
- Click tracking was moved to server redirect to avoid inflated counts from client page auto-triggers.

## 5. Provider Webhook Ingestion

Brevo webhook endpoint receives provider events and maps them into internal actions.

Pipeline:
- Validate webhook token.
- Parse one or multiple payload events.
- Resolve event target (`debtId`, `customerId`, optional `campaignId`) via hints/fallbacks.
- Persist mapped action + metadata.
- Persist provider log row for diagnostics.

This ensures provider events can be correlated to local campaign debts.

## 6. Status Model (Current)

Current allowed tracking statuses are intentionally simplified to:
- `SENT`
- `CLICKED`
- `SPAM`

Other signals can still be counted internally, but final customer tracking status is reduced to the three states above.

Priority for final status resolution:
1. `SPAM`
2. `CLICKED`
3. `SENT`

## 7. Customer Tracking Summary Rules

Customer tracking summary includes counters like sent/clicked/spam and latest activity timestamps.

`In Progress` card behavior:
- Counts non-paid debts that have at least one sent action.
- Paid debts are excluded so card updates correctly after payment.

## 8. Campaign Tracking Stats

Campaign email stats are aggregated per campaign and include:
- `sent`
- `clicked`
- `other`
- summary totals and last event timestamp

Manual refresh path:
- Trigger Brevo sync endpoint.
- Fetch fresh campaign stats.

## 9. Real-Time UX Behavior

### Customer tracking page
- Auto-refresh every 8 seconds.
- Refresh on tab focus.
- Refresh on visibility return.
- Uses in-flight guard to avoid overlapping requests.
- Shows sync state in UI.

### Campaign email stats card
- Auto-refresh every 8 seconds.
- Refresh on tab focus/visibility.
- Manual Refresh still forces sync-then-fetch.
- Uses request guards to prevent stale race conditions.

## 10. Filtering UX (Customer Tracking)

Customer tracking page is campaign-first:
- User must select a campaign before debt cards are shown.
- Optional status filter can refine results (`ALL`, `SENT`, `CLICKED`, `SPAM`).

This avoids noisy initial rendering when a customer has many debts.

## 11. Key Endpoints Involved

- Campaign import and email send: `/api/v1/campaigns/import-csv`
- Campaign email stats: `/api/v1/campaigns/{id}/email-stats`
- Campaign provider sync: `/api/v1/campaigns/{id}/brevo-logs/sync`
- Customer tracking: `/api/v1/customers/{id}/tracking`
- Brevo webhook ingestion: `/api/v1/webhooks/brevo/events`
- Public tracking routes under: `/api/v1/public/debts/*`

## 12. Operational Notes

- If provider sync fails, UI still attempts local stats fetch as fallback.
- If webhook events are ambiguous, target resolution fallback strategies are used.
- If no new events arrive, auto-refresh keeps UI current without user refresh.

## 13. Quick Troubleshooting

If numbers do not change:
- Verify webhook token and delivery from Brevo.
- Verify debt/customer resolution in webhook processing.
- Verify actions are written into `CustomerActionHistory`.
- Verify selected campaign filter on customer page.
- Wait for auto-refresh cycle (up to ~8 seconds) or use manual refresh in campaign stats card.

## 14. Current Product Behavior Summary

- Status values shown to users are intentionally minimal (`SENT`, `CLICKED`, `SPAM`).
- Opened is not shown as a status now.
- Tracking views auto-refresh and should not require manual page reload.
