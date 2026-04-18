-- CreateEnum
CREATE TYPE "RequirementQualitySnapSource" AS ENUM ('full_project', 'single_requirement');

-- CreateTable
CREATE TABLE "RequirementQualityDismissal" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "issueKey" TEXT NOT NULL,
    "reason" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequirementQualityDismissal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementQualitySnapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT,
    "source" "RequirementQualitySnapSource" NOT NULL,
    "requirementId" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,

    CONSTRAINT "RequirementQualitySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RequirementQualityDismissal_requirementId_userId_issueKey_key" ON "RequirementQualityDismissal"("requirementId", "userId", "issueKey");

-- CreateIndex
CREATE INDEX "RequirementQualityDismissal_projectId_userId_idx" ON "RequirementQualityDismissal"("projectId", "userId");

-- CreateIndex
CREATE INDEX "RequirementQualityDismissal_requirementId_idx" ON "RequirementQualityDismissal"("requirementId");

-- CreateIndex
CREATE INDEX "RequirementQualitySnapshot_projectId_capturedAt_idx" ON "RequirementQualitySnapshot"("projectId", "capturedAt");

-- CreateIndex
CREATE INDEX "RequirementQualitySnapshot_projectId_requirementId_idx" ON "RequirementQualitySnapshot"("projectId", "requirementId");

-- AddForeignKey
ALTER TABLE "RequirementQualityDismissal" ADD CONSTRAINT "RequirementQualityDismissal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementQualityDismissal" ADD CONSTRAINT "RequirementQualityDismissal_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementQualityDismissal" ADD CONSTRAINT "RequirementQualityDismissal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementQualitySnapshot" ADD CONSTRAINT "RequirementQualitySnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementQualitySnapshot" ADD CONSTRAINT "RequirementQualitySnapshot_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementQualitySnapshot" ADD CONSTRAINT "RequirementQualitySnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
