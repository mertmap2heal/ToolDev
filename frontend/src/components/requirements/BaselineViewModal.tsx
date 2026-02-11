import { useQuery } from '@tanstack/react-query'
import { X, FileText, Calendar, User, Archive, Lock, Link2, AlertTriangle } from 'lucide-react'
import { baselineService } from '../../services/baseline.service'
import { LINKAGE_V1 } from '../../config/featureFlags'
import type { Baseline } from 'shared/types/engineering.types'
import { format } from 'date-fns'
import clsx from 'clsx'

interface BaselineViewModalProps {
  projectId: string
  baselineId: string
  onClose: () => void
}

/**
 * BaselineViewModal displays detailed information about a baseline
 * including all requirements that were included in the snapshot.
 */
export default function BaselineViewModal({ projectId, baselineId, onClose }: BaselineViewModalProps) {
  const { data: baseline, isLoading } = useQuery({
    queryKey: ['baseline', projectId, baselineId],
    queryFn: async () => {
      const response = await baselineService.getBaseline(projectId, baselineId)
      if (response.success && response.data) {
        return response.data
      }
      throw new Error(response.error || 'Failed to load baseline')
    },
    enabled: !!projectId && !!baselineId,
  })

  // Parse requirement snapshots
  const requirements = baseline?.items?.map((item) => {
    try {
      return JSON.parse(item.snapshot)
    } catch {
      return null
    }
  }).filter(Boolean) || []

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'locked':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'archived':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[900px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Archive className="text-blue-500" size={24} />
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Baseline Details
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                View baseline snapshot
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Loading baseline...
            </div>
          ) : !baseline ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Baseline not found
            </div>
          ) : (
            <div className="space-y-6">
              {/* Baseline Info */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {baseline.name}
                  </h3>
                  <span className={clsx('px-2 py-0.5 text-xs font-medium rounded-full', getStatusColor(baseline.status))}>
                    {baseline.status}
                  </span>
                </div>
                {baseline.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {baseline.description}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <FileText size={16} />
                    <span>{baseline.itemCount || 0} requirements</span>
                  </div>
                  {LINKAGE_V1 && (baseline.linksCount != null || baseline.suspectLinksCount != null) && (
                    <>
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <Link2 size={16} />
                        <span>{baseline.linksCount ?? 0} links</span>
                      </div>
                      {(baseline.suspectLinksCount ?? 0) > 0 && (
                        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                          <AlertTriangle size={16} />
                          <span>{baseline.suspectLinksCount} suspect links</span>
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Calendar size={16} />
                    <span>Created: {format(new Date(baseline.createdAt), 'PPp')}</span>
                  </div>
                  {baseline.createdByName && (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <User size={16} />
                      <span>By: {baseline.createdByName}</span>
                    </div>
                  )}
                  {baseline.lockedAt && (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Lock size={16} />
                      <span>Locked: {format(new Date(baseline.lockedAt), 'PPp')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Requirements List */}
              <div>
                <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-3">
                  Requirements in Baseline ({requirements.length})
                </h4>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className="max-h-96 overflow-y-auto">
                    {requirements.length === 0 ? (
                      <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                        No requirements in this baseline
                      </div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                              ID
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                              Title
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                              Priority
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                              Status
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                              Category
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {requirements.map((req: any) => (
                            <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                              <td className="px-4 py-2 font-mono text-xs text-gray-600 dark:text-gray-400">
                                {req.requirementId || req.id.substring(0, 8)}
                              </td>
                              <td className="px-4 py-2 text-gray-900 dark:text-white">
                                {req.title}
                              </td>
                              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                                {req.priority || '—'}
                              </td>
                              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                                {req.status || '—'}
                              </td>
                              <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                                {req.category || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
