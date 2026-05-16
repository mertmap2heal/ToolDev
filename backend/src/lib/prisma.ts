// Prisma client singleton — regenerated 2026-04-08 to include ParameterFolder
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient()

// R-3 (#398) — SignatureEvent append-only invariant (CFR 21 Part 11).
// SignatureEvent rows are immutable: once written they are never updated or
// deleted. Revocation is an INSERT of a new row via supersedeSignature(), not
// a mutation of the superseded row. This middleware rejects every mutating
// action on SignatureEvent. For every other model and action it does nothing
// but forward the query unchanged — it runs for EVERY query in the app.
// Only registered once: the singleton is reused on the global in non-prod.
if (!globalForPrisma.prisma) {
  prisma.$use(async (params, next) => {
    if (
      params.model === 'SignatureEvent' &&
      ['update', 'updateMany', 'delete', 'deleteMany', 'upsert'].includes(params.action)
    ) {
      throw new Error(
        `SignatureEvent is append-only (CFR 21 Part 11) — ${params.action} is forbidden. ` +
          'Revoke via supersedeSignature() which inserts a new row.',
      )
    }
    return next(params)
  })
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
