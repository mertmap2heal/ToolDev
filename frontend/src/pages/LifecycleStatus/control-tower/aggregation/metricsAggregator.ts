/**
 * ============================================================================
 * LIFECYCLE CONTROL TOWER — METRICS AGGREGATOR
 * ============================================================================
 *
 * Pure aggregation functions for the Control Tower.
 * Aviation: Deterministic computation for audit-reproducible results.
 * ============================================================================
 */

import type { LifecycleStatus, MonitoredEntityType } from '../types/contracts'

/** All canonical lifecycle statuses */
export const ALL_STATUSES: LifecycleStatus[] = [
  'Draft', 'In Review', 'Approved', 'Active', 'Under Change', 'Deprecated', 'Retired', 'Archived',
]

/** All monitored entity types */
export const ALL_ENTITY_TYPES: MonitoredEntityType[] = [
  'Requirement', 'Function', 'Component', 'Interface', 'Test Case', 'Hazard', 'Change Request',
]

/** Mature statuses used for maturity % calculation */
const MATURE_STATUSES: Set<LifecycleStatus> = new Set(['Approved', 'Active'])

/**
 * Compute global maturity % from status distribution array.
 */
export function computeGlobalMaturity(
  statusDistribution: Array<{ status: LifecycleStatus; count: number }>
): number {
  const total = statusDistribution.reduce((s, d) => s + d.count, 0)
  if (total === 0) return 0
  const mature = statusDistribution
    .filter((d) => MATURE_STATUSES.has(d.status))
    .reduce((s, d) => s + d.count, 0)
  return Math.round((mature / total) * 100)
}
