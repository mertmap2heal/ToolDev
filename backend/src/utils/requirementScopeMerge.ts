/**
 * Used by getRequirements when combining positive scope sets with
 * "no test case verifies link" (exclude roots that have any verifies→test_case link).
 */
export function filterIdsExcluding(ids: string[], excludeIds: string[]): string[] {
  if (excludeIds.length === 0) return ids
  const ex = new Set(excludeIds)
  return ids.filter((id) => !ex.has(id))
}
