import { useState, useMemo, useEffect } from 'react'
import {
  UserPlus,
  FileDown,
} from 'lucide-react'
import clsx from 'clsx'
import { useQuery } from '@tanstack/react-query'
import * as adminService from '../../../services/admin.service'
import type { StakeholderUser } from '../../../types/admin.types'
import TableSkeleton from './TableSkeleton'

const PAGE_SIZE = 10

type SortKey = 'name' | 'email' | 'company' | 'status'

interface StakeholderTableProps {
  globalSearch?: string
  onSelectStakeholder: (s: StakeholderUser | null) => void
  onShowToast: (msg: string) => void
  onAddToCommittee: (stakeholderIds: string[]) => void
  canEdit: boolean
  roleFilter?: Set<string>
  statusFilter?: Set<string>
  companyFilter?: Set<string>
}

export default function StakeholderTable({
  globalSearch = '',
  onSelectStakeholder,
  onShowToast,
  onAddToCommittee,
  canEdit,
  roleFilter = new Set(),
  statusFilter = new Set(),
  companyFilter = new Set(),
}: StakeholderTableProps) {
  const { data: users = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'usersWithRoles'],
    queryFn: () => adminService.getUsersWithRoles(),
    refetchOnWindowFocus: true,
  })

  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortAsc, setSortAsc] = useState(true)
  const [page, setPage] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const effectiveSearch = (globalSearch?.trim() || '').toLowerCase()

  const filtered = useMemo(() => {
    let list = users.filter((u) => {
      if (
        effectiveSearch &&
        !u.name.toLowerCase().includes(effectiveSearch) &&
        !u.email.toLowerCase().includes(effectiveSearch) &&
        !(u.company ?? '').toLowerCase().includes(effectiveSearch)
      )
        return false
      if (roleFilter.size > 0 && !u.engineeringRoles.some((r) => roleFilter.has(r.name)))
        return false
      if (statusFilter.size > 0 && !statusFilter.has(u.status))
        return false
      if (companyFilter.size > 0 && !companyFilter.has(u.company ?? ''))
        return false
      return true
    })
    list = [...list].sort((a, b) => {
      const av = a[sortKey] ?? ''
      const bv = b[sortKey] ?? ''
      return sortAsc
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av))
    })
    return list
  }, [users, effectiveSearch, roleFilter, statusFilter, companyFilter, sortKey, sortAsc])

  // Reset page when filters change
  useEffect(() => { setPage(0) }, [effectiveSearch, roleFilter, statusFilter, companyFilter])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = useMemo(
    () => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [filtered, page]
  )

  const toggleSort = (key: SortKey) => {
    setSortKey(key)
    setSortAsc((prev) => (sortKey === key ? !prev : true))
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === paginated.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(paginated.map((u) => u.id)))
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

  if (isError) {
    return (
      <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6 text-center">
        <p className="text-sm text-red-700 dark:text-red-300 mb-2">
          {error instanceof Error ? error.message : 'Failed to load stakeholder directory.'}
        </p>
        <p className="text-xs text-red-600 dark:text-red-400 mb-3">
          Make sure you are logged in and the backend is running.
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="px-4 py-2 text-sm font-medium text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-4">
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
                    onClick={() => toggleSort('name')}
                    className="font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    Name {sortKey === 'name' && (sortAsc ? '↑' : '↓')}
                  </button>
                </th>
                <th className="px-4 py-2 text-left">
                  <button
                    type="button"
                    onClick={() => toggleSort('email')}
                    className="font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    Email {sortKey === 'email' && (sortAsc ? '↑' : '↓')}
                  </button>
                </th>
                <th className="px-4 py-2 text-left">
                  <button
                    type="button"
                    onClick={() => toggleSort('company')}
                    className="font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    Organization {sortKey === 'company' && (sortAsc ? '↑' : '↓')}
                  </button>
                </th>
                <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Roles</th>
                <th className="px-4 py-2 text-left">
                  <button
                    type="button"
                    onClick={() => toggleSort('status')}
                    className="font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    Status {sortKey === 'status' && (sortAsc ? '↑' : '↓')}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <TableSkeleton rows={6} cols={6} />
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    {users.length === 0
                      ? 'No users found. Add users via the Admin Panel.'
                      : 'No stakeholders match the current filters.'}
                  </td>
                </tr>
              ) : (
                paginated.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => onSelectStakeholder(u)}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-4 py-2 text-gray-900 dark:text-white" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(u.id)}
                        onChange={() => toggleSelect(u.id)}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                    </td>
                    <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">
                      {u.name}
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{u.email}</td>
                    <td className="px-4 py-2 text-gray-900 dark:text-white">{u.company || '—'}</td>
                    <td className="px-4 py-2 text-gray-900 dark:text-white">
                      {u.engineeringRoles.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {u.engineeringRoles.map((r) => (
                            <span
                              key={r.id}
                              className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                            >
                              {r.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500 text-xs">None</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-900 dark:text-white">
                      <span
                        className={clsx(
                          'px-2 py-0.5 rounded text-xs',
                          u.status === 'Active'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        )}
                      >
                        {u.status}
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
