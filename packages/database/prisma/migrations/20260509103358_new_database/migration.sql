/*
  Warnings:

  - You are about to drop the column `reminderSentAt1Day` on the `PaymentPromise` table. All the data in the column will be lost.
  - You are about to drop the column `reminderSentAt3Days` on the `PaymentPromise` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "PaymentPromise_promisedDate_idx";

-- AlterTable
ALTER TABLE "PaymentPromise" DROP COLUMN "reminderSentAt1Day",
DROP COLUMN "reminderSentAt3Days";
