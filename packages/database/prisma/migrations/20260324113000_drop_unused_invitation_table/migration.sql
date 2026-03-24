-- Remove deprecated campaign-level invitation table.
-- Active invitation flows use WorkspaceInvitation.
DROP TABLE IF EXISTS "Invitation";
