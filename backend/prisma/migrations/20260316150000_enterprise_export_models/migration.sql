-- Enterprise Export Models – Phase 2+
-- Adds: visibility to RequirementExportTemplate, ExportJob, CorporateDocxTemplate,
--       ExcelColumnMapping, ScheduledExport tables.

-- AlterTable: add visibility column to RequirementExportTemplate
ALTER TABLE "RequirementExportTemplate"
  ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT 'project';

-- CreateIndex: visibility
CREATE INDEX IF NOT EXISTS "RequirementExportTemplate_projectId_visibility_idx"
  ON "RequirementExportTemplate"("projectId", "visibility");

-- CreateTable: ExportJob
CREATE TABLE IF NOT EXISTS "ExportJob" (
    "id"          TEXT NOT NULL,
    "projectId"   TEXT NOT NULL,
    "createdById" TEXT,
    "format"      TEXT NOT NULL,
    "status"      TEXT NOT NULL DEFAULT 'pending',
    "progress"    INTEGER NOT NULL DEFAULT 0,
    "totalCount"  INTEGER NOT NULL DEFAULT 0,
    "doneCount"   INTEGER NOT NULL DEFAULT 0,
    "label"       TEXT,
    "error"       TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExportJob_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ExportJob"
  ADD CONSTRAINT "ExportJob_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "ExportJob_projectId_idx" ON "ExportJob"("projectId");
CREATE INDEX IF NOT EXISTS "ExportJob_projectId_status_idx" ON "ExportJob"("projectId", "status");
CREATE INDEX IF NOT EXISTS "ExportJob_createdById_idx" ON "ExportJob"("createdById");

-- CreateTable: CorporateDocxTemplate
CREATE TABLE IF NOT EXISTS "CorporateDocxTemplate" (
    "id"           TEXT NOT NULL,
    "projectId"    TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "description"  TEXT,
    "fileBase64"   TEXT NOT NULL,
    "placeholders" TEXT,
    "createdById"  TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CorporateDocxTemplate_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CorporateDocxTemplate"
  ADD CONSTRAINT "CorporateDocxTemplate_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "CorporateDocxTemplate_projectId_name_key"
  ON "CorporateDocxTemplate"("projectId", "name");
CREATE INDEX IF NOT EXISTS "CorporateDocxTemplate_projectId_idx" ON "CorporateDocxTemplate"("projectId");

-- CreateTable: ExcelColumnMapping
CREATE TABLE IF NOT EXISTS "ExcelColumnMapping" (
    "id"          TEXT NOT NULL,
    "projectId"   TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "mappings"    JSONB NOT NULL DEFAULT '[]',
    "createdById" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExcelColumnMapping_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ExcelColumnMapping"
  ADD CONSTRAINT "ExcelColumnMapping_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "ExcelColumnMapping_projectId_name_key"
  ON "ExcelColumnMapping"("projectId", "name");
CREATE INDEX IF NOT EXISTS "ExcelColumnMapping_projectId_idx" ON "ExcelColumnMapping"("projectId");

-- CreateTable: ScheduledExport
CREATE TABLE IF NOT EXISTS "ScheduledExport" (
    "id"            TEXT NOT NULL,
    "projectId"     TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "description"   TEXT,
    "templateId"    TEXT,
    "scheduleExpr"  TEXT,
    "format"        TEXT NOT NULL DEFAULT 'pdf',
    "enabled"       BOOLEAN NOT NULL DEFAULT false,
    "lastRunAt"     TIMESTAMP(3),
    "lastRunStatus" TEXT,
    "createdById"   TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScheduledExport_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ScheduledExport"
  ADD CONSTRAINT "ScheduledExport_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "ScheduledExport_projectId_name_key"
  ON "ScheduledExport"("projectId", "name");
CREATE INDEX IF NOT EXISTS "ScheduledExport_projectId_idx" ON "ScheduledExport"("projectId");
CREATE INDEX IF NOT EXISTS "ScheduledExport_projectId_enabled_idx" ON "ScheduledExport"("projectId", "enabled");
