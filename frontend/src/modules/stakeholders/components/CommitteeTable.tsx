import { useState, useMemo } from 'react'
import { Filter, ChevronDown, ChevronUp, Plus } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { listCommittees, type Committee } from '../../../services/stakeholders.service'

const COMMITTEE_KINDS = ['CCB', 'ReviewBoard', 'AuthorityInterface', 'SupplierPanel', 'ProgramGovernance']

interface CommitteeTableProps {
  projectId: string
  onSelectCommittee: (c: Committee) => void
  onCreateCommittee?: () => void
  canEdit?: boolean
}

/**
 * NX-8 (#463): Committees list. React Query-backed (`['committees', projectId]`)
 * against /projects/:projectId/committees. design-system.md §6.2 list
 * primitive; §2.4 progressive-disclosure kind filter. Tokens only.
 */
export default function CommitteeTable({
  projectId,
  onSelectCommittee,
  onCreateCommittee,
  canEdit,
}: CommitteeTableProps) {
  const [kindFilter, setKindFilter] = useState<Set<string>>(new Set())
  const [filtersExpanded, setFiltersExpanded] = useState(false)

  const { data: committees = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['committees', projectId],
    queryFn: () => listCommittees(projectId),
    enabled: !!projectId,
  })

  const filtered = useMemo(() => {
    if (kindFilter.size === 0) return committees
    return committees.filter((c) => kindFilter.has(c.kind))
  }, [committees, kindFilter])

  const toggleKind = (t: string) => {
    setKindFilter((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => setFiltersExpanded((x) => !x)}
          className="flex items-center gap-2 px-3 py-2 border border-default rounded-sm text-sm text-ink-primary hover:bg-surface-raised"
        >
          <Filter size={14} />
          Filters
          {filtersExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {canEdit && onCreateCommittee && (
          <button
            type="button"
            onClick={onCreateCommittee}
            className="flex items-center gap-2 px-4 py-2 bg-accent-primary hover:bg-accent-primary-hover text-white rounded-sm text-sm"
          >
            <Plus size={14} />
            Create committee
          </button>
        )}
      </div>
      {filtersExpanded && (
        <div className="p-4 bg-surface-raised border border-default rounded-md flex flex-wrap gap-3">
          {COMMITTEE_KINDS.map((t) => (
            <label key={t} className="flex items-center gap-2 text-sm text-ink-primary">
              <input
                type="checkbox"
                checked={kindFilter.has(t)}
                onChange={() => toggleKind(t)}
                className="rounded-sm border-default"
              />
              {t}
            </label>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="border border-default rounded-md p-8 text-sm text-ink-muted">
          Loading committees…
        </div>
      ) : isError ? (
        <div className="border border-default rounded-md p-8 text-sm text-status-danger">
          Could not load committees — retry, or check your connection.{' '}
          <button type="button" onClick={() => refetch()} className="underline text-accent-primary">
            Retry
          </button>
        </div>
      ) : committees.length === 0 ? (
        <div className="border border-default rounded-md p-8 text-center">
          <p className="text-sm text-ink-muted">
            No committees. Add a CCB, review board, or authority interface group to route baseline
            and sign-off approvals through named members.
          </p>
          {canEdit && onCreateCommittee && (
            <button
              type="button"
              onClick={onCreateCommittee}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-accent-primary hover:bg-accent-primary-hover text-white rounded-sm text-sm"
            >
              <Plus size={14} />
              Create committee
            </button>
          )}
        </div>
      ) : (
        <div className="bg-surface-base border border-default rounded-md overflow-hidden">
          <table className="w-full text-sm text-ink-primary">
            <thead className="bg-surface-raised">
              <tr>
                <th className="px-4 py-2 text-left text-ink-muted font-medium">ID</th>
                <th className="px-4 py-2 text-left text-ink-muted font-medium">Name</th>
                <th className="px-4 py-2 text-left text-ink-muted font-medium">Kind</th>
                <th className="px-4 py-2 text-left text-ink-muted font-medium">Members</th>
                <th className="px-4 py-2 text-left text-ink-muted font-medium">Default reviewers</th>
                <th className="px-4 py-2 text-left text-ink-muted font-medium">Cadence</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-ink-muted">
                    No committees match the filters.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => onSelectCommittee(c)}
                    className="cursor-pointer border-t border-default hover:bg-surface-raised"
                  >
                    <td className="px-4 py-2 font-mono text-xs text-ink-muted">{c.id.slice(0, 8)}</td>
                    <td className="px-4 py-2 font-medium text-ink-primary">{c.name}</td>
                    <td className="px-4 py-2 text-ink-primary">{c.kind}</td>
                    <td className="px-4 py-2 text-ink-primary">{c.members.length}</td>
                    <td className="px-4 py-2 text-ink-muted">
                      {c.defaultReviewers.length > 0
                        ? c.defaultReviewers.map((r) => r.baselineKind).join(', ')
                        : '—'}
                    </td>
                    <td className="px-4 py-2 text-ink-muted">{c.meetingFrequency || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
