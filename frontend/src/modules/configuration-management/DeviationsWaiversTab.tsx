// NX-3 (#443) — Deviations & Waivers tab. Backed by the real deviationWaiver
// API via React Query. The sign-off ceremony (drawer "Sign off" -> reauth ->
// SignatureEvent write) lives in DWDetailDrawer.
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Filter, ChevronDown, ChevronUp, MoreHorizontal, AlertTriangle } from 'lucide-react'
import clsx from 'clsx'
import {
  deviationWaiverService,
  DW_TYPES,
  DW_STATUSES,
  DW_RISK_LEVELS,
  type DeviationWaiver,
} from '../../services/deviationWaiver.service'
import { getDWStatusColor, getRiskLevelColor } from './constants'
import CreateDWModal from './CreateDWModal'
import DWDetailDrawer from './DWDetailDrawer'

interface DeviationsWaiversTabProps {
  projectId: string
}

export default function DeviationsWaiversTab({ projectId }: DeviationsWaiversTabProps) {
  const queryClient = useQueryClient()
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set())
  const [riskFilter, setRiskFilter] = useState<Set<string>>(new Set())
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [selectedDW, setSelectedDW] = useState<DeviationWaiver | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const queryKey = ['cm', 'deviations-waivers', projectId]
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: async () => (await deviationWaiverService.list(projectId)).data ?? [],
    enabled: !!projectId,
  })
  const items = useMemo(() => data ?? [], [data])

  const invalidate = () => queryClient.invalidateQueries({ queryKey })

  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof deviationWaiverService.create>[1]) =>
      deviationWaiverService.create(projectId, payload),
    onSuccess: () => {
      invalidate()
      setCreateOpen(false)
    },
  })

  const filtered = useMemo(() => {
    return items.filter((d) => {
      if (typeFilter.size > 0 && !typeFilter.has(d.type)) return false
      if (statusFilter.size > 0 && !statusFilter.has(d.status)) return false
      if (riskFilter.size > 0 && !riskFilter.has(d.riskLevel)) return false
      return true
    })
  }, [items, typeFilter, statusFilter, riskFilter])

  const toggleFilter = (set: Set<string>, value: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    setter(next)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 rounded-sm bg-accent-primary px-4 py-2 text-sm text-white hover:bg-accent-primary-hover"
        >
          <Plus size={16} />
          Create Deviation / Waiver
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <span className="mb-2 block text-xs font-medium text-ink-muted">Type</span>
              <div className="flex flex-wrap gap-2">
                {DW_TYPES.map((t) => (
                  <label key={t} className="flex cursor-pointer items-center gap-1 text-sm text-ink-primary">
                    <input
                      type="checkbox"
                      checked={typeFilter.has(t)}
                      onChange={() => toggleFilter(typeFilter, t, setTypeFilter)}
                      className="rounded border-default accent-accent-primary"
                    />
                    {t}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <span className="mb-2 block text-xs font-medium text-ink-muted">Status</span>
              <div className="flex flex-wrap gap-2">
                {DW_STATUSES.map((s) => (
                  <label key={s} className="flex cursor-pointer items-center gap-1 text-sm text-ink-primary">
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
            <div>
              <span className="mb-2 block text-xs font-medium text-ink-muted">Risk level</span>
              <div className="flex flex-wrap gap-2">
                {DW_RISK_LEVELS.map((r) => (
                  <label key={r} className="flex cursor-pointer items-center gap-1 text-sm text-ink-primary">
                    <input
                      type="checkbox"
                      checked={riskFilter.has(r)}
                      onChange={() => toggleFilter(riskFilter, r, setRiskFilter)}
                      className="rounded border-default accent-accent-primary"
                    />
                    {r}
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
                {['DW ID', 'Type', 'Title', 'Risk', 'Status', 'Authority'].map((h) => (
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
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-ink-muted">
                    Loading deviations and waivers...
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-ink-muted">
                    Couldn&apos;t load deviations and waivers.{' '}
                    <button type="button" onClick={() => refetch()} className="text-accent-primary underline">
                      Retry
                    </button>
                    .
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-ink-muted">
                    No deviations or waivers. Raise one to authorise a documented departure from a baseline.
                  </td>
                </tr>
              ) : (
                filtered.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => setSelectedDW(d)}
                    className="cursor-pointer hover:bg-surface-inset"
                  >
                    <td className="px-4 py-2 font-mono text-sm text-ink-primary">{d.dwKey}</td>
                    <td className="px-4 py-2 text-sm text-ink-muted">{d.type}</td>
                    <td className="px-4 py-2 text-sm text-ink-primary">{d.title}</td>
                    <td className="px-4 py-2">
                      <span
                        className={clsx(
                          'rounded-xs px-2 py-0.5 text-xs font-medium',
                          getRiskLevelColor(d.riskLevel),
                        )}
                      >
                        {d.riskLevel}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={clsx(
                          'rounded-xs px-2 py-0.5 text-xs font-medium',
                          getDWStatusColor(d.status),
                        )}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-ink-muted">
                      {d.authorityInvolved ? (
                        <span className="inline-flex items-center gap-1 text-status-warning">
                          <AlertTriangle size={14} />
                          Yes
                        </span>
                      ) : (
                        'No'
                      )}
                    </td>
                    <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        title="Row actions"
                        aria-label="Row actions"
                        onClick={() => setSelectedDW(d)}
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

      <DWDetailDrawer
        projectId={projectId}
        dw={selectedDW}
        isOpen={!!selectedDW}
        onClose={() => setSelectedDW(null)}
        onChanged={(updated) => {
          invalidate()
          setSelectedDW(updated)
        }}
      />
      <CreateDWModal
        projectId={projectId}
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
