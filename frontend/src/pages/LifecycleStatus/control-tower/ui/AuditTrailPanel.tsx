/**
 * ============================================================================
 * CONTROL TOWER — AUDIT TRAIL PANEL
 * ============================================================================
 *
 * Scrollable chronological log of lifecycle events.
 *
 * Aviation: EN9100 §7.5 — documented information / audit trail.
 * ============================================================================
 */

import React, { useState } from 'react'
import { ScrollText, ChevronDown, ChevronUp, Filter } from 'lucide-react'
import type { LifecycleAuditEvent } from '../types/contracts'
import { Section, StatusBadge, Skeleton } from './Primitives'

interface Props {
  events: LifecycleAuditEvent[] | undefined
  isLoading: boolean
}

const EVENT_ICONS: Record<string, string> = {
  status_change: '🔄',
  approval_requested: '📋',
  approval_granted: '✅',
  approval_rejected: '❌',
  sla_breach: '⏰',
  anomaly_detected: '⚡',
  integrity_violation: '🔗',
  manual_override: '🔧',
}

export function AuditTrailPanel({ events, isLoading }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [filterType, setFilterType] = useState<string | null>(null)

  if (isLoading || !events) {
    return (
      <Section title="Audit Trail" icon={ScrollText}>
        <Skeleton className="h-48 w-full" />
      </Section>
    )
  }

  const filtered = filterType ? events.filter((e) => e.eventType === filterType) : events
  const displayed = expanded ? filtered : filtered.slice(0, 10)
  const eventTypes = [...new Set(events.map((e) => e.eventType))]

  return (
    <Section
      title="Lifecycle Audit Trail"
      subtitle={`${events.length} events recorded`}
      icon={ScrollText}
      actions={
        <div className="flex items-center gap-2">
          <select
            value={filterType ?? ''}
            onChange={(e) => setFilterType(e.target.value || null)}
            className="text-xs border border-gray-200 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          >
            <option value="">All events</option>
            {eventTypes.map((t) => (
              <option key={t} value={t}>{t.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
      }
    >
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />

        <div className="space-y-0">
          {displayed.map((event, idx) => (
            <div key={event.eventId} className="relative flex gap-4 py-3">
              {/* Timeline dot */}
              <div className="relative z-10 flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 text-sm">
                {EVENT_ICONS[event.eventType] ?? '📝'}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-gray-900 dark:text-white">
                    {event.entityId}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    {event.eventType.replace(/_/g, ' ')}
                  </span>
                  {event.fromStatus && event.toStatus && (
                    <span className="flex items-center gap-1">
                      <StatusBadge status={event.fromStatus} />
                      <span className="text-gray-400 text-[10px]">→</span>
                      <StatusBadge status={event.toStatus} />
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                  by <span className="font-medium">{event.performedBy}</span> · {new Date(event.timestamp).toLocaleString()}
                  {event.comment && <span className="ml-2 italic">"{event.comment}"</span>}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filtered.length > 10 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline mt-2 ml-12"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {expanded ? 'Show less' : `Show all ${filtered.length} events`}
          </button>
        )}
      </div>
    </Section>
  )
}
