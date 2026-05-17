// NX-3 (#443) — Changes (CCB) tab. Backed by the real change-request API plus
// the new CCB-decision API via React Query. The CCB decision ceremony is a
// single drawer action: reauth -> write CcbDecision + bump impacted-CI
// versions, one transaction (the standalone "Apply Version Updates" affordance
// is removed).
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Filter, ChevronDown, ChevronUp, MoreHorizontal } from 'lucide-react'
import clsx from 'clsx'
import type { ChangeRequest } from 'shared/types/engineering.types'
import { changeRequestService } from '../../services/changeRequest.service'
import { ccbDecisionService, type CcbDecision } from '../../services/ccbDecision.service'
import { getCRStatusColor } from './constants'
import CRDetailDrawer from './CRDetailDrawer'
import CreateCRModal from './CreateCRModal'

interface ChangesTabProps {
  projectId: string
  globalSearch?: string
}

const CR_STATUSES = ['pending', 'in-review', 'approved', 'rejected'] as const
const CR_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const

export default function ChangesTab({ projectId, globalSearch = '' }: ChangesTabProps) {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set())
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [selectedCR, setSelectedCR] = useState<ChangeRequest | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const crKey = ['cm', 'change-requests', projectId]
  const decisionsKey = ['cm', 'ccb-decisions', projectId]

  const { data: crData, isLoading, isError, refetch } = useQuery({
    queryKey: crKey,
    queryFn: async () => (await changeRequestService.getChangeRequests(projectId)).data ?? [],
    enabled: !!projectId,
  })
  const { data: decisionData } = useQuery({
    queryKey: decisionsKey,
    queryFn: async () => (await ccbDecisionService.list(projectId)).data ?? [],
    enabled: !!projectId,
  })
  const changeRequests = useMemo(() => crData ?? [], [crData])
  const decisions = useMemo(() => decisionData ?? [], [decisionData])

  const decisionsByCr = useMemo(() => {
    const map = new Map<string, CcbDecision[]>()
    for (const d of decisions) {
      const arr = map.get(d.changeRequestId) ?? []
      arr.push(d)
      map.set(d.changeRequestId, arr)
    }
    return map
  }, [decisions])

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: crKey })
    queryClient.invalidateQueries({ queryKey: decisionsKey })
    queryClient.invalidateQueries({ queryKey: ['cm', 'config-items', projectId] })
  }

  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof changeRequestService.createChangeRequest>[1]) =>
      changeRequestService.createChangeRequest(projectId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crKey })
      setCreateOpen(false)
    },
  })

  const query = globalSearch || searchQuery
  const filtered = useMemo(() => {
    return changeRequests.filter((r) => {
      if (query) {
        const q = query.toLowerCase()
        if (
          !(r.crId ?? '').toLowerCase().includes(q) &&
          !r.title.toLowerCase().includes(q)
        )
          return false
      }
      if (priorityFilter.size > 0 && !priorityFilter.has(r.priority)) return false
      if (statusFilter.size > 0 && !statusFilter.has(r.status)) return false
      return true
    })
  }, [changeRequests, query, priorityFilter, statusFilter])

  const toggleFilter = (set: Set<string>, value: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    setter(next)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <input
          type="text"
          placeholder="Search change requests..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="min-w-[200px] max-w-sm flex-1 rounded-sm border border-default bg-surface-base px-3 py-2 text-sm text-ink-primary"
        />
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 rounded-sm bg-accent-primary px-4 py-2 text-sm text-white hover:bg-accent-primary-hover"
        >
          <Plus size={16} />
          Create Change Request
        </button>
        <button
          type="button"
          onClick={() => setFiltersExpanded((e) => !e)}
          className="flex items-center gap-2 rounded-sm border border-default px-4 py-2 text-sm text-ink-primary"
        >
          <Filter size={16} />
          Filters
          {filtersExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {filtersExpanded && (
        <div className="rounded-md border border-default bg-surface-raised p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <span className="mb-2 block text-xs font-medium text-ink-muted">Priority</span>
              <div className="flex flex-wrap gap-2">
                {CR_PRIORITIES.map((p) => (
                  <label key={p} className="flex cursor-pointer items-center gap-1 text-sm capitalize text-ink-primary">
                    <input
                      type="checkbox"
                      checked={priorityFilter.has(p)}
                      onChange={() => toggleFilter(priorityFilter, p, setPriorityFilter)}
                      className="rounded border-default accent-accent-primary"
                    />
                    {p}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <span className="mb-2 block text-xs font-medium text-ink-muted">Status</span>
              <div className="flex flex-wrap gap-2">
                {CR_STATUSES.map((s) => (
                  <label key={s} className="flex cursor-pointer items-center gap-1 text-sm capitalize text-ink-primary">
                    <input
                      type="checkbox"
                      checked={statusFilter.has(s)}
                      onChange={() => toggleFilter(statusFilter, s, setStatusFilter)}
                      className="rounded border-default accent-accent-primary"
                    />
                    {s}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-md border border-default bg-surface-raised">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-default bg-surface-inset">
              <tr>
                {['CR ID', 'Title', 'Priority', 'Status', 'CCB decisions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase text-ink-muted">
                    {h}
                  </th>
                ))}
                <th className="w-10 px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-ink-muted">
                    Loading change requests...
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-ink-muted">
                    Couldn&apos;t load change requests.{' '}
                    <button type="button" onClick={() => refetch()} className="text-accent-primary underline">
                      Retry
                    </button>
                    .
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-ink-muted">
                    No change requests. Raise one to route a configuration change through the CCB.
                  </td>
                </tr>
              ) : (
                filtered.map((cr) => (
                  <tr
                    key={cr.id}
                    onClick={() => setSelectedCR(cr)}
                    className="cursor-pointer hover:bg-surface-inset"
                  >
                    <td className="px-4 py-2 font-mono text-sm text-ink-primary">{cr.crId ?? '—'}</td>
                    <td className="px-4 py-2 text-sm text-ink-primary">{cr.title}</td>
                    <td className="px-4 py-2 text-sm capitalize text-ink-muted">{cr.priority}</td>
                    <td className="px-4 py-2">
                      <span
                        className={clsx(
                          'rounded-xs px-2 py-0.5 text-xs font-medium capitalize',
                          getCRStatusColor(
                            cr.status === 'in-review'
                              ? 'UnderReview'
                              : cr.status.charAt(0).toUpperCase() + cr.status.slice(1),
                          ),
                        )}
                      >
                        {cr.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-ink-muted">
                      {decisionsByCr.get(cr.id)?.length ?? 0}
                    </td>
                    <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        title="Row actions"
                        aria-label="Row actions"
                        onClick={() => setSelectedCR(cr)}
                        className="rounded p-1 hover:bg-surface-inset"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CRDetailDrawer
        projectId={projectId}
        cr={selectedCR}
        decisions={selectedCR ? (decisionsByCr.get(selectedCR.id) ?? []) : []}
        isOpen={!!selectedCR}
        onClose={() => setSelectedCR(null)}
        onCeremonyComplete={invalidateAll}
      />
      <CreateCRModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        submitting={createMutation.isPending}
        onCreate={async (payload) => {
          await createMutation.mutateAsync(payload)
        }}
      />
    </div>
  )
}
