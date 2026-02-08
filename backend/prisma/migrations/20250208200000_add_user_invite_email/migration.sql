-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "inviteEmail" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_inviteEmail_key" ON "User"("inviteEmail");
