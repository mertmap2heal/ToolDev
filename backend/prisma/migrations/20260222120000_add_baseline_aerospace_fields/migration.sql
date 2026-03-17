-- AlterTable
ALTER TABLE "Baseline" ADD COLUMN "baselineType" TEXT;
ALTER TABLE "Baseline" ADD COLUMN "reviewType" TEXT;
ALTER TABLE "Baseline" ADD COLUMN "milestoneId" TEXT;
ALTER TABLE "Baseline" ADD COLUMN "approvedBy" TEXT;
ALTER TABLE "Baseline" ADD COLUMN "approvedByName" TEXT;
ALTER TABLE "Baseline" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "Baseline" ADD COLUMN "approvalNotes" TEXT;
ALTER TABLE "Baseline" ADD COLUMN "supersedesBaselineId" TEXT;
ALTER TABLE "Baseline" ADD COLUMN "configurationAuthority" TEXT;
ALTER TABLE "Baseline" ADD COLUMN "fdAL" TEXT;
