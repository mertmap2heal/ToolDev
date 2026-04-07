-- CreateTable
CREATE TABLE "ParameterFolder" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParameterFolder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParameterFolder_projectId_idx" ON "ParameterFolder"("projectId");

-- CreateIndex
CREATE INDEX "ParameterFolder_projectId_parentId_idx" ON "ParameterFolder"("projectId", "parentId");

-- AddForeignKey
ALTER TABLE "ParameterFolder" ADD CONSTRAINT "ParameterFolder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParameterFolder" ADD CONSTRAINT "ParameterFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ParameterFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parameter" ADD CONSTRAINT "Parameter_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "ParameterFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
