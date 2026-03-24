/*
  Warnings:

  - You are about to drop the column `customerToken` on the `Debt` table. All the data in the column will be lost.
  - You are about to drop the column `tokenExpiresAt` on the `Debt` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Debt_customerToken_key";

-- AlterTable
ALTER TABLE "ClientToken" ALTER COLUMN "expiresAt" SET DEFAULT now() + interval '7 days';

-- AlterTable
ALTER TABLE "Debt" DROP COLUMN "customerToken",
DROP COLUMN "tokenExpiresAt";

-- AlterTable
ALTER TABLE "WorkspaceInvitation" ALTER COLUMN "id" DROP DEFAULT;
