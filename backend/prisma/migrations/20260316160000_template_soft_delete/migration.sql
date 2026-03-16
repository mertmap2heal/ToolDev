-- Template Soft Delete
-- Adds deletedAt and deletedById to RequirementExportTemplate for archive/restore support.

ALTER TABLE "RequirementExportTemplate"
  ADD COLUMN IF NOT EXISTS "deletedAt"   TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "deletedById" TEXT;

CREATE INDEX IF NOT EXISTS "RequirementExportTemplate_deletedAt_idx"
  ON "RequirementExportTemplate"("deletedAt");
