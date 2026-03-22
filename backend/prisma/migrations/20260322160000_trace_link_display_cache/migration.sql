-- Persist display snapshots for trace link endpoints (survives hard-deleted targets like test cases)
ALTER TABLE "TraceLink" ADD COLUMN IF NOT EXISTS "cachedSourceDisplayId" VARCHAR(255);
ALTER TABLE "TraceLink" ADD COLUMN IF NOT EXISTS "cachedSourceTitle" VARCHAR(1024);
ALTER TABLE "TraceLink" ADD COLUMN IF NOT EXISTS "cachedTargetDisplayId" VARCHAR(255);
ALTER TABLE "TraceLink" ADD COLUMN IF NOT EXISTS "cachedTargetTitle" VARCHAR(1024);
