-- AlterTable
ALTER TABLE "VerTestResult" ADD COLUMN "sourceTestRunId" TEXT;

-- CreateIndex
CREATE INDEX "VerTestResult_sourceTestRunId_idx" ON "VerTestResult"("sourceTestRunId");

-- AddForeignKey
ALTER TABLE "VerTestResult" ADD CONSTRAINT "VerTestResult_sourceTestRunId_fkey" FOREIGN KEY ("sourceTestRunId") REFERENCES "VerTestRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
