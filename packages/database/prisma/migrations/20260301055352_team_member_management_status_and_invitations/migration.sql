-- AlterTable
ALTER TABLE "ClientToken" ALTER COLUMN "expiresAt" SET DEFAULT now() + interval '7 days';

-- AlterTable
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.tables
		WHERE table_schema = 'public'
			AND table_name = 'WorkspaceInvitation'
	) THEN
		ALTER TABLE "WorkspaceInvitation" ALTER COLUMN "id" DROP DEFAULT;
	END IF;
END $$;
