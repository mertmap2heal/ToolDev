import { randomUUID } from 'crypto'

/**
 * Generate a unique id for Prisma create operations.
 * Use when schema does not provide @default(cuid()) / @default(uuid()).
 */
export function generateId(): string {
  return randomUUID()
}
