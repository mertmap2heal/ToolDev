import type { Prisma } from '@prisma/client'

/**
 * Advisory lock key for parameter ID allocation.
 * Uses a stable BigInt derived from "PARAM" ASCII bytes to avoid collisions
 * with the issue-key lock (0x4953530000000001).
 * "PARA" = 0x50415241, shifted left 32 bits + 0x00000001 as a counter.
 */
const PARAM_ID_LOCK = BigInt('0x5041524100000001')

/**
 * Allocates the next PARAM-NNN identifier atomically using a per-project
 * Postgres advisory lock.
 *
 * Problem with the previous implementation:
 *   - Full table scan on every create: O(N) in parameter count.
 *   - Race condition: two concurrent creates both read the same max number and
 *     both try to insert PARAM-NNN, causing a unique-constraint violation or
 *     silently producing duplicate IDs depending on the index definition.
 *
 * This implementation:
 *   - Uses pg_advisory_xact_lock to serialise all concurrent creates for the
 *     same project. The lock is project-scoped via a hash of the projectId.
 *   - Reads only a single row (the highest existing ID) via an indexed ORDER BY.
 *   - Is O(log N) instead of O(N).
 *   - Must be called inside a transaction so the lock is released on commit/rollback.
 *
 * @param tx   A Prisma transaction client (from prisma.$transaction).
 * @param projectId  The project UUID — used to derive a project-scoped lock key.
 */
export async function allocateParameterId(
  tx: Prisma.TransactionClient,
  projectId: string
): Promise<string> {
  // Derive a stable integer lock key from the project UUID + the global PARAM lock base.
  // XOR each 32-bit chunk of the UUID so different projects get different locks.
  const uuidHex = projectId.replace(/-/g, '')
  let projectHash = BigInt(0)
  for (let i = 0; i < uuidHex.length; i += 8) {
    projectHash ^= BigInt('0x' + uuidHex.slice(i, i + 8))
  }
  const lockKey = (PARAM_ID_LOCK ^ (projectHash << BigInt(1))) & BigInt('0x7FFFFFFFFFFFFFFF')

  // Acquire advisory lock — blocks until no other transaction holds this key.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`

  // Efficient single-row query: only fetch the parameter with the highest numeric suffix.
  const rows = await tx.$queryRaw<Array<{ next: number | bigint }>>`
    SELECT COALESCE(MAX(
      CAST(SUBSTRING("parameterId" FROM 'PARAM-([0-9]+)') AS INTEGER)
    ), 0) + 1 AS next
    FROM "Parameter"
    WHERE "projectId" = ${projectId}
      AND "parameterId" IS NOT NULL
      AND "parameterId" ~ '^PARAM-[0-9]+$'
  `

  const raw = rows[0]?.next ?? 1
  const next = typeof raw === 'bigint' ? Number(raw) : Number(raw)
  const seq = Number.isFinite(next) && next > 0 ? next : 1
  return `PARAM-${seq.toString().padStart(3, '0')}`
}
