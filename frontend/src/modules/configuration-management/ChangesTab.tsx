import { useState, useMemo } from 'react'
import { Plus, Filter, ChevronDown, ChevronUp, MoreHorizontal } from 'lucide-react'
import clsx from 'clsx'
import { useCMStore } from './store'
import type { ChangeRequest } from './types'
import { CR_PRIORITIES, CR_STATUSES, getCRStatusColor, getCRPriorityColor } from './constants'
import CRDetailDrawer from './CRDetailDrawer'
import CreateCRModal from './CreateCRModal'

interface ChangesTabProps {
  globalSearch?: string
  onOpenCreateCR?: () => void
}

export default function ChangesTab({
  globalSearch = '',
  onOpenCreateCR,
}: ChangesTabProps) {
  const { state, dispatch } = useCMStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [priorityFilter, setPriorityFilter] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set())
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [selectedCR, setSelectedCR] = useState<ChangeRequest | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const query = globalSearch || searchQuery
  const filtered = useMemo(() => {
    return state.changeRequests.filter((r) => {
      if (query) {
        const q = query.toLowerCase()
        if (!r.crId.toLowerCase().includes(q) && !r.title.toLowerCase().includes(q)) return false
      }
      if (priorityFilter.size > 0 && !priorityFilter.has(r.priority)) return false
      if (statusFilter.size > 0 && !statusFilter.has(r.status)) return false
      return true
    })
  }, [state.changeRequests, query, priorityFilter, statusFilter])

  const togglePriority = (p: string) => {
    setPriorityFilter((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
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

  const handleCreate = (cr: ChangeRequest) => {
    dispatch({ type: 'ADD_CR', payload: cr })
    setCreateOpen(false)
  }
  const handleApprove = (crId: string) => {
    dispatch({ type: 'APPROVE_CR', payload: { crId, decisionBy: state.currentRole } })
  }
  const handleReject = (crId: string) => {
    dispatch({ type: 'REJECT_CR', payload: { crId, decisionBy: state.currentRole } })
  }
  const handleApplyVersions = (crId: string) => {
    dispatch({ type: 'APPLY_CR_VERSIONS', payload: crId })
  }

  const openCreate = () => {
    if (onOpenCreateCR) onOpenCreateCR()
    else setCreateOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <input
          type="text"
          placeholder="Search change requests…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 min-w-[200px] max-w-sm px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
        />
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
        >
          <Plus size={16} />
          Create Change Request
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                Priority
              </label>
              <div className="flex flex-wrap gap-2">
                {CR_PRIORITIES.map((p) => (
                  <label key={p} className="flex items-center gap-1 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={priorityFilter.has(p)}
                      onChange={() => togglePriority(p)}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                    />
                    {p}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                Status
              </label>
              <div className="flex flex-wrap gap-2">
                {CR_STATUSES.map((s) => (
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
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  CR ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Title
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Priority
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  CCB Level
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Safety
                </th>
                <th className="w-10 px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    No change requests match. Create one to get started.
                  </td>
                </tr>
              ) : (
                filtered.map((cr) => (
                  <tr
                    key={cr.crId}
                    onClick={() => setSelectedCR(cr)}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-4 py-2 font-mono text-sm text-gray-900 dark:text-white">
                      {cr.crId}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{cr.title}</td>
                    <td className="px-4 py-2">
                      <span
                        className={clsx(
                          'px-2 py-0.5 rounded text-xs font-medium',
                          getCRPriorityColor(cr.priority)
                        )}
                      >
                        {cr.priority}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={clsx(
                          'px-2 py-0.5 rounded text-xs font-medium',
                          getCRStatusColor(cr.status)
                        )}
                      >
                        {cr.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                      {cr.ccbLevel}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                      {cr.safetyImpact ? 'Yes' : 'No'}
                    </td>
                    <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setSelectedCR(cr)}
                        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
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
        cr={selectedCR}
        isOpen={!!selectedCR}
        onClose={() => setSelectedCR(null)}
        onApprove={handleApprove}
        onReject={handleReject}
        onApplyVersions={handleApplyVersions}
      />
      <CreateCRModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />
    </div>
  )
}
