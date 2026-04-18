import type { Prisma } from '@prisma/client'

/**
 * Advisory lock key for change-request ID allocation.
 * Uses a stable BigInt derived from "CR" ASCII bytes to avoid collisions
 * with the issue-key lock (0x4953530000000001) and the parameter-id lock
 * (0x5041524100000001).
 * "CR__" = 0x43525F5F, shifted into the high bytes + 0x00000001 as a counter.
 */
const CR_ID_LOCK = BigInt('0x43525F5F00000001')

/**
 * Allocates the next CR-NNNN identifier atomically using a per-project
 * Postgres advisory lock.
 *
 * Problem with the previous implementation (issue #162):
 *   - `prisma.changeRequest.count({ where: { projectId } }) + 1` was computed
 *     outside any transaction. Two concurrent creates both read the same count
 *     and both try to insert the same `CR-NNNN`, causing a unique-constraint
 *     violation (crId is globally @unique).
 *   - Additionally, `count()` is O(N) per invocation.
 *
 * This implementation:
 *   - Uses pg_advisory_xact_lock to serialise all concurrent creates for the
 *     same project. The lock is project-scoped via a hash of the projectId, so
 *     different projects never block each other.
 *   - Reads only a single MAX() row via a regex-filtered index scan.
 *   - Must be called inside a transaction so the lock is released on commit/rollback.
 *
 * @param tx         A Prisma transaction client (from prisma.$transaction).
 * @param projectId  The project UUID — used to derive a project-scoped lock key.
 * @returns          The next CR-NNNN identifier for the project.
 */
export async function allocateChangeRequestId(
  tx: Prisma.TransactionClient,
  projectId: string
): Promise<string> {
  // Derive a stable integer lock key from the project UUID + the global CR lock base.
  // XOR each 32-bit chunk of the UUID so different projects get different locks.
  const uuidHex = projectId.replace(/-/g, '')
  let projectHash = BigInt(0)
  for (let i = 0; i < uuidHex.length; i += 8) {
    projectHash ^= BigInt('0x' + uuidHex.slice(i, i + 8))
  }
  const lockKey = (CR_ID_LOCK ^ (projectHash << BigInt(1))) & BigInt('0x7FFFFFFFFFFFFFFF')

  // Acquire advisory lock — blocks until no other transaction holds this key.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`

  // Efficient single-row query: only fetch the max numeric suffix among
  // project-scoped rows with the canonical CR-NNN+ format. Seeded demo rows
  // that use different formats (e.g. CR-SBX1-001) are ignored by the regex.
  const rows = await tx.$queryRaw<Array<{ next: number | bigint }>>`
    SELECT COALESCE(MAX(
      CAST(SUBSTRING("crId" FROM 'CR-([0-9]+)$') AS INTEGER)
    ), 0) + 1 AS next
    FROM "ChangeRequest"
    WHERE "projectId" = ${projectId}
      AND "crId" IS NOT NULL
      AND "crId" ~ '^CR-[0-9]+$'
  `

  const raw = rows[0]?.next ?? 1
  const next = typeof raw === 'bigint' ? Number(raw) : Number(raw)
  const seq = Number.isFinite(next) && next > 0 ? next : 1
  return `CR-${seq.toString().padStart(4, '0')}`
}
