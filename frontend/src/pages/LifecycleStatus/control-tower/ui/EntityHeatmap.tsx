/**
 * ============================================================================
 * CONTROL TOWER — ENTITY HEATMAP
 * ============================================================================
 *
 * Rows = Entity Types · Columns = Lifecycle Statuses
 * Cell colour intensity = count relative to row max.
 *
 * Hover shows exact count. Click could drill-down (future).
 * ============================================================================
 */

import React from 'react'
import { Grid3x3 } from 'lucide-react'
import type { HeatmapCell, LifecycleStatus, MonitoredEntityType } from '../types/contracts'
import { Section, Skeleton } from './Primitives'

interface Props {
  heatmap: HeatmapCell[] | undefined
  isLoading: boolean
}

const STATUSES: LifecycleStatus[] = [
  'Draft', 'In Review', 'Approved', 'Active', 'Under Change', 'Deprecated', 'Retired', 'Archived',
]
const ENTITY_TYPES: MonitoredEntityType[] = [
  'Requirement', 'Function', 'Component', 'Interface', 'Test Case', 'Hazard', 'Change Request',
]

function intensityClass(value: number, rowMax: number): string {
  if (value === 0) return 'bg-gray-50 dark:bg-gray-800'
  const ratio = value / (rowMax || 1)
  if (ratio > 0.75) return 'bg-blue-600 text-white'
  if (ratio > 0.5) return 'bg-blue-500 text-white'
  if (ratio > 0.25) return 'bg-blue-300 dark:bg-blue-700 text-blue-900 dark:text-blue-100'
  return 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
}

export function EntityHeatmap({ heatmap, isLoading }: Props) {
  if (isLoading || !heatmap) {
    return (
      <Section title="Entity × Status Heatmap" icon={Grid3x3}>
        <Skeleton className="h-48 w-full" />
      </Section>
    )
  }

  // Build lookup: entityType → status → count
  const lookup = new Map<string, Map<string, number>>()
  for (const cell of heatmap) {
    if (!lookup.has(cell.entityType)) lookup.set(cell.entityType, new Map())
    lookup.get(cell.entityType)!.set(cell.status, cell.count)
  }

  return (
    <Section
      title="Entity × Status Heatmap"
      subtitle="Concentration of entities across lifecycle states"
      icon={Grid3x3}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="text-left py-2 pr-3 text-gray-500 dark:text-gray-400 font-medium">Entity Type</th>
              {STATUSES.map((s) => (
                <th key={s} className="px-2 py-2 text-center text-gray-500 dark:text-gray-400 font-medium whitespace-nowrap">
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ENTITY_TYPES.map((et) => {
              const row = lookup.get(et)
              const values = STATUSES.map((s) => row?.get(s) ?? 0)
              const rowMax = Math.max(...values, 1)
              return (
                <tr key={et} className="border-t border-gray-100 dark:border-gray-700/50">
                  <td className="py-2 pr-3 text-gray-700 dark:text-gray-300 font-medium whitespace-nowrap">{et}</td>
                  {STATUSES.map((s, i) => {
                    const val = values[i]
                    return (
                      <td key={s} className="px-1 py-1 text-center">
                        <div
                          className={`rounded px-2 py-1.5 font-semibold transition-colors ${intensityClass(val, rowMax)}`}
                          title={`${et} / ${s}: ${val}`}
                        >
                          {val > 0 ? val : '·'}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Section>
  )
}
