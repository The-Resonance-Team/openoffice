-- AlterTable
ALTER TABLE "User" ADD COLUMN     "inviteEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "memberJoinEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "passwordChangeEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "recoveryCodes" TEXT,
ADD COLUMN     "theme" TEXT NOT NULL DEFAULT 'system',
ADD COLUMN     "totpEnabledAt" TIMESTAMP(3),
ADD COLUMN     "totpSecret" TEXT,
ADD COLUMN     "wantsUpdates" BOOLEAN NOT NULL DEFAULT true;
