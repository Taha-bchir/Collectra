/*
  Warnings:

  - A unique constraint covering the columns `[customerToken]` on the table `Debt` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "ClientToken" ALTER COLUMN "expiresAt" SET DEFAULT now() + interval '7 days';

-- AlterTable
ALTER TABLE "Debt" ADD COLUMN     "customerToken" TEXT,
ADD COLUMN     "tokenExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Debt_customerToken_key" ON "Debt"("customerToken");
