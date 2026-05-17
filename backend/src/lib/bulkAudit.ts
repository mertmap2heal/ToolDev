// NX-4 (#447) — shared bulk-edit audit helper.
//
// The generic `/bulk-update` convention (see .claude/kb/backend-patterns.md
// "Bulk-update convention") has exactly one genuinely-shared mechanic: writing
// one `AuditLog` row per touched row, every row sharing a single `batchId` so
// the audit log can correlate a bulk edit. This file is that mechanic — a
// ~30-line loop, NOT a new audit service. The canonical single-write audit
// sink remains `prisma.auditLog.create` with the `<module>:<kebab-verb>`
// + `detailsJson` convention (R-8); `applyBulkAudit` should be folded into
// `audit.service.ts` `writeAudit` if/when that SHR service lands.
//
// Every future noun's `/bulk-update` (Verification / Validation / Tasks /
// Issues / Change Requests) calls this — the noun-specific part (the field
// whitelist + per-field RBAC) lives in the noun's own controller.
import { randomUUID } from 'crypto'
import type { Prisma } from '@prisma/client'

/** A Prisma client able to write `auditLog` rows — the singleton or a `$transaction` callback client. */
export type BulkAuditWriteClient = Pick<Prisma.TransactionClient, 'auditLog'>

/** One audited row in a bulk edit: the entity id and the per-row structured detail. */
export interface BulkAuditRow {
  /** The id of the touched entity (e.g. a Requirement id). Recorded in `detailsJson.entityId`. */
  entityId: string
  /** Per-row structured detail merged into `detailsJson` — typically `{ before, after }`. */
  detail: Prisma.InputJsonObject
}

export interface ApplyBulkAuditArgs {
  /** Project the audited rows belong to — the `AuditLog.projectId` anchor. */
  projectId: string
  /** The acting user — `AuditLog.userId` (always derived from `req.user`, never the body). */
  userId: string
  /** The `<module>:<kebab-verb>` action string, e.g. `requirements:bulk-update`. */
  action: string
  /** One entry per touched entity. */
  rows: BulkAuditRow[]
  /**
   * The shared batch id. Optional — when omitted a fresh `crypto.randomUUID()`
   * is generated. Pass an explicit id when the caller needs the value for the
   * HTTP response (the typical case — see `bulkUpdateRequirements`).
   */
  batchId?: string
}

/**
 * Write one `AuditLog` row per touched entity, all sharing one `batchId`.
 *
 * Call this INSIDE the same `$transaction` as the bulk writes (pass the `tx`
 * client) so the audit rows roll back with the edit on any failure. Each row's
 * `detailsJson` carries `{ batchId, entityId, ...row.detail }`.
 *
 * Returns the `batchId` used (the supplied one, or the freshly generated one).
 */
export async function applyBulkAudit(
  client: BulkAuditWriteClient,
  { projectId, userId, action, rows, batchId }: ApplyBulkAuditArgs,
): Promise<string> {
  const resolvedBatchId = batchId ?? randomUUID()
  for (const row of rows) {
    await client.auditLog.create({
      data: {
        projectId,
        userId,
        action,
        // R-8: structured detail to detailsJson directly — no JSON.stringify.
        // A bulk edit always has a changed field, so a no-detail Prisma.DbNull
        // case does not arise here.
        detailsJson: {
          batchId: resolvedBatchId,
          entityId: row.entityId,
          ...row.detail,
        },
      },
    })
  }
  return resolvedBatchId
}
