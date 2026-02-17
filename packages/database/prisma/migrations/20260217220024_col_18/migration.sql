/*
  Warnings:

  - You are about to drop the column `endDate` on the `Campaign` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `Campaign` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "PromiseStatus" AS ENUM ('ACTIVE', 'KEPT', 'BROKEN', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('LINK_SENT', 'LINK_CLICKED', 'PROMISE_MADE', 'PROMISE_UPDATED', 'PAYMENT_CONFIRMED', 'STATUS_CHANGED', 'NOTE_ADDED', 'EMAIL_SENT', 'SMS_SENT', 'PHONE_CALL', 'OTHER');

-- AlterTable
ALTER TABLE "Campaign" DROP COLUMN "endDate",
DROP COLUMN "startDate";

-- AlterTable
ALTER TABLE "ClientToken" ALTER COLUMN "expiresAt" SET DEFAULT now() + interval '7 days';

-- CreateTable
CREATE TABLE "PaymentPromise" (
    "id" UUID NOT NULL,
    "debtId" UUID NOT NULL,
    "promisedDate" TIMESTAMP(3) NOT NULL,
    "status" "PromiseStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentPromise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerActionHistory" (
    "id" UUID NOT NULL,
    "debtId" UUID,
    "customerId" UUID NOT NULL,
    "actionType" "ActionType" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "performedBy" UUID,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerActionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentPromise_debtId_idx" ON "PaymentPromise"("debtId");

-- CreateIndex
CREATE INDEX "PaymentPromise_status_idx" ON "PaymentPromise"("status");

-- CreateIndex
CREATE INDEX "CustomerActionHistory_customerId_timestamp_idx" ON "CustomerActionHistory"("customerId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "CustomerActionHistory_debtId_idx" ON "CustomerActionHistory"("debtId");

-- CreateIndex
CREATE INDEX "CustomerActionHistory_actionType_idx" ON "CustomerActionHistory"("actionType");

-- AddForeignKey
ALTER TABLE "PaymentPromise" ADD CONSTRAINT "PaymentPromise_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerActionHistory" ADD CONSTRAINT "CustomerActionHistory_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerActionHistory" ADD CONSTRAINT "CustomerActionHistory_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
