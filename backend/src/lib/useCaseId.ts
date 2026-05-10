import type { Prisma } from '@prisma/client'

/**
 * Advisory lock key for use-case ID allocation.
 * "UCAS" = 0x55434153 in ASCII; shifted left 32 bits + 0x00000001 to keep
 * the key in a band that does not collide with the param/issue/CR/test
 * allocators that already use this pattern.
 *
 * SECURITY (MEDIUM): without this lock, two concurrent POSTs to
 * /api/v1/usecases/:projectId would both read the same MAX(id) and
 * either insert duplicate UC-NNN values or hit a unique-constraint race.
 * Mirrors lib/paramId.ts, lib/crId.ts, lib/issueKey.ts, lib/verificationKey.ts.
 */
const USECASE_ID_LOCK = BigInt('0x5543415300000001')

export async function allocateUseCaseId(
  tx: Prisma.TransactionClient,
  projectId: string,
): Promise<string> {
  const uuidHex = projectId.replace(/-/g, '')
  let projectHash = BigInt(0)
  for (let i = 0; i < uuidHex.length; i += 8) {
    projectHash ^= BigInt('0x' + uuidHex.slice(i, i + 8))
  }
  const lockKey = (USECASE_ID_LOCK ^ (projectHash << BigInt(1))) & BigInt('0x7FFFFFFFFFFFFFFF')

  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`

  const rows = await tx.$queryRaw<Array<{ next: number | bigint }>>`
    SELECT COALESCE(MAX(
      CAST(SUBSTRING("useCaseId" FROM 'UC-([0-9]+)') AS INTEGER)
    ), 0) + 1 AS next
    FROM "UseCase"
    WHERE "projectId" = ${projectId}
      AND "useCaseId" IS NOT NULL
      AND "useCaseId" ~ '^UC-[0-9]+$'
  `
  const raw = rows[0]?.next ?? 1
  const next = typeof raw === 'bigint' ? Number(raw) : Number(raw)
  const seq = Number.isFinite(next) && next > 0 ? next : 1
  return `UC-${seq.toString().padStart(3, '0')}`
}
