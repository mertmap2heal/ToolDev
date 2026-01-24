import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Plus,
} from 'lucide-react'
import { MOCK_HAZARDS } from '../../data/mockSafety'
import type { Hazard } from '../../types/safety.types'
import HazardDetailDrawer from '../../components/safety/HazardDetailDrawer'
import { format } from 'date-fns'
import clsx from 'clsx'

export default function HazardsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchQuery, setSearchQuery] = useState('')
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false)
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [missingReqs, setMissingReqs] = useState(false)
  const [missingVer, setMissingVer] = useState(false)
  const [missingIface, setMissingIface] = useState(false)
  const [selectedHazard, setSelectedHazard] = useState<Hazard | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  const filteredHazards = useMemo(() => {
    return MOCK_HAZARDS.filter((h) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (
          !h.title.toLowerCase().includes(q) &&
          !h.identifier.toLowerCase().includes(q) &&
          !h.description.toLowerCase().includes(q)
        )
          return false
      }
      if (severityFilter !== 'all' && h.severity !== severityFilter) return false
      if (statusFilter !== 'all' && h.status !== statusFilter) return false
      if (missingReqs && h.linkedRequirementsCount > 0) return false
      if (missingVer && h.linkedVerificationCount > 0) return false
      if (missingIface && h.linkedInterfacesCount > 0) return false
      return true
    })
  }, [
    searchQuery,
    severityFilter,
    statusFilter,
    missingReqs,
    missingVer,
    missingIface,
  ])

  const handleRowClick = (h: Hazard) => {
    setSelectedHazard(h)
    setIsDrawerOpen(true)
  }

  return (
    <div className="flex h-[calc(100vh-12rem)]">
      <div className="flex-1 flex flex-col overflow-hidden space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Hazards
          </h2>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} />
            Create Hazard
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="relative mb-4">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Search hazards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <button
            onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
            className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
          >
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-gray-600 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Filters
              </span>
            </div>
            {isFiltersExpanded ? (
              <ChevronUp size={16} className="text-gray-600 dark:text-gray-400" />
            ) : (
              <ChevronDown size={16} className="text-gray-600 dark:text-gray-400" />
            )}
          </button>
          {isFiltersExpanded && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Severity
                </label>
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="all">All</option>
                  <option value="Catastrophic">Catastrophic</option>
                  <option value="Hazardous">Hazardous</option>
                  <option value="Major">Major</option>
                  <option value="Minor">Minor</option>
                  <option value="No Safety Effect">No Safety Effect</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="all">All</option>
                  <option value="Draft">Draft</option>
                  <option value="Open">Open</option>
                  <option value="Mitigated">Mitigated</option>
                  <option value="Verified">Verified</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
              <div className="space-y-2">
                <span className="block text-xs font-medium text-gray-500 dark:text-gray-400">
                  Missing links
                </span>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={missingReqs}
                      onChange={(e) => setMissingReqs(e.target.checked)}
                      className="rounded"
                    />
                    Missing Req links
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={missingVer}
                      onChange={(e) => setMissingVer(e.target.checked)}
                      className="rounded"
                    />
                    Missing Verification
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={missingIface}
                      onChange={(e) => setMissingIface(e.target.checked)}
                      className="rounded"
                    />
                    Missing Interfaces
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                  ID
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                  Title
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                  Severity
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                  Status
                </th>
                <th className="text-right py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                  Reqs
                </th>
                <th className="text-right py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                  Ifaces
                </th>
                <th className="text-right py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                  Verification
                </th>
                <th className="text-right py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                  CRs
                </th>
                <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredHazards.map((h) => (
                <tr
                  key={h.id}
                  onClick={() => handleRowClick(h)}
                  className={clsx(
                    'border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer',
                    selectedHazard?.id === h.id && 'bg-blue-50 dark:bg-blue-900/20'
                  )}
                >
                  <td className="py-3 px-4 text-gray-900 dark:text-white font-mono">
                    {h.identifier}
                  </td>
                  <td className="py-3 px-4 text-gray-900 dark:text-white">{h.title}</td>
                  <td className="py-3 px-4">
                    <span
                      className={clsx(
                        'px-2 py-0.5 rounded text-xs font-medium',
                        h.severity === 'Catastrophic' &&
                          'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
                        h.severity === 'Hazardous' &&
                          'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
                        h.severity === 'Major' &&
                          'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
                        (h.severity === 'Minor' || h.severity === 'No Safety Effect') &&
                          'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      )}
                    >
                      {h.severity}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-700 dark:text-gray-300">{h.status}</td>
                  <td className="py-3 px-4 text-right text-gray-700 dark:text-gray-300">
                    {h.linkedRequirementsCount}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-700 dark:text-gray-300">
                    {h.linkedInterfacesCount}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-700 dark:text-gray-300">
                    {h.linkedVerificationCount}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-700 dark:text-gray-300">
                    {h.linkedChangeRequestsCount}
                  </td>
                  <td className="py-3 px-4 text-gray-500 dark:text-gray-400">
                    {format(new Date(h.updatedAt), 'PP')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredHazards.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              No hazards match filters.
            </div>
          )}
        </div>
      </div>

      <HazardDetailDrawer
        isOpen={isDrawerOpen}
        hazard={selectedHazard}
        projectId={projectId ?? ''}
        onClose={() => {
          setIsDrawerOpen(false)
          setSelectedHazard(null)
        }}
      />

      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Create Hazard (placeholder)
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Create Hazard will be implemented later. UI stub only.
            </p>
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
