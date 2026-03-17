import { useState, useMemo } from 'react'
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Plus,
  MoreHorizontal,
  Shield,
} from 'lucide-react'
import clsx from 'clsx'
import { useCMStore } from './store'
import type { ConfigurationItem } from './types'
import { CI_TYPES, CI_STATUSES, getCIStatusColor } from './constants'
import CIDetailDrawer from './CIDetailDrawer'
import CreateCIModal from './CreateCIModal'
import DeleteConfirmationModal from '../../components/projects/DeleteConfirmationModal'

const PAGE_SIZE = 25

interface ConfigurationItemsTabProps {
  globalSearch?: string
  onOpenCreateCI?: () => void
}

export default function ConfigurationItemsTab({
  globalSearch = '',
  onOpenCreateCI,
}: ConfigurationItemsTabProps) {
  const { state, dispatch } = useCMStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set())
  const [ownerFilter, setOwnerFilter] = useState<Set<string>>(new Set())
  const [safetyOnly, setSafetyOnly] = useState(false)
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [selectedCI, setSelectedCI] = useState<ConfigurationItem | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<'ciId' | 'name' | 'type' | 'status' | 'owner' | 'lastModified'>('ciId')
  const [sortAsc, setSortAsc] = useState(true)
  const [page, setPage] = useState(0)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ConfigurationItem | null>(null)
  const [rowMenuId, setRowMenuId] = useState<string | null>(null)

  const query = globalSearch || searchQuery
  const owners = useMemo(
    () => Array.from(new Set(state.configurationItems.map((c) => c.owner).filter(Boolean))),
    [state.configurationItems]
  )

  const filtered = useMemo(() => {
    let list = state.configurationItems.filter((c) => {
      if (query) {
        const q = query.toLowerCase()
        if (
          !c.ciId.toLowerCase().includes(q) &&
          !c.name.toLowerCase().includes(q) &&
          !c.owner.toLowerCase().includes(q)
        )
          return false
      }
      if (typeFilter.size > 0 && !typeFilter.has(c.type)) return false
      if (statusFilter.size > 0 && !statusFilter.has(c.status)) return false
      if (ownerFilter.size > 0 && !ownerFilter.has(c.owner)) return false
      if (safetyOnly && !c.safetyCritical) return false
      return true
    })
    list = [...list].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'ciId':
          cmp = a.ciId.localeCompare(b.ciId)
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
        case 'owner':
          cmp = a.owner.localeCompare(b.owner)
          break
        case 'lastModified':
          cmp = new Date(a.lastModified).getTime() - new Date(b.lastModified).getTime()
          break
        default:
          return 0
      }
      return sortAsc ? cmp : -cmp
    })
    return list
  }, [
    state.configurationItems,
    query,
    typeFilter,
    statusFilter,
    ownerFilter,
    safetyOnly,
    sortKey,
    sortAsc,
  ])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = useMemo(
    () => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [filtered, page]
  )

  const toggleSort = (key: typeof sortKey) => {
    setSortKey(key)
    setSortAsc((prev) => (sortKey === key ? !prev : true))
  }
  const toggleType = (t: string) => {
    setTypeFilter((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }
  const toggleStatus = (s: string) => {
    setStatusFilter((prev) => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }
  const toggleOwner = (o: string) => {
    setOwnerFilter((prev) => {
      const next = new Set(prev)
      if (next.has(o)) next.delete(o)
      else next.add(o)
      return next
    })
  }
  const toggleSelectAll = () => {
    if (selectedIds.size === paginated.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(paginated.map((c) => c.ciId)))
  }
  const toggleSelect = (ciId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(ciId)) next.delete(ciId)
      else next.add(ciId)
      return next
    })
  }

  const handleCreate = (item: ConfigurationItem) => {
    dispatch({ type: 'ADD_CI', payload: item })
    setIsCreateOpen(false)
  }
  const handleUpdate = (item: ConfigurationItem) => {
    dispatch({ type: 'UPDATE_CI', payload: item })
    setSelectedCI((curr) => (curr?.ciId === item.ciId ? item : curr))
  }
  const handleConfirmDelete = () => {
    if (deleteTarget) {
      dispatch({ type: 'DELETE_CI', payload: deleteTarget.ciId })
      setSelectedCI((curr) => (curr?.ciId === deleteTarget.ciId ? null : curr))
      setDeleteTarget(null)
    }
  }

  const openCreate = () => {
    if (onOpenCreateCI) onOpenCreateCI()
    else setIsCreateOpen(true)
  }

  const columns: { key: typeof sortKey; label: string }[] = [
    { key: 'ciId', label: 'CI ID' },
    { key: 'name', label: 'Name' },
    { key: 'type', label: 'Type' },
    { key: 'status', label: 'Status' },
    { key: 'owner', label: 'Owner' },
    { key: 'lastModified', label: 'Last Modified' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search CIs…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          />
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
        >
          <Plus size={16} />
          Create CI
        </button>
        <button
          type="button"
          onClick={() => setFiltersExpanded((e) => !e)}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300"
        >
          <Filter size={16} />
          Filters
          {filtersExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {filtersExpanded && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                Type
              </label>
              <div className="flex flex-wrap gap-2">
                {CI_TYPES.slice(0, 6).map((t) => (
                  <label key={t} className="flex items-center gap-1 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={typeFilter.has(t)}
                      onChange={() => toggleType(t)}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                    />
                    {t}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                Status
              </label>
              <div className="flex flex-wrap gap-2">
                {CI_STATUSES.map((s) => (
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
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                Owner
              </label>
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                {owners.map((o) => (
                  <label key={o} className="flex items-center gap-1 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={ownerFilter.has(o)}
                      onChange={() => toggleOwner(o)}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                    />
                    {o}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={safetyOnly}
                  onChange={(e) => setSafetyOnly(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                />
                Safety-critical only
              </label>
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
                  <th
                    key={col.key}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase"
                  >
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
                <th className="w-10 px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    No configuration items match. Create one to get started.
                  </td>
                </tr>
              ) : (
                paginated.map((ci) => (
                  <tr
                    key={ci.ciId}
                    onClick={() => setSelectedCI(ci)}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(ci.ciId)}
                        onChange={() => toggleSelect(ci.ciId)}
                        className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                      />
                    </td>
                    <td className="px-4 py-2 font-mono text-sm text-gray-900 dark:text-white">
                      {ci.ciId}
                      {ci.safetyCritical && (
                        <span title="Safety-critical"><Shield size={14} className="inline ml-1 text-amber-500" /></span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{ci.name}</td>
                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{ci.type}</td>
                    <td className="px-4 py-2">
                      <span
                        className={clsx(
                          'px-2 py-0.5 rounded text-xs font-medium',
                          getCIStatusColor(ci.status)
                        )}
                      >
                        {ci.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{ci.owner}</td>
                    <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                      {new Date(ci.lastModified).toLocaleDateString()}
                    </td>
                    <td className="px-2 py-2 relative" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setRowMenuId(rowMenuId === ci.ciId ? null : ci.ciId)}
                        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                      {rowMenuId === ci.ciId && (
                        <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-10">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCI(ci)
                              setRowMenuId(null)
                            }}
                            className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(ci)}
                            className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700"
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
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of{' '}
              {filtered.length}
            </span>
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

      <CIDetailDrawer
        ci={selectedCI}
        isOpen={!!selectedCI}
        onClose={() => setSelectedCI(null)}
        onUpdate={handleUpdate}
        onDelete={() => selectedCI && setDeleteTarget(selectedCI)}
      />
      <CreateCIModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreate={handleCreate}
      />
      <DeleteConfirmationModal
        isOpen={!!deleteTarget}
        itemName={deleteTarget?.name}
        itemType="configuration item"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
