-- Centralized Brevo / email tracking event log.
CREATE TABLE IF NOT EXISTS "BrevoEventLog" (
  "id" uuid PRIMARY KEY,
  "provider" text NOT NULL,
  "source" text NOT NULL,
  "status" text NOT NULL DEFAULT 'created',
  "eventName" text NOT NULL,
  "email" text,
  "messageId" text,
  "debtId" uuid,
  "customerId" uuid,
  "campaignId" uuid,
  "occurredAt" timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "payload" jsonb NOT NULL,
  "resolutionStrategy" text,
  "skipReason" text,
  "createdAt" timestamp(3) without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BrevoEventLog_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "BrevoEventLog_campaignId_occurredAt_idx" ON "BrevoEventLog"("campaignId", "occurredAt");
CREATE INDEX IF NOT EXISTS "BrevoEventLog_campaignId_eventName_occurredAt_idx" ON "BrevoEventLog"("campaignId", "eventName", "occurredAt");
CREATE INDEX IF NOT EXISTS "BrevoEventLog_debtId_occurredAt_idx" ON "BrevoEventLog"("debtId", "occurredAt");
CREATE INDEX IF NOT EXISTS "BrevoEventLog_customerId_occurredAt_idx" ON "BrevoEventLog"("customerId", "occurredAt");
CREATE INDEX IF NOT EXISTS "BrevoEventLog_eventName_occurredAt_idx" ON "BrevoEventLog"("eventName", "occurredAt");
CREATE INDEX IF NOT EXISTS "BrevoEventLog_status_occurredAt_idx" ON "BrevoEventLog"("status", "occurredAt");