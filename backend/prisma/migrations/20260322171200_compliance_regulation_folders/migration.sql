-- CreateTable
CREATE TABLE "ComplianceRegulationFolder" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "purpose" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ComplianceRegulationFolder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComplianceRegulationFolder_projectId_idx" ON "ComplianceRegulationFolder"("projectId");

-- CreateIndex
CREATE INDEX "ComplianceRegulationFolder_projectId_parentId_idx" ON "ComplianceRegulationFolder"("projectId", "parentId");

-- AddForeignKey
ALTER TABLE "ComplianceRegulationFolder" ADD CONSTRAINT "ComplianceRegulationFolder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceRegulationFolder" ADD CONSTRAINT "ComplianceRegulationFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ComplianceRegulationFolder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "ComplianceRule" ADD COLUMN "folderId" TEXT;

-- CreateIndex
CREATE INDEX "ComplianceRule_folderId_idx" ON "ComplianceRule"("folderId");

-- AddForeignKey
ALTER TABLE "ComplianceRule" ADD CONSTRAINT "ComplianceRule_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "ComplianceRegulationFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
