import type { Prisma } from '@prisma/client'

/**
 * Atomic key allocators for verification test cases (TC-NNN) and test plans (TP-NNN).
 *
 * Problem with the previous read-then-increment (issue #135):
 *   - `findMany + max+1` was not atomic. Two concurrent creates read the same
 *     max and both attempt to insert the same TC-NNN / TP-NNN, which either
 *     raises a unique-constraint violation or silently creates duplicates.
 *   - Fetching all rows into memory was also O(N).
 *
 * This implementation mirrors the pattern used for change-request IDs (#162)
 * and parameter IDs (#77): pg_advisory_xact_lock + single MAX() query inside a
 * transaction, keyed per project.
 */

/**
 * Lock-key base constants. Each ID allocator uses a distinct high-byte prefix
 * so different entities never collide on the same project:
 *   - "PARA" (parameters)            0x5041524100000001
 *   - "ISS_" (issue keys)            0x4953530000000001
 *   - "CR__" (change requests)       0x43525F5F00000001
 *   - "TC__" (test cases) — here    0x54435F5F00000001
 *   - "TP__" (test plans) — here    0x54505F5F00000001
 */
const TC_KEY_LOCK = BigInt('0x54435F5F00000001')
const TP_KEY_LOCK = BigInt('0x54505F5F00000001')

function lockKeyFor(base: bigint, projectId: string): bigint {
  const uuidHex = projectId.replace(/-/g, '')
  let projectHash = BigInt(0)
  for (let i = 0; i < uuidHex.length; i += 8) {
    projectHash ^= BigInt('0x' + uuidHex.slice(i, i + 8))
  }
  return (base ^ (projectHash << BigInt(1))) & BigInt('0x7FFFFFFFFFFFFFFF')
}

export async function allocateTestCaseKey(
  tx: Prisma.TransactionClient,
  projectId: string,
): Promise<string> {
  const lockKey = lockKeyFor(TC_KEY_LOCK, projectId)
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`

  const rows = await tx.$queryRaw<Array<{ next: number | bigint }>>`
    SELECT COALESCE(MAX(
      CAST(SUBSTRING("key" FROM 'TC-([0-9]+)$') AS INTEGER)
    ), 0) + 1 AS next
    FROM "VerTestCase"
    WHERE "projectId" = ${projectId}
      AND "key" ~ '^TC-[0-9]+$'
  `
  const next = Number(rows[0]?.next ?? 1)
  return `TC-${String(next).padStart(3, '0')}`
}

export async function allocateTestPlanKey(
  tx: Prisma.TransactionClient,
  projectId: string,
): Promise<string> {
  const lockKey = lockKeyFor(TP_KEY_LOCK, projectId)
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`

  const rows = await tx.$queryRaw<Array<{ next: number | bigint }>>`
    SELECT COALESCE(MAX(
      CAST(SUBSTRING("key" FROM 'TP-([0-9]+)$') AS INTEGER)
    ), 0) + 1 AS next
    FROM "VerTestPlan"
    WHERE "projectId" = ${projectId}
      AND "key" ~ '^TP-[0-9]+$'
  `
  const next = Number(rows[0]?.next ?? 1)
  return `TP-${String(next).padStart(3, '0')}`
}
