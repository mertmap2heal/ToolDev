// NX-7 (#460) — the objective-completion matrix.
//
// A design-system.md §6.2 canonical list view (one real <table>, sortable, ID
// column mono) showing one row per CertObjective with a graph-derived
// completion state. Per §8.2 it is the "objective view as home view" — a
// dense, scannable, audit-shaped grid, not a marketing dashboard.
//
// This is a SHARED component (SHARED-SERVICES.md §3.2). The Requirements
// dashboard is the first consumer; the four follow-on dashboard wirings
// (Verification / Certification / Validation / project-landing) reuse it
// unchanged.
//
// Colours are R-9 design tokens only (design-system.md §3.1) — zero
// blue-*/indigo-*/purple-*. completionState is distinguished beyond colour:
// every pill carries its text label and `signed` carries a ShieldCheck icon
// (§9, WCAG 1.4.1).
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ShieldCheck, ChevronUp, ChevronDown } from 'lucide-react'
import type {
  ObjectiveCompletionState,
  ObjectiveMatrixRow,
} from 'shared/objectiveMatrix'
import { getObjectiveMatrix } from '../../services/certification.service'
import { buildDeepLink } from '../../linkage/buildDeepLink'

interface ObjectiveCompletionMatrixProps {
  /** The project whose certification objectives are shown. */
  projectId: string
}

/** completionState pill — R-9 token treatment per the Design comment. */
const STATE_PILL: Record<ObjectiveCompletionState, { label: string; className: string }> = {
  open: { label: 'Open', className: 'bg-surface-inset text-ink-muted' },
  partial: { label: 'Partial', className: 'bg-status-warning/12 text-status-warning' },
  closed: { label: 'Closed', className: 'bg-status-success/12 text-status-success' },
  signed: { label: 'Signed', className: 'bg-accent-primary/12 text-accent-primary' },
}

type SortKey = 'objId' | 'standard' | 'criticality' | 'completionState' | 'requirementsLinked'

/** Stable sort rank for the completionState column. */
const STATE_RANK: Record<ObjectiveCompletionState, number> = {
  open: 0,
  partial: 1,
  closed: 2,
  signed: 3,
}

function StatePill({ state }: { state: ObjectiveCompletionState }) {
  const { label, className } = STATE_PILL[state]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-xs px-1.5 py-0.5 text-xs font-medium ${className}`}
    >
      {state === 'signed' && <ShieldCheck size={14} aria-hidden="true" />}
      {label}
    </span>
  )
}

/** A sortable column header — a <button> inside the <th>, with aria-sort. */
function SortableTh({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  align = 'left',
}: {
  label: string
  sortKey: SortKey
  activeKey: SortKey
  direction: 'asc' | 'desc'
  onSort: (k: SortKey) => void
  align?: 'left' | 'right'
}) {
  const isActive = activeKey === sortKey
  return (
    <th
      scope="col"
      aria-sort={isActive ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`px-3 py-2 text-xs font-semibold text-ink-muted ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-ink-primary ${
          align === 'right' ? 'flex-row-reverse' : ''
        }`}
      >
        {label}
        {isActive &&
          (direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
      </button>
    </th>
  )
}

export default function ObjectiveCompletionMatrix({
  projectId,
}: ObjectiveCompletionMatrixProps) {
  const navigate = useNavigate()
  const [standard, setStandard] = useState('')
  const [criticality, setCriticality] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('objId')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  // j/k + arrow row navigation — the index of the keyboard-focused row.
  const [focusedRow, setFocusedRow] = useState<number>(-1)
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([])

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['objective-matrix', projectId, standard, criticality],
    queryFn: () => getObjectiveMatrix(projectId, { standard, criticality }),
    enabled: !!projectId,
  })

  const matrix = data?.data
  const rows: ObjectiveMatrixRow[] = useMemo(() => matrix?.objectives ?? [], [matrix])
  const availableStandards = matrix?.availableStandards ?? []

  const sortedRows = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'completionState') {
        cmp = STATE_RANK[a.completionState] - STATE_RANK[b.completionState]
      } else if (sortKey === 'requirementsLinked') {
        cmp = a.requirementsLinked - b.requirementsLinked
      } else {
        cmp = String(a[sortKey]).localeCompare(String(b[sortKey]))
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [rows, sortKey, sortDir])

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  // Open the Certification objective view for a row via the deep-link adapter.
  const openObjective = useCallback(
    (row: ObjectiveMatrixRow) => {
      navigate(buildDeepLink(projectId, { type: 'cert_objective', id: row.id }))
    },
    [navigate, projectId],
  )

  // j/k + arrow row navigation; Enter drills down; Escape clears focus.
  const onTableKeyDown = (e: React.KeyboardEvent<HTMLTableSectionElement>) => {
    if (sortedRows.length === 0) return
    if (e.key === 'j' || e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedRow((i) => {
        const next = Math.min(i + 1, sortedRows.length - 1)
        rowRefs.current[next]?.focus()
        return next
      })
    } else if (e.key === 'k' || e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedRow((i) => {
        const next = Math.max(i - 1, 0)
        rowRefs.current[next]?.focus()
        return next
      })
    } else if (e.key === 'Enter' && focusedRow >= 0) {
      e.preventDefault()
      openObjective(sortedRows[focusedRow])
    } else if (e.key === 'Escape') {
      setFocusedRow(-1)
      ;(document.activeElement as HTMLElement | null)?.blur()
    }
  }

  // Reset the keyboard cursor whenever the result set changes.
  useEffect(() => {
    setFocusedRow(-1)
  }, [sortedRows])

  // ---- error state (design-system.md §5.4 — quote the server message) ----
  if (error) {
    const message =
      (error as { message?: string; error?: string })?.message ||
      (error as { error?: string })?.error ||
      'unknown error'
    return (
      <div className="rounded-md border border-default bg-surface-raised p-4 text-sm text-ink-primary">
        Could not load the objective matrix: {message}.{' '}
        <button
          type="button"
          onClick={() => refetch()}
          className="font-medium text-accent-primary hover:text-accent-primary-hover"
        >
          Retry
        </button>
      </div>
    )
  }

  // ---- loading state — §7 shimmer skeleton in the table-row shape ----
  if (isLoading) {
    return (
      <div>
        <p className="mb-3 text-sm text-ink-muted">Loading objectives…</p>
        <div className="overflow-hidden rounded-md border border-default">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-default px-3 py-3 last:border-b-0"
            >
              <div className="h-3 w-24 animate-pulse rounded-xs bg-surface-inset" />
              <div className="h-3 w-20 animate-pulse rounded-xs bg-surface-inset" />
              <div className="h-3 flex-1 animate-pulse rounded-xs bg-surface-inset" />
              <div className="h-3 w-16 animate-pulse rounded-xs bg-surface-inset" />
              <div className="h-5 w-16 animate-pulse rounded-xs bg-surface-inset" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const filtersActive = standard !== '' || criticality !== ''

  return (
    <div>
      {/* Filters — §2.4 progressive disclosure: two controls, no toolbar sprawl. */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <span>Standard</span>
          <select
            value={standard}
            onChange={(e) => setStandard(e.target.value)}
            className="rounded-sm border border-default bg-surface-base px-2 py-1 text-sm text-ink-primary"
          >
            <option value="">All standards</option>
            {availableStandards.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <span>Criticality</span>
          <select
            value={criticality}
            onChange={(e) => setCriticality(e.target.value)}
            className="rounded-sm border border-default bg-surface-base px-2 py-1 text-sm text-ink-primary"
          >
            <option value="">All criticality</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
        </label>
      </div>

      {sortedRows.length === 0 ? (
        <div className="rounded-md border border-default bg-surface-raised p-6 text-sm text-ink-muted">
          {filtersActive
            ? 'No objectives match these filters. Clear the standard or criticality filter.'
            : 'No certification objectives for this project. Define objectives in the Certification module, then link requirements to them.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-default">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-default bg-surface-inset">
                <SortableTh
                  label="Objective"
                  sortKey="objId"
                  activeKey={sortKey}
                  direction={sortDir}
                  onSort={handleSort}
                />
                <SortableTh
                  label="Standard"
                  sortKey="standard"
                  activeKey={sortKey}
                  direction={sortDir}
                  onSort={handleSort}
                />
                <th scope="col" className="px-3 py-2 text-left text-xs font-semibold text-ink-muted">
                  Title
                </th>
                <SortableTh
                  label="Criticality"
                  sortKey="criticality"
                  activeKey={sortKey}
                  direction={sortDir}
                  onSort={handleSort}
                />
                <SortableTh
                  label="State"
                  sortKey="completionState"
                  activeKey={sortKey}
                  direction={sortDir}
                  onSort={handleSort}
                />
                <SortableTh
                  label="Reqs"
                  sortKey="requirementsLinked"
                  activeKey={sortKey}
                  direction={sortDir}
                  onSort={handleSort}
                  align="right"
                />
                <th scope="col" className="px-3 py-2 text-right text-xs font-semibold text-ink-muted">
                  Coverage
                </th>
              </tr>
            </thead>
            <tbody onKeyDown={onTableKeyDown}>
              {sortedRows.map((row, i) => (
                <tr
                  key={row.id}
                  ref={(el) => {
                    rowRefs.current[i] = el
                  }}
                  tabIndex={0}
                  onClick={() => openObjective(row)}
                  onFocus={() => setFocusedRow(i)}
                  className="cursor-pointer border-b border-default last:border-b-0 hover:bg-surface-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong"
                >
                  <td className="px-3 py-2 font-mono text-xs text-ink-primary">{row.objId}</td>
                  <td className="px-3 py-2 font-mono text-xs text-ink-muted">{row.regRef}</td>
                  <td className="px-3 py-2 text-ink-primary">{row.title}</td>
                  <td className="px-3 py-2 text-ink-muted">{row.criticality}</td>
                  <td className="px-3 py-2">
                    <StatePill state={row.completionState} />
                  </td>
                  <td className="px-3 py-2 text-right text-ink-primary">
                    {row.requirementsLinked}
                    {row.requirementsLinked > 0 && (
                      <span className="ml-1 text-xs text-ink-muted">
                        {row.requirementsApproved}/{row.requirementsLinked} approved
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-ink-muted">
                    <span className="text-ink-primary">
                      {row.verificationsPassed}/{row.verificationsPlanned}
                    </span>{' '}
                    passed · {row.evidenceCount} evidence
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
