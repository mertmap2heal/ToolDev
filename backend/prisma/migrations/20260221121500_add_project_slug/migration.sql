-- Add slug column (nullable initially for backfill)
ALTER TABLE "Project" ADD COLUMN "slug" TEXT;

-- Backfill: derive slug from domain, ensure uniqueness (append -2, -3 for duplicates)
WITH with_base AS (
  SELECT id, COALESCE(NULLIF(TRIM(REGEXP_REPLACE(LOWER("domain"), '[^a-z0-9]+', '-', 'g')), ''), 'project') AS base_slug
  FROM "Project"
),
with_row AS (
  SELECT id, base_slug, ROW_NUMBER() OVER (PARTITION BY base_slug ORDER BY id) AS rn
  FROM with_base
)
UPDATE "Project" p
SET "slug" = CASE WHEN w.rn = 1 THEN w.base_slug ELSE w.base_slug || '-' || w.rn END
FROM with_row w
WHERE p.id = w.id;

-- Make slug required and unique
ALTER TABLE "Project" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");
