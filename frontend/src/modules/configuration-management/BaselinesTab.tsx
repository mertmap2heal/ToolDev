import { useState, useMemo } from 'react'
import { Plus, Filter, ChevronDown, ChevronUp, MoreHorizontal, Shield } from 'lucide-react'
import clsx from 'clsx'
import { useCMStore } from './store'
import type { Baseline } from './types'
import { BASELINE_TYPES, BASELINE_PHASES, BASELINE_STATUSES, getBaselineStatusColor } from './constants'
import BaselineDetailDrawer from './BaselineDetailDrawer'
import BaselineWizard from './BaselineWizard'

interface BaselinesTabProps {
  globalSearch?: string
  onOpenCreateBaseline?: () => void
  onNavigateToCompare?: (baselineA: string, baselineB: string) => void
}

export default function BaselinesTab({
  globalSearch = '',
  onOpenCreateBaseline,
  onNavigateToCompare,
}: BaselinesTabProps) {
  const { state, dispatch } = useCMStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set())
  const [phaseFilter, setPhaseFilter] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set())
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [selectedBaseline, setSelectedBaseline] = useState<Baseline | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)
  const [rowMenuId, setRowMenuId] = useState<string | null>(null)

  const query = globalSearch || searchQuery
  const filtered = useMemo(() => {
    return state.baselines.filter((b) => {
      if (query) {
        const q = query.toLowerCase()
        if (!b.baselineId.toLowerCase().includes(q) && !b.name.toLowerCase().includes(q)) return false
      }
      if (typeFilter.size > 0 && !typeFilter.has(b.type)) return false
      if (phaseFilter.size > 0 && !phaseFilter.has(b.phase)) return false
      if (statusFilter.size > 0 && !statusFilter.has(b.status)) return false
      return true
    })
  }, [state.baselines, query, typeFilter, phaseFilter, statusFilter])

  const toggleType = (t: string) => {
    setTypeFilter((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }
  const togglePhase = (p: string) => {
    setPhaseFilter((prev) => {
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

  const handleCreateBaseline = (baseline: Baseline) => {
    dispatch({ type: 'ADD_BASELINE', payload: baseline })
    setWizardOpen(false)
  }
  const handleApprove = (baselineId: string) => {
    dispatch({ type: 'APPROVE_BASELINE', payload: { baselineId, approvedBy: state.currentRole } })
  }
  const handleFreeze = (baselineId: string) => {
    dispatch({ type: 'FREEZE_BASELINE', payload: baselineId })
  }

  const openCreate = () => {
    if (onOpenCreateBaseline) onOpenCreateBaseline()
    else setWizardOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <input
          type="text"
          placeholder="Search baselines…"
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
          Create Baseline
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
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Type</label>
              <div className="flex flex-wrap gap-2">
                {BASELINE_TYPES.map((t) => (
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
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Phase</label>
              <div className="flex flex-wrap gap-2">
                {BASELINE_PHASES.map((p) => (
                  <label key={p} className="flex items-center gap-1 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={phaseFilter.has(p)}
                      onChange={() => togglePhase(p)}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                    />
                    {p}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Status</label>
              <div className="flex flex-wrap gap-2">
                {BASELINE_STATUSES.map((s) => (
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
                  Baseline ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Phase
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  CIs
                </th>
                <th className="w-10 px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    No baselines match. Create one to get started.
                  </td>
                </tr>
              ) : (
                filtered.map((b) => (
                  <tr
                    key={b.baselineId}
                    onClick={() => setSelectedBaseline(b)}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-4 py-2 font-mono text-sm text-gray-900 dark:text-white">
                      {b.baselineId}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{b.name}</td>
                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{b.type}</td>
                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{b.phase}</td>
                    <td className="px-4 py-2">
                      <span
                        className={clsx(
                          'px-2 py-0.5 rounded text-xs font-medium',
                          getBaselineStatusColor(b.status)
                        )}
                      >
                        {b.status}
                      </span>
                      {(b.status === 'Approved' || b.status === 'Frozen') && (
                        <span title="Audit ready"><Shield size={12} className="inline ml-1 text-green-500" /></span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                      {b.ciSnapshot.length}
                    </td>
                    <td className="px-2 py-2 relative" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setRowMenuId(rowMenuId === b.baselineId ? null : b.baselineId)}
                        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                      >
                        <MoreHorizontal size={16} />
                      </button>
                      {rowMenuId === b.baselineId && (
                        <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-10">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBaseline(b)
                              setRowMenuId(null)
                            }}
                            className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            View
                          </button>
                          {b.status === 'Submitted' && (
                            <button
                              type="button"
                              onClick={() => {
                                handleApprove(b.baselineId)
                                setRowMenuId(null)
                              }}
                              className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              Approve
                            </button>
                          )}
                          {b.status === 'Approved' && (
                            <button
                              type="button"
                              onClick={() => {
                                handleFreeze(b.baselineId)
                                setRowMenuId(null)
                              }}
                              className="w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              Freeze
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <BaselineDetailDrawer
        baseline={selectedBaseline}
        isOpen={!!selectedBaseline}
        onClose={() => setSelectedBaseline(null)}
        onNavigateToCompare={onNavigateToCompare}
      />
      <BaselineWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreate={handleCreateBaseline}
      />
    </div>
  )
}
