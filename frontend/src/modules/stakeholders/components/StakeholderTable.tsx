import { useState, useMemo, useEffect } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Filter,
  UserPlus,
  FileDown,
} from 'lucide-react'
import clsx from 'clsx'
import { useStakeholdersStore } from '../store'
import type { Stakeholder } from '../types'
import TableSkeleton from './TableSkeleton'

const PAGE_SIZE = 10

interface StakeholderTableProps {
  globalSearch?: string
  onSelectStakeholder: (s: Stakeholder | null) => void
  onShowToast: (msg: string) => void
  onCreateStakeholder: () => void
  onAddToCommittee: (stakeholderIds: string[]) => void
  canEdit: boolean
}

export default function StakeholderTable({
  globalSearch = '',
  onSelectStakeholder,
  onShowToast,
  onCreateStakeholder,
  onAddToCommittee,
  canEdit,
}: StakeholderTableProps) {
  const { state } = useStakeholdersStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [orgFilter, setOrgFilter] = useState<Set<string>>(new Set())
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set())
  const [disciplineFilter, setDisciplineFilter] = useState<Set<string>>(new Set())
  const [authorityFilter, setAuthorityFilter] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<keyof Stakeholder>('displayName')
  const [sortAsc, setSortAsc] = useState(true)
  const [page, setPage] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setIsLoading(false), 400)
    return () => clearTimeout(t)
  }, [])

  const effectiveSearch = (globalSearch?.trim() || searchQuery.trim()).toLowerCase()

  const filtered = useMemo(() => {
    let list = state.stakeholders.filter((s) => {
      if (
        effectiveSearch &&
        !s.displayName.toLowerCase().includes(effectiveSearch) &&
        !s.organization.toLowerCase().includes(effectiveSearch) &&
        !s.stakeholderId.toLowerCase().includes(effectiveSearch)
      )
        return false
      if (orgFilter.size > 0 && !orgFilter.has(s.organization)) return false
      if (typeFilter.size > 0 && !typeFilter.has(s.stakeholderType)) return false
      if (disciplineFilter.size > 0 && !disciplineFilter.has(s.discipline)) return false
      if (authorityFilter.size > 0 && !authorityFilter.has(s.authorityLevel)) return false
      if (statusFilter.size > 0 && !statusFilter.has(s.status)) return false
      return true
    })
    list = [...list].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (typeof av === 'string' && typeof bv === 'string') return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av)
      if (Array.isArray(av) && Array.isArray(bv)) return sortAsc ? av.length - bv.length : bv.length - av.length
      return 0
    })
    return list
  }, [
    state.stakeholders,
    effectiveSearch,
    orgFilter,
    typeFilter,
    disciplineFilter,
    authorityFilter,
    statusFilter,
    sortKey,
    sortAsc,
  ])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = useMemo(
    () => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [filtered, page]
  )

  const toggleSort = (key: keyof Stakeholder) => {
    setSortKey(key)
    setSortAsc((prev) => (sortKey === key ? !prev : true))
  }

  const toggleFilter = (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    value: string
  ) => {
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === paginated.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(paginated.map((s) => s.stakeholderId)))
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleExportSelected = () => {
    if (selectedIds.size === 0) {
      onShowToast('Select at least one stakeholder to export.')
      return
    }
    onShowToast('Export selected is a placeholder. No file is generated.')
  }

  const orgs = [...new Set(state.stakeholders.map((s) => s.organization))]
  const types = ['Internal', 'Supplier', 'Partner', 'Authority', 'Customer']
  const disciplines = [
    'Systems', 'Safety', 'Verification', 'CM', 'Certification', 'SW', 'HW', 'QA', 'PM', 'Manufacturing',
  ]
  const authorities = ['Viewer', 'Reviewer', 'Approver', 'Owner']
  const statuses = ['Active', 'Inactive']

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <input
            type="text"
            placeholder="Search directory..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => setFiltersExpanded((x) => !x)}
          className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300"
        >
          <Filter size={16} />
          Filters
          {filtersExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {selectedIds.size > 0 && (
          <>
            <button
              type="button"
              onClick={() => onAddToCommittee(Array.from(selectedIds))}
              disabled={!canEdit}
              title={!canEdit ? 'Read-only mode is on or your role cannot edit' : undefined}
              className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 disabled:opacity-50"
            >
              <UserPlus size={16} />
              Add to committee
            </button>
            <button
              type="button"
              onClick={handleExportSelected}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300"
            >
              <FileDown size={16} />
              Export selected
            </button>
          </>
        )}
      </div>

      {filtersExpanded && (
        <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg flex flex-wrap gap-4">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Organization</span>
            {orgs.slice(0, 8).map((o) => (
              <label key={o} className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={orgFilter.has(o)}
                  onChange={() => toggleFilter(setOrgFilter, o)}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                {o}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Type</span>
            {types.map((t) => (
              <label key={t} className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={typeFilter.has(t)}
                  onChange={() => toggleFilter(setTypeFilter, t)}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                {t}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Discipline</span>
            {disciplines.slice(0, 6).map((d) => (
              <label key={d} className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={disciplineFilter.has(d)}
                  onChange={() => toggleFilter(setDisciplineFilter, d)}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                {d}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Authority</span>
            {authorities.map((a) => (
              <label key={a} className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={authorityFilter.has(a)}
                  onChange={() => toggleFilter(setAuthorityFilter, a)}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                {a}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Status</span>
            {statuses.map((s) => (
              <label key={s} className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={statusFilter.has(s)}
                  onChange={() => toggleFilter(setStatusFilter, s)}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                {s}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-gray-900 dark:text-white">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-2 w-10 text-gray-500 dark:text-gray-400">
                  <input
                    type="checkbox"
                    checked={paginated.length > 0 && selectedIds.size === paginated.length}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                </th>
                <th className="px-4 py-2 text-left">
                  <button
                    type="button"
                    onClick={() => toggleSort('stakeholderId')}
                    className="font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    ID {sortKey === 'stakeholderId' && (sortAsc ? '↑' : '↓')}
                  </button>
                </th>
                <th className="px-4 py-2 text-left">
                  <button
                    type="button"
                    onClick={() => toggleSort('displayName')}
                    className="font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    Name {sortKey === 'displayName' && (sortAsc ? '↑' : '↓')}
                  </button>
                </th>
                <th className="px-4 py-2 text-left">
                  <button
                    type="button"
                    onClick={() => toggleSort('organization')}
                    className="font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    Organization {sortKey === 'organization' && (sortAsc ? '↑' : '↓')}
                  </button>
                </th>
                <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Type</th>
                <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Discipline</th>
                <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Authority</th>
                <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <TableSkeleton rows={6} cols={8} />
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    No stakeholders match the filters. Create one or clear filters.
                  </td>
                </tr>
              ) : (
                paginated.map((s) => (
                  <tr
                    key={s.stakeholderId}
                    onClick={() => onSelectStakeholder(s)}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-4 py-2 text-gray-900 dark:text-white" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(s.stakeholderId)}
                        onChange={() => toggleSelect(s.stakeholderId)}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-900 dark:text-white">{s.stakeholderId}</td>
                    <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{s.displayName}</td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{s.organization}</td>
                    <td className="px-4 py-2 text-gray-900 dark:text-white">{s.stakeholderType}</td>
                    <td className="px-4 py-2 text-gray-900 dark:text-white">{s.discipline}</td>
                    <td className="px-4 py-2 text-gray-900 dark:text-white">{s.authorityLevel}</td>
<td className="px-4 py-2 text-gray-900 dark:text-white">
                        <span
                        className={clsx(
                          'px-2 py-0.5 rounded text-xs',
                          s.status === 'Active'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        )}
                      >
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Page {page + 1} of {totalPages} ({filtered.length} total)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
