import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'

/**
 * Allocates the next issue key atomically using a Postgres advisory lock.
 *
 * The advisory lock (pg_advisory_xact_lock) is held for the duration of the
 * transaction, serializing all concurrent key allocations so that every INSERT
 * receives a unique sequence number without any retry loop.
 *
 * The lock number (0x4953530000000001n) is a stable hash of "ISS\0" + counter.
 * It is released automatically when the transaction commits or rolls back.
 */
const ISSUE_KEY_LOCK = BigInt('0x4953530000000001')

export async function allocateIssueKey(
  tx: Prisma.TransactionClient,
): Promise<string> {
  // Acquire advisory lock — blocks until no other transaction holds it
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ISSUE_KEY_LOCK})`

  const rows = await tx.$queryRaw<Array<{ next: number | bigint }>>`
    SELECT COALESCE(MAX(
      CAST(SUBSTRING("issueKey" FROM 'ISS-([0-9]+)') AS INTEGER)
    ), 0) + 1 AS next
    FROM "Issue"
    WHERE "issueKey" IS NOT NULL
      AND "issueKey" ~ '^ISS-[0-9]+$'
  `
  const raw = rows[0]?.next ?? 1
  const next = typeof raw === 'bigint' ? Number(raw) : Number(raw)
  return formatIssueKey(Number.isFinite(next) && next > 0 ? next : 1)
}

export function formatIssueKey(sequence: number): string {
  return `ISS-${sequence.toString().padStart(4, '0')}`
}

/** Kept for use in tests that need to read the current max without allocating. */
export async function getMaxIssueSequenceNumber(): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ max: number | null }>>`
    SELECT MAX(
      CAST(SUBSTRING("issueKey" FROM 'ISS-([0-9]+)') AS INTEGER)
    ) AS max
    FROM "Issue"
    WHERE "issueKey" IS NOT NULL
      AND "issueKey" ~ '^ISS-[0-9]+$'
  `
  const raw = rows[0]?.max
  if (raw == null) return 0
  const n = typeof raw === 'bigint' ? Number(raw) : Number(raw)
  return Number.isFinite(n) ? n : 0
}
