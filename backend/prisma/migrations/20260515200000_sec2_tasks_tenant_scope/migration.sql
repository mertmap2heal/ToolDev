-- SEC-2 (#375): project-scope AutomationRule + TaskTag
--
-- AutomationRule: was unscoped (no projectId). automation.routes.ts applied
-- authenticateToken only, and automation.service.ts getRules() returned every
-- customer's rules. Add nullable projectId so legacy rows can backfill via
-- backfillAutomationRuleProjectId.ts; orphan rules stay isActive=false +
-- projectId=NULL until admin reconciles (defense-in-depth).
--
-- TaskTag: was globally @unique on `name`, so two tenants couldn't both have
-- "blocker"; the second create failed with P2002 referencing a row the
-- caller could not see (existence-leak). Drop the global unique, add nullable
-- projectId, add composite @@unique([projectId, name]). Postgres treats NULL
-- as distinct under unique indexes, so multiple NULL-project tags with the
-- same name coexist; backfillTaskTagProjectId.ts duplicates tags used across
-- projects into per-project copies and updates TaskTagLink references.

-- AlterTable
ALTER TABLE "AutomationRule" ADD COLUMN "projectId" TEXT;

-- AlterTable
ALTER TABLE "TaskTag" ADD COLUMN "projectId" TEXT;

-- DropIndex
DROP INDEX IF EXISTS "TaskTag_name_key";

-- CreateIndex
CREATE INDEX "AutomationRule_projectId_idx" ON "AutomationRule"("projectId");

-- CreateIndex
CREATE INDEX "TaskTag_projectId_idx" ON "TaskTag"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskTag_projectId_name_key" ON "TaskTag"("projectId", "name");

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskTag" ADD CONSTRAINT "TaskTag_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
