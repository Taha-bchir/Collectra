-- AlterTable
ALTER TABLE "ClientToken" ALTER COLUMN "expiresAt" SET DEFAULT now() + interval '7 days';

-- AlterTable
ALTER TABLE "WorkspaceInvitation" ALTER COLUMN "id" DROP DEFAULT;
