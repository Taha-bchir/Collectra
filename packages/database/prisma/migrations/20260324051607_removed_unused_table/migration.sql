/*
  Warnings:

  - You are about to drop the `ClientToken` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ClientToken" DROP CONSTRAINT "ClientToken_campaignId_fkey";

-- DropForeignKey
ALTER TABLE "ClientToken" DROP CONSTRAINT "ClientToken_debtId_fkey";

-- DropTable
DROP TABLE "ClientToken";
