import { Prisma } from '@prisma/client'
import { prisma } from './prisma'

/** Highest numeric suffix among keys matching ISS-<digits> (issueKey is globally @unique). */
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

export function formatIssueKey(sequence: number): string {
  return `ISS-${sequence.toString().padStart(4, '0')}`
}

export function isIssueKeyUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
    return false
  }
  const target = error.meta?.target
  return Array.isArray(target) && (target as string[]).includes('issueKey')
}
