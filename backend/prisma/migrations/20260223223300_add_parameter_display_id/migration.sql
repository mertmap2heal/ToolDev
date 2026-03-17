-- AlterTable
ALTER TABLE "Parameter" ADD COLUMN "parameterId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Parameter_projectId_parameterId_key" ON "Parameter"("projectId", "parameterId");
