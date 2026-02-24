-- CreateTable
CREATE TABLE "DefinitionEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "notes" TEXT,
    "source" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DefinitionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DefinitionEntry_projectId_term_key" ON "DefinitionEntry"("projectId", "term");
CREATE INDEX "DefinitionEntry_projectId_idx" ON "DefinitionEntry"("projectId");
CREATE INDEX "DefinitionEntry_projectId_type_idx" ON "DefinitionEntry"("projectId", "type");

-- AddForeignKey
ALTER TABLE "DefinitionEntry" ADD CONSTRAINT "DefinitionEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
