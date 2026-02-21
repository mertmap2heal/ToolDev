-- AlterTable
ALTER TABLE "VerTestRun" ADD COLUMN "actualDurationSeconds" INTEGER,
ADD COLUMN "pausedAt" TIMESTAMP(3),
ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "VerTestRunResult" ADD COLUMN "parentTestCaseVersionAtExecution" TEXT,
ADD COLUMN "isOutOfSync" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "VerTestRunResultActualResult" (
    "id" TEXT NOT NULL,
    "testRunResultId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "textContent" TEXT,
    "imageStorageKey" TEXT,
    "imageFileName" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerTestRunResultActualResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerTestRunExecutionTimer" (
    "id" TEXT NOT NULL,
    "testRunId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pausedAt" TIMESTAMP(3),
    "resumedAt" TIMESTAMP(3),
    "loggedSeconds" INTEGER NOT NULL DEFAULT 0,
    "performedByUserId" TEXT,

    CONSTRAINT "VerTestRunExecutionTimer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerTestRunResultStatusHistory" (
    "id" TEXT NOT NULL,
    "testRunResultId" TEXT NOT NULL,
    "oldStatus" TEXT NOT NULL,
    "newStatus" TEXT NOT NULL,
    "performedByUserId" TEXT,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "VerTestRunResultStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VerTestRun_deletedAt_idx" ON "VerTestRun"("deletedAt");

-- CreateIndex
CREATE INDEX "VerTestRunResult_isOutOfSync_idx" ON "VerTestRunResult"("isOutOfSync");

-- CreateIndex
CREATE INDEX "VerTestRunResultActualResult_testRunResultId_idx" ON "VerTestRunResultActualResult"("testRunResultId");

-- CreateIndex
CREATE INDEX "VerTestRunExecutionTimer_testRunId_idx" ON "VerTestRunExecutionTimer"("testRunId");

-- CreateIndex
CREATE INDEX "VerTestRunResultStatusHistory_testRunResultId_idx" ON "VerTestRunResultStatusHistory"("testRunResultId");

-- CreateIndex
CREATE INDEX "VerTestRunResultStatusHistory_performedAt_idx" ON "VerTestRunResultStatusHistory"("performedAt");

-- AddForeignKey
ALTER TABLE "VerTestRunResultActualResult" ADD CONSTRAINT "VerTestRunResultActualResult_testRunResultId_fkey" FOREIGN KEY ("testRunResultId") REFERENCES "VerTestRunResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerTestRunExecutionTimer" ADD CONSTRAINT "VerTestRunExecutionTimer_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "VerTestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerTestRunResultStatusHistory" ADD CONSTRAINT "VerTestRunResultStatusHistory_testRunResultId_fkey" FOREIGN KEY ("testRunResultId") REFERENCES "VerTestRunResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
