-- AlterTable
ALTER TABLE "CertSignOff" ADD COLUMN     "assignedToUserId" TEXT,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "signerId" TEXT,
ADD COLUMN     "userAgent" TEXT;

-- CreateTable
CREATE TABLE "UserAdminRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "adminRoleId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT,

    CONSTRAINT "UserAdminRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserAdminRole_userId_idx" ON "UserAdminRole"("userId");

-- CreateIndex
CREATE INDEX "UserAdminRole_adminRoleId_idx" ON "UserAdminRole"("adminRoleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAdminRole_userId_adminRoleId_key" ON "UserAdminRole"("userId", "adminRoleId");

-- CreateIndex
CREATE INDEX "CertSignOff_signerId_idx" ON "CertSignOff"("signerId");

-- CreateIndex
CREATE INDEX "CertSignOff_assignedToUserId_idx" ON "CertSignOff"("assignedToUserId");

-- CreateIndex
CREATE INDEX "Requirement_projectId_deletedAt_idx" ON "Requirement"("projectId", "deletedAt");

-- CreateIndex
CREATE INDEX "Requirement_lockedByUserId_idx" ON "Requirement"("lockedByUserId");

-- CreateIndex
CREATE INDEX "Requirement_statusId_idx" ON "Requirement"("statusId");

-- CreateIndex
CREATE INDEX "Requirement_statusChangedBy_idx" ON "Requirement"("statusChangedBy");

-- CreateIndex
CREATE INDEX "Requirement_deletedById_idx" ON "Requirement"("deletedById");

-- CreateIndex
CREATE INDEX "RequirementExportTemplate_projectId_deletedAt_idx" ON "RequirementExportTemplate"("projectId", "deletedAt");

-- AddForeignKey
ALTER TABLE "UserAdminRole" ADD CONSTRAINT "UserAdminRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAdminRole" ADD CONSTRAINT "UserAdminRole_adminRoleId_fkey" FOREIGN KEY ("adminRoleId") REFERENCES "AdminRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertSignOff" ADD CONSTRAINT "CertSignOff_signerId_fkey" FOREIGN KEY ("signerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertSignOff" ADD CONSTRAINT "CertSignOff_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

