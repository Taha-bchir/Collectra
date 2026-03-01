DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'WorkspaceRole' AND e.enumlabel = 'MANAGER'
  ) THEN
    ALTER TYPE "WorkspaceRole" ADD VALUE 'MANAGER';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WorkspaceMemberStatus') THEN
    CREATE TYPE "WorkspaceMemberStatus" AS ENUM ('ACTIVE', 'INACTIVE');
  END IF;
END $$;

ALTER TABLE "WorkspaceMember"
ADD COLUMN IF NOT EXISTS "status" "WorkspaceMemberStatus" NOT NULL DEFAULT 'ACTIVE';

CREATE TABLE IF NOT EXISTS "WorkspaceInvitation" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspaceId" UUID NOT NULL,
  "invitedByUserId" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "role" "WorkspaceRole" NOT NULL DEFAULT 'AGENT',
  "token" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WorkspaceInvitation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkspaceInvitation_token_key" UNIQUE ("token"),
  CONSTRAINT "WorkspaceInvitation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WorkspaceInvitation_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "WorkspaceInvitation_workspaceId_status_idx"
ON "WorkspaceInvitation"("workspaceId", "status");

CREATE INDEX IF NOT EXISTS "WorkspaceInvitation_email_idx"
ON "WorkspaceInvitation"("email");
