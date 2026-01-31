/**
 * PBS module utilities — ID and code generation.
 */

export function generateId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `pbs-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/**
 * Generate next PBS code for a parent (e.g. PBS-001.002).
 * Siblings are inspected to find max existing suffix and increment.
 */
export function generatePbsCode(
  parentCode: string | null,
  siblingCodes: string[]
): string {
  const prefix = parentCode ? `${parentCode}.` : 'PBS-'
  const siblingNums = siblingCodes
    .map((c) => {
      const tail = c.replace(prefix, '')
      const num = parseInt(tail, 10)
      return isNaN(num) ? 0 : num
    })
    .filter((n) => n >= 0)
  const next = siblingNums.length === 0 ? 1 : Math.max(...siblingNums) + 1
  return `${prefix}${String(next).padStart(3, '0')}`
}

export function nowISO(): string {
  return new Date().toISOString()
}
