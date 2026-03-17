-- AlterTable (additive only)
ALTER TABLE "Parameter" ADD COLUMN "tolerance" TEXT;
ALTER TABLE "Parameter" ADD COLUMN "minValue" TEXT;
ALTER TABLE "Parameter" ADD COLUMN "maxValue" TEXT;
ALTER TABLE "Parameter" ADD COLUMN "version" TEXT NOT NULL DEFAULT '1.0';
ALTER TABLE "Parameter" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE "Parameter" ADD COLUMN "ownerType" TEXT;
ALTER TABLE "Parameter" ADD COLUMN "tags" JSONB;
ALTER TABLE "Parameter" ADD COLUMN "folderId" TEXT;
ALTER TABLE "Parameter" ADD COLUMN "sourceParameterId" TEXT;
ALTER TABLE "Parameter" ADD COLUMN "formula" TEXT;

-- CreateTable
CREATE TABLE "ParameterVersion" (
    "id" TEXT NOT NULL,
    "parameterId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "ParameterVersion_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ParameterVersion" ADD CONSTRAINT "ParameterVersion_parameterId_fkey" FOREIGN KEY ("parameterId") REFERENCES "Parameter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Parameter" ADD CONSTRAINT "Parameter_sourceParameterId_fkey" FOREIGN KEY ("sourceParameterId") REFERENCES "Parameter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Parameter_projectId_status_idx" ON "Parameter"("projectId", "status");
CREATE INDEX "Parameter_projectId_folderId_idx" ON "Parameter"("projectId", "folderId");
CREATE INDEX "Parameter_sourceParameterId_idx" ON "Parameter"("sourceParameterId");
CREATE INDEX "ParameterVersion_parameterId_idx" ON "ParameterVersion"("parameterId");
