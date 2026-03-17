/**
 * ============================================================================
 * CONTROL TOWER — READINESS SCORE PANEL
 * ============================================================================
 *
 * Radar-style breakdown of readiness dimensions + overall gate score.
 *
 * Aviation: ARP4754A §6 — Certification / Qualification readiness.
 * ============================================================================
 */

import React from 'react'
import { Target } from 'lucide-react'
import type { ReadinessScore, ReadinessDimension } from '../types/contracts'
import { Section, ProgressBar, Skeleton } from './Primitives'

interface Props {
  readiness: ReadinessScore | undefined
  isLoading: boolean
}

function gateColour(score: number): string {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400'
  if (score >= 60) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

function barColour(score: number): string {
  if (score >= 80) return 'bg-emerald-500'
  if (score >= 60) return 'bg-amber-500'
  return 'bg-red-500'
}

function gateLabel(gate: string): string {
  const labels: Record<string, string> = {
    SRR: 'System Requirements Review',
    PDR: 'Preliminary Design Review',
    CDR: 'Critical Design Review',
    TRR: 'Test Readiness Review',
    PRR: 'Production Readiness Review',
    FAI: 'First Article Inspection',
    TC: 'Type Certification',
  }
  return labels[gate] ?? gate
}

export function ReadinessPanel({ readiness, isLoading }: Props) {
  if (isLoading || !readiness) {
    return (
      <Section title="Gate Readiness" icon={Target}>
        <Skeleton className="h-48 w-full" />
      </Section>
    )
  }

  return (
    <Section
      title="Gate Readiness"
      subtitle={`Next gate: ${readiness.nextGate} — ${gateLabel(readiness.nextGate)}`}
      icon={Target}
    >
      {/* Overall score */}
      <div className="flex items-center gap-4 mb-6 p-4 rounded-lg bg-gray-50 dark:bg-gray-700/30">
        <div className="flex-shrink-0">
          <div className={`text-4xl font-bold ${gateColour(readiness.overallScore)}`}>
            {readiness.overallScore.toFixed(0)}%
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Overall Readiness</div>
        </div>
        <div className="flex-1">
          <ProgressBar value={readiness.overallScore} colour={barColour(readiness.overallScore)} height="h-3" />
          <div className="flex justify-between mt-1 text-[10px] text-gray-400">
            <span>0%</span>
            <span>Gate threshold: 80%</span>
            <span>100%</span>
          </div>
        </div>
      </div>

      {/* Dimensions */}
      <div className="space-y-3">
        {readiness.dimensions
          .sort((a, b) => a.score - b.score)
          .map((dim) => (
            <div key={dim.dimension} className="flex items-center gap-3">
              <span className="text-xs text-gray-700 dark:text-gray-300 w-40 truncate font-medium">
                {dim.dimension}
              </span>
              <div className="flex-1">
                <ProgressBar value={dim.score} colour={barColour(dim.score)} height="h-2" />
              </div>
              <span className={`text-xs font-semibold w-10 text-right ${gateColour(dim.score)}`}>
                {dim.score.toFixed(0)}%
              </span>
              <span className="text-[10px] text-gray-400 w-6 text-right">{dim.weight}×</span>
            </div>
          ))}
      </div>

      {/* Blockers */}
      {readiness.blockers.length > 0 && (
        <div className="mt-4 p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10">
          <div className="text-xs font-semibold text-red-700 dark:text-red-400 mb-2">
            Blockers ({readiness.blockers.length})
          </div>
          <ul className="space-y-1">
            {readiness.blockers.map((b, i) => (
              <li key={i} className="text-[10px] text-red-600 dark:text-red-300 flex items-start gap-1.5">
                <span className="mt-0.5">•</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  )
}
