/*
  Warnings:

  - A unique constraint covering the columns `[matriculeFiscal]` on the table `Company` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "matriculeFiscal" TEXT,
ADD COLUMN     "website" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Company_matriculeFiscal_key" ON "Company"("matriculeFiscal");
