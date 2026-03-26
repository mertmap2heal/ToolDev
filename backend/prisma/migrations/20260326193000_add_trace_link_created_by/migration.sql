-- Add creator metadata for trace links (nullable for backward compatibility)
ALTER TABLE "TraceLink" ADD COLUMN IF NOT EXISTS "createdBy" TEXT;
