-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mustChangePasswordOnFirstLogin" BOOLEAN NOT NULL DEFAULT false;
