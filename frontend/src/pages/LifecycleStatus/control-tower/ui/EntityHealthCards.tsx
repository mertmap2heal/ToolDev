/**
 * ============================================================================
 * CONTROL TOWER — ENTITY HEALTH CARDS
 * ============================================================================
 *
 * Renders a card per entity group (Function / PBS component) showing:
 *   - Mini stacked bar of statuses
 *   - Maturity %
 *   - Active / total counts
 *   - Optional alert icon when maturity < threshold
 * ============================================================================
 */

import React from 'react'
import { Heart, AlertCircle } from 'lucide-react'
import type { EntityHealthSummary } from '../types/contracts'
import { Section, ProgressBar, StatusBadge, Skeleton } from './Primitives'

interface Props {
  title: string
  subtitle?: string
  items: EntityHealthSummary[] | undefined
  isLoading: boolean
  maturityThreshold?: number
}

export function EntityHealthCards({ title, subtitle, items, isLoading, maturityThreshold = 50 }: Props) {
  if (isLoading || !items) {
    return (
      <Section title={title} icon={Heart}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <Skeleton className="h-4 w-24 mb-3" />
              <Skeleton className="h-2 w-full mb-2" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      </Section>
    )
  }

  const sorted = [...items].sort((a, b) => a.maturityPercent - b.maturityPercent)

  return (
    <Section title={title} subtitle={subtitle} icon={Heart}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map((item) => {
          const isLow = item.maturityPercent < maturityThreshold
          return (
            <div
              key={item.entityId}
              className={`border rounded-lg p-4 transition-colors ${
                isLow
                  ? 'border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-white truncate mr-2">
                  {item.entityName}
                </span>
                {isLow && <AlertCircle size={14} className="text-amber-500 flex-shrink-0" />}
              </div>

              {/* Maturity bar */}
              <div className="mb-2">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-500 dark:text-gray-400">Maturity</span>
                  <span className={`font-semibold ${isLow ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {item.maturityPercent.toFixed(0)}%
                  </span>
                </div>
                <ProgressBar
                  value={item.maturityPercent}
                  colour={isLow ? 'bg-amber-500' : 'bg-emerald-500'}
                />
              </div>

              {/* Status pills (top 3) */}
              <div className="flex flex-wrap gap-1 mt-2">
                {item.statusBreakdown
                  .filter((sb) => sb.count > 0)
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 3)
                  .map((sb) => (
                    <span key={sb.status} className="text-[10px] flex items-center gap-1">
                      <StatusBadge status={sb.status} />
                      <span className="text-gray-500 dark:text-gray-400">{sb.count}</span>
                    </span>
                  ))}
              </div>
            </div>
          )
        })}
      </div>
    </Section>
  )
}
