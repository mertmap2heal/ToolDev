import { useState, useMemo, useEffect } from 'react'
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  FileText,
  Package,
  AlertCircle,
  FileDown,
} from 'lucide-react'
import clsx from 'clsx'
import { useCertificationStore } from '../store'
import { canCreateFinding, canEditObjectiveStatus } from '../certificationPermissions'
import ObjectiveDetailDrawer from '../drawers/ObjectiveDetailDrawer'
import PlaceholderNavigationModal from '../PlaceholderNavigationModal'
import TableSkeleton from '../components/TableSkeleton'
import { updateCertificationObjective } from '../../../services/certification.service'
import { PLACEHOLDER_ROWS_VERIFICATION, PLACEHOLDER_ROWS_CM } from '../mockData'
import type { CertificationObjective } from '../types'

const PAGE_SIZE = 15

interface ObjectivesMoCTabProps {
  globalSearch?: string
  onShowToast?: (message: string) => void
  onOpenCreateFinding?: (linkedObjectiveId?: string) => void
}

export default function ObjectivesMoCTab({
  globalSearch = '',
  onShowToast,
  onOpenCreateFinding,
}: ObjectivesMoCTabProps) {
  const { state, dispatch, refetch } = useCertificationStore()
  const { objectives } = state
  const projectId = state.context.projectId
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set())
  const [mocFilter, setMocFilter] = useState<Set<string>>(new Set())
  const [criticalityFilter, setCriticalityFilter] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<
    'objId' | 'regRef' | 'title' | 'moc' | 'status' | 'criticality' | 'linkedEvidenceCount'
  >('objId')
  const [sortAsc, setSortAsc] = useState(true)
  const [page, setPage] = useState(0)
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [selectedObjective, setSelectedObjective] = useState<CertificationObjective | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [placeholderEvidenceOpen, setPlaceholderEvidenceOpen] = useState(false)
  const [placeholderCIsOpen, setPlaceholderCIsOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 800)
    return () => clearTimeout(t)
  }, [])

  const effectiveQuery = (globalSearch?.trim() || searchQuery.trim()).toLowerCase()
  const filtered = useMemo(() => {
    let list = objectives.filter((o) => {
      if (effectiveQuery && !o.objId.toLowerCase().includes(effectiveQuery) && !o.regRef.toLowerCase().includes(effectiveQuery) && !o.title.toLowerCase().includes(effectiveQuery))
        return false
      if (statusFilter.size > 0 && !statusFilter.has(o.status)) return false
      if (mocFilter.size > 0 && !mocFilter.has(o.moc)) return false
      if (criticalityFilter.size > 0 && !criticalityFilter.has(o.criticality)) return false
      return true
    })
    list = [...list].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'objId':
          cmp = a.objId.localeCompare(b.objId)
          break
        case 'regRef':
          cmp = a.regRef.localeCompare(b.regRef)
          break
        case 'title':
          cmp = a.title.localeCompare(b.title)
          break
        case 'moc':
          cmp = a.moc.localeCompare(b.moc)
          break
        case 'status':
          cmp = a.status.localeCompare(b.status)
          break
        case 'criticality':
          cmp = a.criticality.localeCompare(b.criticality)
          break
        case 'linkedEvidenceCount':
          cmp = a.linkedEvidenceCount - b.linkedEvidenceCount
          break
        default:
          return 0
      }
      return sortAsc ? cmp : -cmp
    })
    return list
  }, [objectives, effectiveQuery, statusFilter, mocFilter, criticalityFilter, sortKey, sortAsc])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = useMemo(
    () => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [filtered, page]
  )

  const toggleSort = (key: typeof sortKey) => {
    setSortKey(key)
    setSortAsc((prev) => (sortKey === key ? !prev : true))
  }
  const toggleStatus = (s: string) => {
    setStatusFilter((prev) => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }
  const toggleMoc = (m: string) => {
    setMocFilter((prev) => {
      const next = new Set(prev)
      if (next.has(m)) next.delete(m)
      else next.add(m)
      return next
    })
  }
  const toggleCriticality = (c: string) => {
    setCriticalityFilter((prev) => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })
  }
  const toggleSelectAll = () => {
    if (selectedIds.size === paginated.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(paginated.map((o) => o.objId)))
  }
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const canEdit = canEditObjectiveStatus(state)
  const canCreate = canCreateFinding(state)

  const handleMarkReviewed = async () => {
    if (selectedIds.size === 0 || !canEdit) return
    const ids = Array.from(selectedIds)
    if (projectId && refetch) {
      const toUpdate = objectives.filter((o) => ids.includes(o.objId) && o.id)
      for (const o of toUpdate) {
        if (o.id) await updateCertificationObjective(projectId, o.id, { reviewed: true })
      }
      await refetch()
      onShowToast?.('Selected objectives marked as reviewed.')
      setSelectedIds(new Set())
    } else {
      dispatch({ type: 'MARK_OBJECTIVES_REVIEWED', payload: ids })
      onShowToast?.('Selected objectives marked as reviewed.')
      setSelectedIds(new Set())
    }
  }

  const hasContext = state.context.selectedBaseline !== null || state.context.selectedRelease !== null
  if (!hasContext) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Select a baseline or release in the context selector above to view certification readiness and data.
        </p>
      </div>
    )
  }

  const statuses = ['Open', 'Partial', 'Complete', 'Blocked'] as const
  const mocs = ['Test', 'Analysis', 'Inspection', 'Similarity', 'Simulation', 'Review'] as const
  const criticalities = ['Low', 'Medium', 'High'] as const

  const columns: { key: typeof sortKey; label: string }[] = [
    { key: 'objId', label: 'Objective ID' },
    { key: 'regRef', label: 'Reg ref' },
    { key: 'title', label: 'Title' },
    { key: 'moc', label: 'MoC' },
    { key: 'status', label: 'Status' },
    { key: 'criticality', label: 'Criticality' },
    { key: 'linkedEvidenceCount', label: 'Evidence' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search objectives…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => setFiltersExpanded((e) => !e)}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300"
        >
          <Filter size={16} />
          Filters
          {filtersExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {selectedIds.size > 0 && (
          <>
            <button
              type="button"
              onClick={handleMarkReviewed}
              disabled={!canEdit}
              title={!canEdit ? (state.readOnlyMode ? 'Read-only mode is on' : 'Not allowed for your role') : undefined}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm"
            >
              Mark selected as Reviewed
            </button>
            <button
              type="button"
              onClick={() => onShowToast?.('Export selected objectives is not implemented yet (placeholder).')}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300"
            >
              <FileDown size={16} />
              Export selected
            </button>
          </>
        )}
      </div>

      {filtersExpanded && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Status</label>
              <div className="flex flex-wrap gap-2">
                {statuses.map((s) => (
                  <label key={s} className="flex items-center gap-1 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={statusFilter.has(s)}
                      onChange={() => toggleStatus(s)}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                    />
                    {s}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">MoC</label>
              <div className="flex flex-wrap gap-2">
                {mocs.map((m) => (
                  <label key={m} className="flex items-center gap-1 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={mocFilter.has(m)}
                      onChange={() => toggleMoc(m)}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                    />
                    {m}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Criticality</label>
              <div className="flex flex-wrap gap-2">
                {criticalities.map((c) => (
                  <label key={c} className="flex items-center gap-1 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={criticalityFilter.has(c)}
                      onChange={() => toggleCriticality(c)}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                    />
                    {c}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="w-10 px-2 py-2">
                  <input
                    type="checkbox"
                    checked={paginated.length > 0 && selectedIds.size === paginated.length}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                  />
                </th>
                {columns.map((col) => (
                  <th key={col.key} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      {col.label}
                      {sortKey === col.key && (sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                    </button>
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <TableSkeleton rows={6} cols={8} />
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    No objectives match filters.
                  </td>
                </tr>
              ) : (
                paginated.map((obj) => (
                  <tr
                    key={obj.objId}
                    onClick={() => {
                      setSelectedObjective(obj)
                      setDrawerOpen(true)
                    }}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(obj.objId)}
                        onChange={() => toggleSelect(obj.objId)}
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                      />
                    </td>
                    <td className="px-4 py-2 font-mono text-sm text-gray-900 dark:text-white">{obj.objId}</td>
                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{obj.regRef}</td>
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 max-w-xs truncate" title={obj.title}>
                      {obj.title}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{obj.moc}</td>
                    <td className="px-4 py-2">
                      <span
                        className={clsx(
                          'px-2 py-0.5 rounded text-xs font-medium',
                          obj.status === 'Complete' && 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
                          obj.status === 'Blocked' && 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
                          obj.status === 'Partial' && 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
                          obj.status === 'Open' && 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        )}
                      >
                        {obj.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{obj.criticality}</td>
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{obj.linkedEvidenceCount}</td>
                    <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedObjective(obj)
                            setPlaceholderEvidenceOpen(true)
                          }}
                          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                          title="View Evidence"
                        >
                          <FileText size={14} className="text-gray-500 dark:text-gray-400" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedObjective(obj)
                            setPlaceholderCIsOpen(true)
                          }}
                          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                          title="View Linked CIs"
                        >
                          <Package size={14} className="text-gray-500 dark:text-gray-400" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            if (canCreate) onOpenCreateFinding?.(obj.objId)
                          }}
                          disabled={!canCreate}
                          title={!canCreate ? (state.readOnlyMode ? 'Read-only mode is on' : 'Not allowed for your role') : 'Create Finding from Objective'}
                          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <AlertCircle size={14} className="text-amber-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>Page {page + 1} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <ObjectiveDetailDrawer
        objective={selectedObjective}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onViewEvidence={() => setPlaceholderEvidenceOpen(true)}
        onViewLinkedCIs={() => setPlaceholderCIsOpen(true)}
        onCreateFinding={() => {
          onOpenCreateFinding?.(selectedObjective?.objId)
        }}
      />

      <PlaceholderNavigationModal
        isOpen={placeholderEvidenceOpen}
        onClose={() => setPlaceholderEvidenceOpen(false)}
        moduleName="Verification"
        filterDescription={selectedObjective?.objId ?? 'objective'}
        rows={PLACEHOLDER_ROWS_VERIFICATION}
        onPlaceholderNavigate={() => onShowToast?.('Navigation not implemented yet.')}
      />
      <PlaceholderNavigationModal
        isOpen={placeholderCIsOpen}
        onClose={() => setPlaceholderCIsOpen(false)}
        moduleName="Configuration Items"
        filterDescription={selectedObjective?.objId ?? 'objective'}
        rows={PLACEHOLDER_ROWS_CM}
        onPlaceholderNavigate={() => onShowToast?.('Navigation not implemented yet.')}
      />
    </div>
  )
}
