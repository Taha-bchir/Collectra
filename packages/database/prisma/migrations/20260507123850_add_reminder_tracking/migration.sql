/*
  Warnings:

  - You are about to drop the `Invoice` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_debtId_fkey";

-- AlterTable
ALTER TABLE "PaymentPromise" ADD COLUMN     "reminderSentAt1Day" TIMESTAMP(3),
ADD COLUMN     "reminderSentAt3Days" TIMESTAMP(3);

-- DropTable
DROP TABLE "Invoice";

-- CreateIndex
CREATE INDEX "PaymentPromise_promisedDate_idx" ON "PaymentPromise"("promisedDate");
