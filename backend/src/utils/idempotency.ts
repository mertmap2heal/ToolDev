import { prisma } from '../lib/prisma'


/**
 * Generate a unique idempotency key
 */
export function generateIdempotencyKey(prefix: string, entityId: string): string {
  return `${prefix}-${entityId}-${Date.now()}-${Math.random().toString(36).substring(7)}`
}

/**
 * Check if an idempotency key has been used
 */
export async function checkIdempotency(idempotencyKey: string): Promise<boolean> {
  const existing = await prisma.inventoryLedger.findUnique({
    where: { idempotencyKey },
    select: { id: true },
  })

  return !!existing
}
