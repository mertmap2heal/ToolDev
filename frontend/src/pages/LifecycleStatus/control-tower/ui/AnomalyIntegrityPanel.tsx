/**
 * ============================================================================
 * CONTROL TOWER — ANOMALY & INTEGRITY PANEL
 * ============================================================================
 *
 * Anomaly detection alerts + Digital Thread Integrity violations.
 *
 * Aviation: DO-178C §6.3.4 — anomaly tracking.
 *          ARP4754A §5.3 — traceability integrity.
 * ============================================================================
 */

import React from 'react'
import { Zap, Link2Off, AlertTriangle } from 'lucide-react'
import type { LifecycleAnomaly, IntegrityViolation } from '../types/contracts'
import { Section, SeverityIcon, Skeleton } from './Primitives'

interface Props {
  anomalies: LifecycleAnomaly[] | undefined
  integrityViolations: IntegrityViolation[] | undefined
  isLoading: boolean
}

export function AnomalyIntegrityPanel({ anomalies, integrityViolations, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Anomalies" icon={Zap}>
          <Skeleton className="h-40 w-full" />
        </Section>
        <Section title="Integrity Violations" icon={Link2Off}>
          <Skeleton className="h-40 w-full" />
        </Section>
      </div>
    )
  }

  const sortedAnomalies = [...(anomalies ?? [])].sort((a, b) => {
    const order = { Critical: 0, High: 1, Medium: 2, Low: 3, Info: 4 }
    return (order[a.severity] ?? 4) - (order[b.severity] ?? 4)
  })

  const sortedViolations = [...(integrityViolations ?? [])].sort((a, b) => {
    const order = { Critical: 0, High: 1, Medium: 2, Low: 3, Info: 4 }
    return (order[a.severity] ?? 4) - (order[b.severity] ?? 4)
  })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Anomalies */}
      <Section
        title="Lifecycle Anomalies"
        subtitle={`${sortedAnomalies.length} detected`}
        icon={Zap}
      >
        {sortedAnomalies.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-sm">No anomalies detected</div>
        ) : (
          <div className="space-y-2 max-h-[350px] overflow-y-auto">
            {sortedAnomalies.map((a) => (
              <div
                key={a.anomalyId}
                className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30"
              >
                <SeverityIcon level={a.severity} size={16} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-gray-900 dark:text-white">{a.entityId}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      {a.anomalyType.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-600 dark:text-gray-400 line-clamp-2">{a.description}</p>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                    <span>{new Date(a.detectedAt).toLocaleDateString()}</span>
                    {a.suggestedAction && (
                      <span className="text-blue-500 dark:text-blue-400">💡 {a.suggestedAction}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Integrity Violations */}
      <Section
        title="Digital Thread Integrity"
        subtitle={`${sortedViolations.length} violations`}
        icon={Link2Off}
      >
        {sortedViolations.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-sm">Thread integrity intact</div>
        ) : (
          <div className="space-y-2 max-h-[350px] overflow-y-auto">
            {sortedViolations.map((v) => (
              <div
                key={v.violationId}
                className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30"
              >
                <SeverityIcon level={v.severity} size={16} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-gray-900 dark:text-white">
                      {v.sourceEntityId} → {v.targetEntityId}
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-600 dark:text-gray-400">
                    <span className="font-medium">{v.violationType.replace('_', ' ')}</span>
                    {v.linkType && <span> · Link: {v.linkType}</span>}
                  </div>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                    {v.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
