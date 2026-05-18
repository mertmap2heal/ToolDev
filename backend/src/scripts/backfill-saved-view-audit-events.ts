/**
 * NX-10 one-off backfill: copy every legacy `SavedViewAuditEvent` row into the
 * central `AuditLog` table.
 *
 * Run with: npm run backfill:saved-view-audit-events
 *   (or: npx tsx src/scripts/backfill-saved-view-audit-events.ts)
 *
 * Context — NX-10 (R-8 continuation, `ROADMAP-phase3.md` §3) repoints the
 * `SavedViewAuditEvent` writer + reader onto `AuditLog`. This script backfills
 * the history so the per-view audit endpoint surfaces pre-cutover events too.
 *
 * Per legacy row, an `AuditLog` row is created:
 *   projectId          -> projectId
 *   performedByUserId  -> userId            (see null-actor handling below)
 *   action             -> action            (kept VERBATIM — legacy CREATE_VIEW
 *                                            etc. are NOT rewritten; per R-8 the
 *                                            <module>:<kebab-verb> convention
 *                                            binds only NEW live writes)
 *   performedAt        -> createdAt          (the ORIGINAL timestamp, passed
 *                                            explicitly so @default(now()) does
 *                                            not stamp the backfill date)
 *   { viewId, old, new, backfilledFromSavedViewAuditEventId } -> detailsJson
 *
 * Idempotent — safe to re-run. Each backfilled `AuditLog` row carries
 * `detailsJson.backfilledFromSavedViewAuditEventId = <legacy row id>`. On every
 * run the script first collects the ids already copied (one upfront query) into
 * a Set and skips any legacy row already present — a re-run after a partial
 * failure copies only the remainder, never a duplicate.
 *
 * Non-destructive — read + create only. The legacy `SavedViewAuditEvent` table
 * is FROZEN: no update, no delete on it anywhere. `rules.md` §4 (never delete
 * audit data) — every legacy row stays, untouched, queryable.
 *
 * Null-actor edge case — `AuditLog.userId` is NOT NULL whereas the legacy
 * `performedByUserId` is nullable. A legacy row with a null actor cannot enter
 * `AuditLog`; it is SKIPPED-and-LOGGED, never deleted. The frozen legacy table
 * retains it; `AuditLog` carries the forward-compatible (accountable) subset.
 */
// `Prisma` is a value import: the backfill uses `Prisma.AnyNull` (a runtime
// value) in its JSON-path filter, alongside the `Prisma.InputJsonValue` type.
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'

/** detailsJson key that marks a backfilled row and keys re-run idempotency. */
export const BACKFILL_KEY = 'backfilledFromSavedViewAuditEventId'

/** Reconciliation counts a backfill run reports. */
export interface BackfillResult {
  copied: number
  skippedAlready: number
  skippedNullActor: number
  total: number
  skippedNullActorIds: string[]
}

/**
 * Copy every legacy `SavedViewAuditEvent` row into `AuditLog`. Idempotent,
 * non-destructive — see the file header. Exported so the Vitest suite can
 * drive it directly (the `main()` wrapper below adds the CLI logging + exit
 * handling). Optionally scope to one project (the test suite uses this to
 * isolate from any pre-existing data; the CLI passes nothing — all projects).
 */
export async function backfillSavedViewAuditEvents(projectId?: string): Promise<BackfillResult> {
  // 1. Collect the legacy ids already copied into AuditLog — idempotency.
  //    A backfilled AuditLog row is identified by detailsJson carrying the
  //    BACKFILL_KEY; the JSON-path predicate `not: null` selects exactly those.
  const alreadyCopied = await prisma.auditLog.findMany({
    where: {
      detailsJson: { path: [BACKFILL_KEY], not: Prisma.AnyNull },
      ...(projectId ? { projectId } : {}),
    },
    select: { detailsJson: true },
  })
  const copiedIds = new Set<string>()
  for (const row of alreadyCopied) {
    const d = (row.detailsJson ?? {}) as Record<string, unknown>
    const id = d[BACKFILL_KEY]
    if (typeof id === 'string') copiedIds.add(id)
  }

  let copied = 0
  let skippedAlready = 0
  let skippedNullActor = 0
  let total = 0
  const skippedNullActorIds: string[] = []
  const BATCH = 500

  // 2. Page through every legacy row. The page cursor is `id` (the PK) so the
  //    loop terminates deterministically regardless of what is or is not copied.
  let cursor: string | undefined
  for (;;) {
    const rows = await prisma.savedViewAuditEvent.findMany({
      where: projectId ? { projectId } : {},
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    })
    if (rows.length === 0) break
    cursor = rows[rows.length - 1].id

    for (const row of rows) {
      total += 1

      if (copiedIds.has(row.id)) {
        skippedAlready += 1
        continue
      }

      // AuditLog.userId is NOT NULL — a null-actor legacy row cannot be copied.
      if (!row.performedByUserId) {
        skippedNullActor += 1
        skippedNullActorIds.push(row.id)
        continue
      }

      const detailsJson: Prisma.InputJsonValue = {
        viewId: row.viewId,
        old: (row.oldValueJson ?? null) as Prisma.InputJsonValue,
        new: (row.newValueJson ?? null) as Prisma.InputJsonValue,
        [BACKFILL_KEY]: row.id,
      }

      await prisma.auditLog.create({
        data: {
          projectId: row.projectId,
          userId: row.performedByUserId,
          action: row.action, // VERBATIM — legacy string, not rewritten
          detailsJson,
          createdAt: row.performedAt, // preserve the original timestamp
        },
      })
      copiedIds.add(row.id)
      copied += 1
    }
  }

  return { copied, skippedAlready, skippedNullActor, total, skippedNullActorIds }
}

async function main() {
  const r = await backfillSavedViewAuditEvents()
  console.log('')
  console.log('SavedViewAuditEvent -> AuditLog backfill complete.')
  console.log(`  copied (new AuditLog rows)        : ${r.copied}`)
  console.log(`  skipped (already backfilled)      : ${r.skippedAlready}`)
  console.log(`  skipped (null actor — not copied) : ${r.skippedNullActor}`)
  console.log(`  total legacy rows scanned         : ${r.total}`)
  if (r.skippedNullActorIds.length > 0) {
    console.log('')
    console.log('  null-actor SavedViewAuditEvent ids skipped (retained, frozen, in the legacy table):')
    for (const id of r.skippedNullActorIds) console.log(`    ${id}`)
  }
}

main()
  .catch((e) => {
    console.error('Backfill failed:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
