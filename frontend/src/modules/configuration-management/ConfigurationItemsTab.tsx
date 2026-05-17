// NX-3 (#443) — Configuration Items tab. Backed by the real configItem API
// via React Query (no longer the CM store). Canonical list view (design-system
// §6.2): mono CI-key column, name, status pill, owner, updated timestamp.
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Filter, ChevronDown, ChevronUp, Plus, MoreHorizontal, Shield } from 'lucide-react'
import clsx from 'clsx'
import {
  configItemService,
  CI_TYPES,
  CI_STATUSES,
  type ConfigItem,
} from '../../services/configItem.service'
import { getCIStatusColor } from './constants'
import CIDetailDrawer from './CIDetailDrawer'
import CreateCIModal from './CreateCIModal'
import DeleteConfirmationModal from '../../components/projects/DeleteConfirmationModal'

const PAGE_SIZE = 25

interface ConfigurationItemsTabProps {
  projectId: string
  globalSearch?: string
}

export default function ConfigurationItemsTab({
  projectId,
  globalSearch = '',
}: ConfigurationItemsTabProps) {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set())
  const [ownerFilter, setOwnerFilter] = useState<Set<string>>(new Set())
  const [safetyOnly, setSafetyOnly] = useState(false)
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [selectedCI, setSelectedCI] = useState<ConfigItem | null>(null)
  const [sortKey, setSortKey] = useState<'ciKey' | 'name' | 'type' | 'status' | 'ownerName' | 'updatedAt'>('ciKey')
  const [sortAsc, setSortAsc] = useState(true)
  const [page, setPage] = useState(0)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ConfigItem | null>(null)
  const [rowMenuId, setRowMenuId] = useState<string | null>(null)

  const queryKey = ['cm', 'config-items', projectId]
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await configItemService.list(projectId)
      return res.data ?? []
    },
    enabled: !!projectId,
  })
  const items = useMemo(() => data ?? [], [data])

  const invalidate = () => queryClient.invalidateQueries({ queryKey })

  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof configItemService.create>[1]) =>
      configItemService.create(projectId, payload),
    onSuccess: invalidate,
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => configItemService.remove(projectId, id),
    onSuccess: () => {
      invalidate()
      setSelectedCI((curr) => (curr?.id === deleteTarget?.id ? null : curr))
      setDeleteTarget(null)
    },
  })

  const query = globalSearch || searchQuery
  const owners = useMemo(
    () => Array.from(new Set(items.map((c) => c.ownerName).filter((o): o is string => !!o))),
    [items],
  )

  const filtered = useMemo(() => {
    let list = items.filter((c) => {
      if (query) {
        const q = query.toLowerCase()
        if (
          !c.ciKey.toLowerCase().includes(q) &&
          !c.name.toLowerCase().includes(q) &&
          !(c.ownerName ?? '').toLowerCase().includes(q)
        )
          return false
      }
      if (typeFilter.size > 0 && !typeFilter.has(c.type)) return false
      if (statusFilter.size > 0 && !statusFilter.has(c.status)) return false
      if (ownerFilter.size > 0 && !ownerFilter.has(c.ownerName ?? '')) return false
      if (safetyOnly && !c.safetyCritical) return false
      return true
    })
    list = [...list].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'ciKey':
          cmp = a.ciKey.localeCompare(b.ciKey)
          break
        case 'name':
          cmp = a.name.localeCompare(b.name)
          break
        case 'type':
          cmp = a.type.localeCompare(b.type)
          break
        case 'status':
          cmp = a.status.localeCompare(b.status)
          break
        case 'ownerName':
          cmp = (a.ownerName ?? '').localeCompare(b.ownerName ?? '')
          break
        case 'updatedAt':
          cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
          break
        default:
          return 0
      }
      return sortAsc ? cmp : -cmp
    })
    return list
  }, [items, query, typeFilter, statusFilter, ownerFilter, safetyOnly, sortKey, sortAsc])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = useMemo(
    () => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [filtered, page],
  )

  const toggleSort = (key: typeof sortKey) => {
    setSortKey(key)
    setSortAsc((prev) => (sortKey === key ? !prev : true))
  }
  const toggleFilter = (set: Set<string>, value: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    setter(next)
  }

  const columns: { key: typeof sortKey; label: string }[] = [
    { key: 'ciKey', label: 'CI ID' },
    { key: 'name', label: 'Name' },
    { key: 'type', label: 'Type' },
    { key: 'status', label: 'Status' },
    { key: 'ownerName', label: 'Owner' },
    { key: 'updatedAt', label: 'Updated' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" size={18} />
          <input
            type="text"
            placeholder="Search configuration items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-sm border border-default bg-surface-base py-2 pl-10 text-sm text-ink-primary"
          />
        </div>
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-2 rounded-sm bg-accent-primary px-4 py-2 text-sm text-white hover:bg-accent-primary-hover"
        >
          <Plus size={16} />
          Create CI
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <span className="mb-2 block text-xs font-medium text-ink-muted">Type</span>
              <div className="flex flex-wrap gap-2">
                {CI_TYPES.slice(0, 6).map((t) => (
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
                {CI_STATUSES.map((s) => (
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
              <span className="mb-2 block text-xs font-medium text-ink-muted">Owner</span>
              <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto">
                {owners.map((o) => (
                  <label key={o} className="flex cursor-pointer items-center gap-1 text-sm text-ink-primary">
                    <input
                      type="checkbox"
                      checked={ownerFilter.has(o)}
                      onChange={() => toggleFilter(ownerFilter, o, setOwnerFilter)}
                      className="rounded border-default accent-accent-primary"
                    />
                    {o}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-primary">
                <input
                  type="checkbox"
                  checked={safetyOnly}
                  onChange={(e) => setSafetyOnly(e.target.checked)}
                  className="rounded border-default accent-accent-primary"
                />
                Safety-critical only
              </label>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-md border border-default bg-surface-raised">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-default bg-surface-inset">
              <tr>
                {columns.map((col) => (
                  <th key={col.key} className="px-4 py-3 text-left text-xs font-medium uppercase text-ink-muted">
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="flex items-center gap-1 hover:text-ink-primary"
                    >
                      {col.label}
                      {sortKey === col.key && (sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                    </button>
                  </th>
                ))}
                <th className="w-10 px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-default)]">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-ink-muted">
                    Loading configuration items...
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-ink-muted">
                    Couldn&apos;t load configuration items.{' '}
                    <button type="button" onClick={() => refetch()} className="text-accent-primary underline">
                      Retry
                    </button>
                    , or check the project is selected.
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-ink-muted">
                    No configuration items. Create one, or import an existing baseline&apos;s CI set.
                  </td>
                </tr>
              ) : (
                paginated.map((ci) => (
                  <tr
                    key={ci.id}
                    onClick={() => setSelectedCI(ci)}
                    className="cursor-pointer hover:bg-surface-inset"
                  >
                    <td className="px-4 py-2 font-mono text-sm text-ink-primary">
                      {ci.ciKey}
                      {ci.safetyCritical && (
                        <span title="Safety-critical">
                          <Shield size={14} className="ml-1 inline text-status-warning" />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-ink-primary">{ci.name}</td>
                    <td className="px-4 py-2 text-sm text-ink-muted">{ci.type}</td>
                    <td className="px-4 py-2">
                      <span
                        className={clsx(
                          'rounded-xs px-2 py-0.5 text-xs font-medium',
                          getCIStatusColor(ci.status),
                        )}
                      >
                        {ci.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-ink-muted">{ci.ownerName ?? '—'}</td>
                    <td className="px-4 py-2 text-sm text-ink-faint">
                      {new Date(ci.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="relative px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        title="Row actions"
                        aria-label="Row actions"
                        onClick={() => setRowMenuId(rowMenuId === ci.id ? null : ci.id)}
                        className="rounded p-1 hover:bg-surface-inset"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                      {rowMenuId === ci.id && (
                        <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-md border border-default bg-surface-raised py-1 shadow-md">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCI(ci)
                              setRowMenuId(null)
                            }}
                            className="w-full px-3 py-1.5 text-left text-sm text-ink-primary hover:bg-surface-inset"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteTarget(ci)
                              setRowMenuId(null)
                            }}
                            className="w-full px-3 py-1.5 text-left text-sm text-status-danger hover:bg-surface-inset"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-default px-4 py-2 text-sm text-ink-muted">
            <span>
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of{' '}
              {filtered.length}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded-sm border border-default px-2 py-1 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="rounded-sm border border-default px-2 py-1 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <CIDetailDrawer
        projectId={projectId}
        ci={selectedCI}
        isOpen={!!selectedCI}
        onClose={() => setSelectedCI(null)}
        onChanged={(updated) => {
          invalidate()
          setSelectedCI(updated)
        }}
        onDelete={() => selectedCI && setDeleteTarget(selectedCI)}
      />
      <CreateCIModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        submitting={createMutation.isPending}
        onCreate={async (payload) => {
          await createMutation.mutateAsync(payload)
          setIsCreateOpen(false)
        }}
      />
      <DeleteConfirmationModal
        isOpen={!!deleteTarget}
        itemName={deleteTarget?.name}
        itemType="configuration item"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
