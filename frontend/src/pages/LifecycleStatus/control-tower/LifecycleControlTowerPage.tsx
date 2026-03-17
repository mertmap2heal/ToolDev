/**
 * ============================================================================
 * LIFECYCLE CONTROL TOWER — MAIN PAGE
 * ============================================================================
 *
 * Enterprise-grade Lifecycle Monitoring & Control dashboard.
 * Fully isolated — no shared state, APIs, or logic with other pages.
 *
 * Layout (top → bottom):
 *   1. Header bar with title, project context, mock-data indicator
 *   2. KPI strip (6 metrics)
 *   3. Status Distribution Dashboard (stacked bar + breakdown)
 *   4. Entity × Status Heatmap
 *   5. Function Health cards
 *   6. PBS Health cards
 *   7. Traceability Thread table
 *   8. Governance & Approvals + SLA Breaches
 *   9. Anomaly Detection + Digital Thread Integrity
 *  10. Gate Readiness panel
 *  11. Audit Trail timeline
 *
 * Aviation Standards:
 *   - ARP4754A   (system development)
 *   - DO-178C    (software assurance)
 *   - DO-254     (hardware assurance)
 *   - ARP4761    (safety assessment)
 *   - EN9100     (quality management)
 * ============================================================================
 */

import React, { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { Radio, RefreshCw } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'

// Data hooks (isolated)
import {
  useControlTowerOverview,
  useControlTowerHeatmap,
  useFunctionHealth,
  usePBSHealth,
  useTraceabilityTable,
  useSlaBreaches,
  useAnomalies,
  useIntegrityViolations,
  useReadinessScore,
  usePendingApprovals,
  useAuditTrail,
} from './data/useLifecycleControlData'

// UI sections (isolated)
import { MockDataBanner } from './ui/Primitives'
import { KpiBar } from './ui/KpiBar'
import { StatusDistributionDashboard } from './ui/StatusDistributionDashboard'
import { EntityHeatmap } from './ui/EntityHeatmap'
import { EntityHealthCards } from './ui/EntityHealthCards'
import { TraceabilityTable } from './ui/TraceabilityTable'
import { GovernancePanel } from './ui/GovernancePanel'
import { AnomalyIntegrityPanel } from './ui/AnomalyIntegrityPanel'
import { ReadinessPanel } from './ui/ReadinessPanel'
import { AuditTrailPanel } from './ui/AuditTrailPanel'

export default function LifecycleControlTowerPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const queryClient = useQueryClient()

  // ── Data queries ─────────────────────────────────────────────────────
  const overview = useControlTowerOverview(projectId)
  const heatmap = useControlTowerHeatmap(projectId)
  const functionHealth = useFunctionHealth(projectId)
  const pbsHealth = usePBSHealth(projectId)
  const traceability = useTraceabilityTable(projectId)
  const slaBreaches = useSlaBreaches(projectId)
  const anomalies = useAnomalies(projectId)
  const integrity = useIntegrityViolations(projectId)
  const readiness = useReadinessScore(projectId)
  const approvals = usePendingApprovals(projectId)
  const audit = useAuditTrail(projectId)

  // ── Mock-data detection ──────────────────────────────────────────────
  const isMock = useMemo(() => {
    return [overview, heatmap, functionHealth, pbsHealth, traceability, slaBreaches, anomalies, integrity, readiness, approvals, audit]
      .some((q) => q.data?.isMock === true)
  }, [overview.data, heatmap.data, functionHealth.data, pbsHealth.data, traceability.data, slaBreaches.data, anomalies.data, integrity.data, readiness.data, approvals.data, audit.data])

  // ── Refresh all ──────────────────────────────────────────────────────
  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ['control-tower'] })
  }

  const isAnyLoading = overview.isLoading

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/40">
            <Radio size={20} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Lifecycle Control Tower
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Enterprise monitoring &amp; governance dashboard · ARP4754A / DO-178C compliant
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <MockDataBanner visible={isMock} />
          <button
            onClick={handleRefresh}
            disabled={isAnyLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={isAnyLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── 1. KPI Strip ─────────────────────────────────────────────── */}
      <KpiBar
        overview={overview.data?.data}
        readiness={readiness.data?.data}
        slaBreaches={slaBreaches.data?.data}
        anomalies={anomalies.data?.data}
        isLoading={overview.isLoading}
      />

      {/* ── 2. Status Distribution ───────────────────────────────────── */}
      <StatusDistributionDashboard
        overview={overview.data?.data}
        isLoading={overview.isLoading}
      />

      {/* ── 3. Heatmap ───────────────────────────────────────────────── */}
      <EntityHeatmap
        heatmap={heatmap.data?.data}
        isLoading={heatmap.isLoading}
      />

      {/* ── 4-5. Function & PBS Health ───────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <EntityHealthCards
          title="Function Health"
          subtitle="ARP4754A function decomposition maturity"
          items={functionHealth.data?.data}
          isLoading={functionHealth.isLoading}
          maturityThreshold={50}
        />
        <EntityHealthCards
          title="PBS Component Health"
          subtitle="Product breakdown structure maturity"
          items={pbsHealth.data?.data}
          isLoading={pbsHealth.isLoading}
          maturityThreshold={40}
        />
      </div>

      {/* ── 6. Traceability Thread ───────────────────────────────────── */}
      <TraceabilityTable
        rows={traceability.data?.data}
        isLoading={traceability.isLoading}
      />

      {/* ── 7. Governance & SLA ──────────────────────────────────────── */}
      <GovernancePanel
        approvals={approvals.data?.data}
        slaBreaches={slaBreaches.data?.data}
        isLoading={approvals.isLoading || slaBreaches.isLoading}
      />

      {/* ── 8. Anomalies & Integrity ─────────────────────────────────── */}
      <AnomalyIntegrityPanel
        anomalies={anomalies.data?.data}
        integrityViolations={integrity.data?.data}
        isLoading={anomalies.isLoading || integrity.isLoading}
      />

      {/* ── 9. Gate Readiness ────────────────────────────────────────── */}
      <ReadinessPanel
        readiness={readiness.data?.data}
        isLoading={readiness.isLoading}
      />

      {/* ── 10. Audit Trail ──────────────────────────────────────────── */}
      <AuditTrailPanel
        events={audit.data?.data}
        isLoading={audit.isLoading}
      />

      {/* ── Footer reference ─────────────────────────────────────────── */}
      <div className="text-center text-[10px] text-gray-400 dark:text-gray-600 py-2">
        Lifecycle Control Tower v1.0 · Isolated module · Ref: ARP4754A, DO-178C, DO-254, ARP4761, EN9100
      </div>
    </div>
  )
}
