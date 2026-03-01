/**
 * ============================================================================
 * CONTROL TOWER — KPI BAR
 * ============================================================================
 *
 * Top-level metrics strip: Total Entities, Global Maturity %, Active Items,
 * Overdue SLAs, Critical Anomalies, Readiness Score.
 *
 * Each KPI card shows a value, label, sparkline, and trend arrow.
 * ============================================================================
 */

import React from 'react'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock,
  Layers,
  Shield,
} from 'lucide-react'
import type { ControlTowerOverview, ReadinessScore, SlaBreach, LifecycleAnomaly } from '../types/contracts'
import { Sparkline, TrendArrow, KpiSkeleton } from './Primitives'

interface KpiBarProps {
  overview: ControlTowerOverview | undefined
  readiness: ReadinessScore | undefined
  slaBreaches: SlaBreach[] | undefined
  anomalies: LifecycleAnomaly[] | undefined
  isLoading: boolean
}

interface KpiCard {
  label: string
  value: string | number
  icon: React.ElementType
  colour: string
  trend?: number
  sparklineValues?: number[]
  sparklineColour?: string
}

export function KpiBar({ overview, readiness, slaBreaches, anomalies, isLoading }: KpiBarProps) {
  if (isLoading || !overview) return <KpiSkeleton />

  const criticalAnomalies = anomalies?.filter(a => a.severity === 'Critical').length ?? 0
  const activeSlaBreaches = slaBreaches?.filter(b => !b.resolved).length ?? 0

  const cards: KpiCard[] = [
    {
      label: 'Total Entities',
      value: overview.totalEntities.toLocaleString(),
      icon: Layers,
      colour: 'text-blue-600 dark:text-blue-400',
    },
    {
      label: 'Global Maturity',
      value: `${overview.globalMaturityPercent.toFixed(1)}%`,
      icon: BarChart3,
      colour: 'text-emerald-600 dark:text-emerald-400',
      trend: 2.3, // placeholder — will connect to trends data
    },
    {
      label: 'Active Items',
      value: overview.statusDistribution.find(s => s.status === 'Active')?.count ?? 0,
      icon: Activity,
      colour: 'text-cyan-600 dark:text-cyan-400',
    },
    {
      label: 'SLA Breaches',
      value: activeSlaBreaches,
      icon: Clock,
      colour: activeSlaBreaches > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500',
    },
    {
      label: 'Critical Anomalies',
      value: criticalAnomalies,
      icon: AlertTriangle,
      colour: criticalAnomalies > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500',
    },
    {
      label: 'Readiness Score',
      value: readiness ? `${readiness.overallScore.toFixed(0)}%` : '—',
      icon: Shield,
      colour: 'text-indigo-600 dark:text-indigo-400',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col gap-1"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              {card.label}
            </span>
            <card.icon size={16} className={card.colour} />
          </div>

          <div className="flex items-end gap-2 mt-1">
            <span className={`text-2xl font-bold ${card.colour}`}>{card.value}</span>
            {card.trend !== undefined && <TrendArrow value={card.trend} />}
          </div>

          {card.sparklineValues && card.sparklineValues.length > 1 && (
            <Sparkline values={card.sparklineValues} colour={card.sparklineColour} />
          )}
        </div>
      ))}
    </div>
  )
}
