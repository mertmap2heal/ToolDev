-- Align RequirementExportTemplate table with new server-side export template model.
-- Generated via `prisma migrate diff` to match `prisma/schema.prisma`.

-- AlterTable
ALTER TABLE "RequirementExportTemplate"
  DROP COLUMN IF EXISTS "config",
  DROP COLUMN IF EXISTS "createdByName",
  DROP COLUMN IF EXISTS "description",
  ADD COLUMN IF NOT EXISTS "format" TEXT,
  ADD COLUMN IF NOT EXISTS "payload" JSONB;

-- Backfill not-null requirements for newly added columns if they were missing.
UPDATE "RequirementExportTemplate"
SET "format" = COALESCE("format", 'pdf')
WHERE "format" IS NULL;

UPDATE "RequirementExportTemplate"
SET "payload" = COALESCE("payload", '{}'::jsonb)
WHERE "payload" IS NULL;

ALTER TABLE "RequirementExportTemplate"
  ALTER COLUMN "format" SET NOT NULL,
  ALTER COLUMN "payload" SET NOT NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RequirementExportTemplate_projectId_format_idx" ON "RequirementExportTemplate"("projectId", "format");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RequirementExportTemplate_projectId_name_key" ON "RequirementExportTemplate"("projectId", "name");

