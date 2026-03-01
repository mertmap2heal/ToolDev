/**
 * ============================================================================
 * CONTROL TOWER — STATUS DISTRIBUTION DASHBOARD
 * ============================================================================
 *
 * Horizontal stacked bar showing entity counts per lifecycle status,
 * plus a breakdown table underneath.
 *
 * Fully CSS-based — no chart library dependency.
 * ============================================================================
 */

import React from 'react'
import { PieChart } from 'lucide-react'
import type { StatusDistribution, ControlTowerOverview } from '../types/contracts'
import { Section, getStatusColour, StatusBadge, Skeleton } from './Primitives'

interface Props {
  overview: ControlTowerOverview | undefined
  isLoading: boolean
}

const BAR_COLOURS: Record<string, string> = {
  Draft:         'bg-gray-400',
  'In Review':   'bg-blue-500',
  Approved:      'bg-emerald-500',
  Active:        'bg-cyan-500',
  'Under Change': 'bg-amber-500',
  Deprecated:    'bg-orange-500',
  Retired:       'bg-rose-500',
  Archived:      'bg-slate-400',
}

export function StatusDistributionDashboard({ overview, isLoading }: Props) {
  if (isLoading || !overview) {
    return (
      <Section title="Status Distribution" icon={PieChart}>
        <Skeleton className="h-8 w-full mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}
        </div>
      </Section>
    )
  }

  const total = overview.totalEntities || 1
  const sorted = [...overview.statusDistribution].sort((a, b) => b.count - a.count)

  return (
    <Section
      title="Status Distribution"
      subtitle={`${total.toLocaleString()} entities across ${overview.statusDistribution.length} states`}
      icon={PieChart}
    >
      {/* Stacked horizontal bar */}
      <div className="flex h-8 rounded-md overflow-hidden mb-6">
        {sorted.map((sd) => {
          const pct = (sd.count / total) * 100
          if (pct < 0.5) return null
          return (
            <div
              key={sd.status}
              className={`${BAR_COLOURS[sd.status] ?? 'bg-gray-300'} relative group transition-all duration-300`}
              style={{ width: `${pct}%` }}
              title={`${sd.status}: ${sd.count} (${pct.toFixed(1)}%)`}
            >
              {pct > 6 && (
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow">
                  {pct.toFixed(0)}%
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Breakdown table */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
        {sorted.map((sd) => (
          <div key={sd.status} className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-700/50">
            <StatusBadge status={sd.status} />
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {sd.count.toLocaleString()}
              </span>
              <span className="text-xs text-gray-400 w-12 text-right">
                {((sd.count / total) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}
