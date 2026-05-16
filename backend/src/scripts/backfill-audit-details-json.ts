/**
 * R-8 one-off backfill: populate AuditLog.detailsJson from the legacy
 * AuditLog.details String? column.
 *
 * Run with: npm run backfill:audit-details-json
 *   (or: npx tsx src/scripts/backfill-audit-details-json.ts)
 *
 * Idempotent — safe to re-run. Only processes rows where
 * `detailsJson IS NULL AND details IS NOT NULL`, so a re-run after a partial
 * failure skips already-backfilled rows. Rows whose `details` was legitimately
 * null are correctly skipped (their `detailsJson` stays null, matching).
 *
 * Per row:
 *   - `details` is valid JSON producing an OBJECT or ARRAY  -> detailsJson = parsed value
 *   - `details` is anything else (raw text, or JSON yielding a primitive)
 *                                                           -> detailsJson = { message: details }
 *
 * Non-destructive: read + update only. `details` is left intact on every row.
 * No delete / deleteMany anywhere.
 */
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'

/** Classification result for one legacy `details` string. */
export type ClassifiedDetails =
  | { kind: 'structured'; value: Prisma.InputJsonValue }
  | { kind: 'wrapped'; value: { message: string } }

/**
 * Decide how a legacy `details` string maps onto the new `detailsJson` column.
 * A parsed result counts as "structured" only when it is a non-null object or
 * an array. `JSON.parse('"some text"')` succeeds and yields a string — that is
 * still wrapped as `{ message }`. Most raw rows throw outright (unquoted text
 * is not valid JSON); the typeof guard catches the quoted-string edge case.
 */
export function classifyDetails(details: string): ClassifiedDetails {
  try {
    const parsed: unknown = JSON.parse(details)
    if (parsed !== null && typeof parsed === 'object') {
      return { kind: 'structured', value: parsed as Prisma.InputJsonValue }
    }
    return { kind: 'wrapped', value: { message: details } }
  } catch {
    return { kind: 'wrapped', value: { message: details } }
  }
}

async function main() {
  let structured = 0
  let wrapped = 0
  let processed = 0
  const BATCH = 500

  // Loop in pages. Each processed row gets a non-null detailsJson, so the
  // `detailsJson: null` filter naturally shrinks the candidate set each pass.
  for (;;) {
    const rows = await prisma.auditLog.findMany({
      where: { detailsJson: { equals: Prisma.AnyNull }, details: { not: null } },
      select: { id: true, details: true },
      take: BATCH,
    })
    if (rows.length === 0) break

    for (const row of rows) {
      // details is non-null here (filtered above); guard for the type-checker.
      if (row.details == null) continue
      const classified = classifyDetails(row.details)
      await prisma.auditLog.update({
        where: { id: row.id },
        data: { detailsJson: classified.value },
      })
      if (classified.kind === 'structured') structured += 1
      else wrapped += 1
      processed += 1
    }

    console.log(`  ... processed ${processed} rows so far`)
  }

  // Count the rows the backfill deliberately leaves alone (details === null).
  const skippedNull = await prisma.auditLog.count({ where: { details: null } })

  console.log('')
  console.log('Backfill complete.')
  console.log(`  structured (object/array, copied) : ${structured}`)
  console.log(`  wrapped    ({ message: details }) : ${wrapped}`)
  console.log(`  skipped    (details was null)     : ${skippedNull}`)
  console.log(`  total rows written                : ${processed}`)
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
