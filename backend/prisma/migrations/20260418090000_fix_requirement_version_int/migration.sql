-- Fix Requirement.version column type drift: schema.prisma declares it as
-- Int @default(1) (for optimistic locking with `{ increment: 1 }`), but the
-- database was initialised while the field was String @default("1.0"), so
-- updates fail with "operator does not exist: text + unknown". Convert the
-- column in-place; existing rows all hold the literal '1', which casts
-- cleanly to integer 1.

ALTER TABLE "Requirement"
  ALTER COLUMN "version" DROP DEFAULT,
  ALTER COLUMN "version" TYPE integer USING "version"::integer,
  ALTER COLUMN "version" SET DEFAULT 1;
