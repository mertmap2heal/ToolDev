-- CreateTable
CREATE TABLE "ProjectUserEngineeringRole" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectUserEngineeringRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectUserEngineeringRole_projectId_userId_roleId_key" ON "ProjectUserEngineeringRole"("projectId", "userId", "roleId");

-- CreateIndex
CREATE INDEX "ProjectUserEngineeringRole_projectId_idx" ON "ProjectUserEngineeringRole"("projectId");

-- CreateIndex
CREATE INDEX "ProjectUserEngineeringRole_userId_idx" ON "ProjectUserEngineeringRole"("userId");

-- CreateIndex
CREATE INDEX "ProjectUserEngineeringRole_roleId_idx" ON "ProjectUserEngineeringRole"("roleId");

-- AddForeignKey
ALTER TABLE "ProjectUserEngineeringRole" ADD CONSTRAINT "ProjectUserEngineeringRole_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectUserEngineeringRole" ADD CONSTRAINT "ProjectUserEngineeringRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectUserEngineeringRole" ADD CONSTRAINT "ProjectUserEngineeringRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "EngineeringRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectUserEngineeringRole" ADD CONSTRAINT "ProjectUserEngineeringRole_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: replicate each global UserEngineeringRole to every project the user is a member of (idempotent)
INSERT INTO "ProjectUserEngineeringRole" ("id", "projectId", "userId", "roleId", "assignedByUserId", "createdAt")
SELECT gen_random_uuid()::text, pm."projectId", uer."userId", uer."roleId", NULL, uer."createdAt"
FROM "UserEngineeringRole" uer
INNER JOIN "ProjectMember" pm ON pm."userId" = uer."userId"
WHERE NOT EXISTS (
  SELECT 1 FROM "ProjectUserEngineeringRole" pur
  WHERE pur."projectId" = pm."projectId" AND pur."userId" = uer."userId" AND pur."roleId" = uer."roleId"
);

-- Backfill for project owners who may not have a ProjectMember row
INSERT INTO "ProjectUserEngineeringRole" ("id", "projectId", "userId", "roleId", "assignedByUserId", "createdAt")
SELECT gen_random_uuid()::text, p."id", uer."userId", uer."roleId", NULL, uer."createdAt"
FROM "UserEngineeringRole" uer
INNER JOIN "Project" p ON p."userId" = uer."userId"
WHERE NOT EXISTS (
  SELECT 1 FROM "ProjectUserEngineeringRole" pur
  WHERE pur."projectId" = p."id" AND pur."userId" = uer."userId" AND pur."roleId" = uer."roleId"
);
