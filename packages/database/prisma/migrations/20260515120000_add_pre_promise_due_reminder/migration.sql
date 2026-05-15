-- Track which promise calendar date we already emailed a pre-due reminder for (per debt).
ALTER TABLE "Debt" ADD COLUMN IF NOT EXISTS "prePromiseDueReminderSentFor" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Debt_status_promiseDate_idx" ON "Debt"("status", "promiseDate");
