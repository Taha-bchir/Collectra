/*
  Warnings:

  - You are about to drop the column `matriculeFiscal` on the `Company` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Company_matriculeFiscal_key";

-- AlterTable
ALTER TABLE "Company" DROP COLUMN "matriculeFiscal";
