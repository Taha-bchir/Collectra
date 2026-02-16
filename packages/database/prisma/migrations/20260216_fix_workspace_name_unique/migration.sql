/*
  Warnings:

  - A unique constraint covering the columns `[name]` on the table `Workspace` has been removed. If you want to create the constraint from scratch, you will need to add the column `name` back in.
  - Made the column `createdByUserId` on table `Workspace` required. This step will fail if there are existing NULL values.

*/
-- DropIndex
DROP INDEX IF EXISTS "Workspace_name_key";

-- DropForeignKey
ALTER TABLE "Workspace" DROP CONSTRAINT "Workspace_createdByUserId_fkey";

-- AlterTable
ALTER TABLE "Workspace" ALTER COLUMN "createdByUserId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_createdByUserId_name_key" ON "Workspace"("createdByUserId", "name");
