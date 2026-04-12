-- Apply UNPAID as the runtime default and normalize existing IMPORTED rows.
ALTER TABLE "Debt" ALTER COLUMN "status" SET DEFAULT 'UNPAID';

UPDATE "Debt"
SET "status" = 'UNPAID'
WHERE "status" = 'IMPORTED';
