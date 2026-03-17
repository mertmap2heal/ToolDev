import { useState, useMemo } from 'react'
import { Plus, Filter, ChevronDown, ChevronUp, MoreHorizontal, Shield } from 'lucide-react'
import clsx from 'clsx'
import { useCMStore } from './store'
import type { ReleasePackage } from './types'
import { RELEASE_TARGETS, RELEASE_STATUSES } from './constants'
import ReleaseDetailDrawer from './ReleaseDetailDrawer'
import ReleaseWizard from './ReleaseWizard'

interface ReleasesTabProps {
  onOpenCreateRelease?: () => void
}

function getReleaseStatusColor(status: string): string {
  switch (status) {
    case 'Draft':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    case 'Review':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
    case 'Approved':
      return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
    case 'Delivered':
      return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
  }
}

export default function ReleasesTab({ onOpenCreateRelease }: ReleasesTabProps) {
  const { state, dispatch } = useCMStore()
  const [targetFilter, setTargetFilter] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set())
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [selectedRelease, setSelectedRelease] = useState<ReleasePackage | null>(null)
  const [wizardOpen, setWizardOpen] = useState(false)

  const filtered = useMemo(() => {
    return state.releases.filter((r) => {
      if (targetFilter.size > 0 && !targetFilter.has(r.target)) return false
      if (statusFilter.size > 0 && !statusFilter.has(r.status)) return false
      return true
    })
  }, [state.releases, targetFilter, statusFilter])

  const toggleTarget = (t: string) => {
    setTargetFilter((prev) => {
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

  const handleCreateRelease = (release: ReleasePackage) => {
    dispatch({ type: 'ADD_RELEASE', payload: release })
    setWizardOpen(false)
  }
  const handleApproveRelease = (releaseId: string) => {
    dispatch({ type: 'APPROVE_RELEASE', payload: { releaseId } })
  }

  const openCreate = () => {
    if (onOpenCreateRelease) onOpenCreateRelease()
    else setWizardOpen(true)
  }

  const gatingOk = (r: ReleasePackage) => {
    const bl = state.baselines.find((b) => b.baselineId === r.baselineRef)
    const baselineApproved = bl?.status === 'Approved' || bl?.status === 'Frozen'
    const highRiskDW = state.deviationsWaivers.some(
      (d) => d.riskLevel === 'High' && (d.status === 'Submitted' || d.status === 'Draft')
    )
    return baselineApproved && !highRiskDW
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
          Create Release
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
                Target
              </label>
              <div className="flex flex-wrap gap-2">
                {RELEASE_TARGETS.map((t) => (
                  <label key={t} className="flex items-center gap-1 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={targetFilter.has(t)}
                      onChange={() => toggleTarget(t)}
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
                {RELEASE_STATUSES.map((s) => (
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
                  Release ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Target
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Baseline
                </th>
                <th className="w-10 px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    No releases match. Create one to get started.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr
                    key={r.releaseId}
                    onClick={() => setSelectedRelease(r)}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-4 py-2 font-mono text-sm text-gray-900 dark:text-white">
                      {r.releaseId}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">{r.name}</td>
                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{r.target}</td>
                    <td className="px-4 py-2">
                      <span
                        className={clsx(
                          'px-2 py-0.5 rounded text-xs font-medium',
                          getReleaseStatusColor(r.status)
                        )}
                      >
                        {r.status}
                      </span>
                      {r.status === 'Approved' && (
                        <span title="Audit ready"><Shield size={12} className="inline ml-1 text-green-500" /></span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 font-mono">
                      {r.baselineRef}
                    </td>
                    <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setSelectedRelease(r)}
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

      <ReleaseDetailDrawer
        release={selectedRelease}
        isOpen={!!selectedRelease}
        onClose={() => setSelectedRelease(null)}
        onApprove={handleApproveRelease}
        gatingOk={selectedRelease ? gatingOk(selectedRelease) : false}
      />
      <ReleaseWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreate={handleCreateRelease}
      />
    </div>
  )
}
