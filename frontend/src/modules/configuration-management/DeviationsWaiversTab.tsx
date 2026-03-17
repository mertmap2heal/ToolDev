import { useState, useMemo } from 'react'
import { Plus, Filter, ChevronDown, ChevronUp, MoreHorizontal, AlertTriangle } from 'lucide-react'
import clsx from 'clsx'
import { useCMStore } from './store'
import type { DeviationWaiver } from './types'
import { DW_TYPES, DW_STATUSES, getDWStatusColor, getRiskLevelColor } from './constants'
import CreateDWModal from './CreateDWModal'
import DWDetailDrawer from './DWDetailDrawer'

interface DeviationsWaiversTabProps {
  onOpenCreateDW?: () => void
}

export default function DeviationsWaiversTab({ onOpenCreateDW }: DeviationsWaiversTabProps) {
  const { state, dispatch } = useCMStore()
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set())
  const [riskFilter, setRiskFilter] = useState<Set<string>>(new Set())
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [selectedDW, setSelectedDW] = useState<DeviationWaiver | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const filtered = useMemo(() => {
    return state.deviationsWaivers.filter((d) => {
      if (typeFilter.size > 0 && !typeFilter.has(d.type)) return false
      if (statusFilter.size > 0 && !statusFilter.has(d.status)) return false
      if (riskFilter.size > 0 && !riskFilter.has(d.riskLevel)) return false
      return true
    })
  }, [state.deviationsWaivers, typeFilter, statusFilter, riskFilter])

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
  const toggleRisk = (r: string) => {
    setRiskFilter((prev) => {
      const next = new Set(prev)
      if (next.has(r)) next.delete(r)
      else next.add(r)
      return next
    })
  }

  const handleCreate = (dw: DeviationWaiver) => {
    dispatch({ type: 'ADD_DW', payload: dw })
    setCreateOpen(false)
  }
  const handleApprove = (dwId: string) => {
    dispatch({ type: 'APPROVE_DW', payload: { dwId } })
  }
  const handleReject = (dwId: string) => {
    dispatch({ type: 'REJECT_DW', payload: { dwId } })
  }

  const openCreate = () => {
    if (onOpenCreateDW) onOpenCreateDW()
    else setCreateOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
        >
          <Plus size={16} />
          Create Deviation / Waiver
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                Type
              </label>
              <div className="flex flex-wrap gap-2">
                {DW_TYPES.map((t) => (
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
                {DW_STATUSES.map((s) => (
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
                Risk level
              </label>
              <div className="flex flex-wrap gap-2">
                {(['Low', 'Medium', 'High'] as const).map((r) => (
                  <label key={r} className="flex items-center gap-1 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={riskFilter.has(r)}
                      onChange={() => toggleRisk(r)}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                    />
                    {r}
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
                  DW ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Title
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Risk
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Authority
                </th>
                <th className="w-10 px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    No deviations or waivers match. Create one to get started.
                  </td>
                </tr>
              ) : (
                filtered.map((d) => (
                  <tr
                    key={d.dwId}
                    onClick={() => setSelectedDW(d)}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-4 py-2 font-mono text-sm text-gray-900 dark:text-white">
                      {d.dwId}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{d.type}</td>
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{d.title}</td>
                    <td className="px-4 py-2">
                      <span
                        className={clsx(
                          'px-2 py-0.5 rounded text-xs font-medium',
                          getRiskLevelColor(d.riskLevel)
                        )}
                      >
                        {d.riskLevel}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={clsx(
                          'px-2 py-0.5 rounded text-xs font-medium',
                          getDWStatusColor(d.status)
                        )}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                      {d.authorityInvolved ? (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
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
                        onClick={() => setSelectedDW(d)}
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

      <DWDetailDrawer
        dw={selectedDW}
        isOpen={!!selectedDW}
        onClose={() => setSelectedDW(null)}
        onApprove={handleApprove}
        onReject={handleReject}
      />
      <CreateDWModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />
    </div>
  )
}
