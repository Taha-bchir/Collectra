-- Add indexes to support tenant-scoped customer and debt list queries.
CREATE INDEX IF NOT EXISTS "Campaign_workspaceId_idx" ON "Campaign"("workspaceId");
CREATE INDEX IF NOT EXISTS "Client_workspaceId_idx" ON "Client"("workspaceId");
CREATE INDEX IF NOT EXISTS "Client_workspaceId_fullName_idx" ON "Client"("workspaceId", "fullName");
CREATE INDEX IF NOT EXISTS "Client_workspaceId_email_idx" ON "Client"("workspaceId", "email");
CREATE INDEX IF NOT EXISTS "Debt_campaignId_status_createdAt_idx" ON "Debt"("campaignId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "Debt_campaignId_clientId_idx" ON "Debt"("campaignId", "clientId");
CREATE INDEX IF NOT EXISTS "Debt_clientId_createdAt_idx" ON "Debt"("clientId", "createdAt");
