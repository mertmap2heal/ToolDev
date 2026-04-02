-- Add folder structure for SavedView and extend SavedView for traceability matrix definitions

-- CreateTable
CREATE TABLE "SavedViewFolder" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedViewFolder_pkey" PRIMARY KEY ("id")
);

-- Add columns to SavedView
ALTER TABLE "SavedView"
ADD COLUMN     "folderId" TEXT,
ADD COLUMN     "viewKind" TEXT,
ADD COLUMN     "definitionJson" TEXT;

-- Indexes
CREATE INDEX "SavedViewFolder_projectId_idx" ON "SavedViewFolder"("projectId");
CREATE INDEX "SavedViewFolder_parentId_idx" ON "SavedViewFolder"("parentId");
CREATE UNIQUE INDEX "SavedViewFolder_projectId_parentId_name_key" ON "SavedViewFolder"("projectId", "parentId", "name");

CREATE INDEX "SavedView_folderId_idx" ON "SavedView"("folderId");
CREATE INDEX "SavedView_viewKind_idx" ON "SavedView"("viewKind");

-- Foreign keys
ALTER TABLE "SavedViewFolder" ADD CONSTRAINT "SavedViewFolder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedViewFolder" ADD CONSTRAINT "SavedViewFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "SavedViewFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "SavedViewFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

