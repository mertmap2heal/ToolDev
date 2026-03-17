-- AlterTable
ALTER TABLE "VerTestPlan" ADD COLUMN IF NOT EXISTS "testingEnvironmentIds" JSONB,
ADD COLUMN IF NOT EXISTS "testingToolIds" JSONB;
