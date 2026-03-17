import { useMemo, useEffect, useState } from 'react'
import {
  Percent,
  Target,
  AlertCircle,
  AlertTriangle,
  FileCheck,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react'
import { useCertificationStore } from '../store'
import { getCertificationMetrics } from '../../../services/certification.service'
import type { CertificationMetrics } from '../types'
import { format } from 'date-fns'

const CONTEXT_EMPTY_MESSAGE = 'Select a baseline or release in the context selector above to view certification readiness and data.'

export default function OverviewTab() {
  const { state } = useCertificationStore()
  const projectId = state.context.projectId
  const [metrics, setMetrics] = useState<CertificationMetrics | null>(null)
  const { context, objectives, findings, evidence, activityLog, readinessGates } = state

  useEffect(() => {
    if (!projectId) {
      setMetrics(null)
      return
    }
    getCertificationMetrics(projectId).then((res) => {
      if (res.success && res.data) setMetrics(res.data)
      else setMetrics(null)
    })
  }, [projectId])
  const gates = readinessGates.length > 0 ? readinessGates : [
    { id: 'gate-1', label: 'Configuration Frozen?', passed: true },
    { id: 'gate-2', label: 'Verification Evidence Linked?', passed: true },
    { id: 'gate-3', label: 'Safety Review Complete?', passed: true },
    { id: 'gate-4', label: 'No Open Major Findings?', passed: false, reason: 'Open Major finding(s)' },
  ]
  const hasContext = context.selectedBaseline !== null || context.selectedRelease !== null

  if (!hasContext) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">{CONTEXT_EMPTY_MESSAGE}</p>
      </div>
    )
  }

  const readinessPercent = useMemo(() => {
    if (objectives.length === 0) return 0
    const complete = objectives.filter((o) => o.status === 'Complete').length
    return Math.round((complete / objectives.length) * 100)
  }, [objectives])

  const openObjectives = useMemo(
    () => objectives.filter((o) => o.status === 'Open').length,
    [objectives]
  )
  const blockedObjectives = useMemo(
    () => objectives.filter((o) => o.status === 'Blocked').length,
    [objectives]
  )
  const highCriticalityOpen = useMemo(
    () => objectives.filter((o) => o.criticality === 'High' && (o.status === 'Open' || o.status === 'Partial')).length,
    [objectives]
  )
  const openFindingsMajor = useMemo(
    () => findings.filter((f) => f.severity === 'Major' && (f.status === 'Open' || f.status === 'InProgress')).length,
    [findings]
  )
  const openFindingsMinor = useMemo(
    () => findings.filter((f) => f.severity === 'Minor' && (f.status === 'Open' || f.status === 'InProgress')).length,
    [findings]
  )
  const evidenceApprovalRate = useMemo(() => {
    if (evidence.length === 0) return 100
    const approved = evidence.filter((e) => e.status === 'Approved').length
    return Math.round((approved / evidence.length) * 100)
  }, [evidence])

  const gatesWithDerived = useMemo(() => {
    const majorOpen = findings.some(
      (f) => f.severity === 'Major' && (f.status === 'Open' || f.status === 'InProgress')
    )
    return gates.map((g) =>
      g.id === 'gate-4' ? { ...g, passed: !majorOpen, reason: majorOpen ? 'One or more Major findings are Open or In Progress' : undefined } : g
    )
  }, [findings, gates])

  const recentActivity = useMemo(
    () => [...activityLog].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 15),
    [activityLog]
  )

  const cards = [
    { label: 'Overall readiness', value: `${readinessPercent}%`, icon: Percent },
    { label: 'Open objectives', value: openObjectives, icon: Target },
    { label: 'Blocked objectives', value: blockedObjectives, icon: XCircle },
    { label: 'High criticality open', value: highCriticalityOpen, icon: AlertTriangle },
    { label: 'Open findings (Major / Minor)', value: `${openFindingsMajor} / ${openFindingsMinor}`, icon: AlertCircle },
    { label: 'Evidence approval rate', value: `${evidenceApprovalRate}%`, icon: FileCheck },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
          >
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {label}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <Icon size={20} className="text-gray-400 dark:text-gray-500" />
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Readiness gates</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            All gates must pass to enable Generate Package.
          </p>
        </div>
        <div className="p-4 space-y-3">
          {gatesWithDerived.map((gate) => (
            <div
              key={gate.id}
              className="flex items-center justify-between gap-4 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
            >
              <div className="flex items-center gap-3">
                {gate.passed ? (
                  <CheckCircle2 size={20} className="text-green-600 dark:text-green-400 shrink-0" />
                ) : (
                  <XCircle size={20} className="text-red-600 dark:text-red-400 shrink-0" />
                )}
                <span className="text-sm font-medium text-gray-900 dark:text-white">{gate.label}</span>
              </div>
              {!gate.passed && gate.reason && (
                <span className="text-xs text-amber-600 dark:text-amber-400">{gate.reason}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {metrics && (metrics.overdueActionItemsCount > 0 || metrics.openFindingsCount > 0) && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2">Attention</h3>
          <ul className="text-sm text-amber-800 dark:text-amber-200 space-y-1">
            {metrics.overdueActionItemsCount > 0 && (
              <li>• {metrics.overdueActionItemsCount} overdue authority action item(s)</li>
            )}
            {metrics.openFindingsBySeverity?.Major > 0 && (
              <li>• {metrics.openFindingsBySeverity.Major} open Major finding(s)</li>
            )}
            {metrics.readinessGatesTotal > 0 && metrics.readinessGatesPassed < metrics.readinessGatesTotal && (
              <li>• {metrics.readinessGatesTotal - metrics.readinessGatesPassed} readiness gate(s) not passed</li>
            )}
          </ul>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Recent certification activity
          </h3>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-80 overflow-y-auto">
          {recentActivity.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              No activity yet.
            </div>
          ) : (
            recentActivity.map((entry) => (
              <div
                key={entry.id}
                className="px-4 py-2 flex items-start gap-3 text-sm"
              >
                <Clock size={14} className="text-gray-400 dark:text-gray-500 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-gray-900 dark:text-white">{entry.details}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {format(new Date(entry.timestamp), 'PPp')}
                    {entry.actor && ` · ${entry.actor}`}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
