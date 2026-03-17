/**
 * ============================================================================
 * CONTROL TOWER — GOVERNANCE & APPROVALS PANEL
 * ============================================================================
 *
 * Pending approvals list · SLA breach alerts · Quick-action buttons.
 *
 * Aviation: EN9100 §7.1.3 — controlled transitions require documented approval.
 * ============================================================================
 */

import React from 'react'
import { ShieldCheck, Clock, UserCheck, AlertOctagon } from 'lucide-react'
import type { ApprovalRecord, SlaBreach } from '../types/contracts'
import { Section, SeverityIcon, StatusBadge, Skeleton } from './Primitives'

interface Props {
  approvals: ApprovalRecord[] | undefined
  slaBreaches: SlaBreach[] | undefined
  isLoading: boolean
}

export function GovernancePanel({ approvals, slaBreaches, isLoading }: Props) {
  if (isLoading) {
    return (
      <Section title="Governance & Approvals" icon={ShieldCheck}>
        <Skeleton className="h-40 w-full" />
      </Section>
    )
  }

  const pendingApprovals = approvals?.filter((a) => a.decision === 'Pending') ?? []
  const activeBreaches = slaBreaches?.filter((b) => !b.resolved) ?? []

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Pending Approvals */}
      <Section
        title="Pending Approvals"
        subtitle={`${pendingApprovals.length} awaiting decision`}
        icon={UserCheck}
      >
        {pendingApprovals.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-sm">
            <ShieldCheck size={24} className="mx-auto mb-2 text-emerald-400" />
            All approvals are resolved
          </div>
        ) : (
          <div className="space-y-3 max-h-[320px] overflow-y-auto">
            {pendingApprovals.map((a) => (
              <div
                key={a.approvalId}
                className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
              >
                <div className="flex-shrink-0 mt-0.5">
                  <UserCheck size={16} className="text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                      {a.entityId}
                    </span>
                    <StatusBadge status={a.fromStatus} />
                    <span className="text-gray-400">→</span>
                    <StatusBadge status={a.toStatus} />
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">
                    Requested by <span className="font-medium">{a.requestedBy}</span> · {new Date(a.requestedAt).toLocaleDateString()}
                  </div>
                </div>
                <button className="flex-shrink-0 px-2.5 py-1 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                  Review
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* SLA Breaches */}
      <Section
        title="SLA Breach Alerts"
        subtitle={`${activeBreaches.length} active violations`}
        icon={Clock}
      >
        {activeBreaches.length === 0 ? (
          <div className="text-center py-6 text-gray-400 text-sm">
            <Clock size={24} className="mx-auto mb-2 text-emerald-400" />
            No SLA violations
          </div>
        ) : (
          <div className="space-y-3 max-h-[320px] overflow-y-auto">
            {activeBreaches.map((b) => (
              <div
                key={b.breachId}
                className="flex items-start gap-3 p-3 rounded-lg border border-red-100 dark:border-red-900/40 bg-red-50/50 dark:bg-red-900/10"
              >
                <div className="flex-shrink-0 mt-0.5">
                  <SeverityIcon level={b.severity} size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-gray-900 dark:text-white">
                      {b.entityId}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 font-medium">
                      {b.severity}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-600 dark:text-gray-400 mb-1">
                    Status <span className="font-medium">{b.stuckInStatus}</span> for{' '}
                    <span className="font-bold text-red-600 dark:text-red-400">{b.actualDays}d</span>{' '}
                    (limit: {b.slaMaxDays}d)
                  </p>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">
                    Escalated to: {b.escalatedTo?.join(', ') ?? 'None'}
                  </div>
                </div>
                <div className="flex-shrink-0 flex items-center">
                  <AlertOctagon size={14} className="text-red-500 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
