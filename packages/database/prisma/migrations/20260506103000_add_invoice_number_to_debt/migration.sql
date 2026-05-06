-- AlterTable
ALTER TABLE "Debt" ADD COLUMN "invoiceNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Debt_invoiceNumber_key" ON "Debt"("invoiceNumber");
