import { useQuery } from '@tanstack/react-query'
import { X, ArrowLeftRight, Plus, Minus, Edit, FileText, Link2, Link2Off, AlertTriangle } from 'lucide-react'
import { baselineService } from '../../services/baseline.service'
import { LINKAGE_V1 } from '../../config/featureFlags'
import type { BaselineComparison } from 'shared/types/engineering.types'
import { format } from 'date-fns'
import clsx from 'clsx'

interface BaselineComparisonModalProps {
  projectId: string
  baselineAId: string
  baselineBId: string
  onClose: () => void
}

export default function BaselineComparisonModal({
  projectId,
  baselineAId,
  baselineBId,
  onClose,
}: BaselineComparisonModalProps) {
  const { data: comparison, isLoading } = useQuery({
    queryKey: ['baseline-comparison', projectId, baselineAId, baselineBId],
    queryFn: async () => {
      const response = await baselineService.compareBaselines(projectId, baselineAId, baselineBId)
      if (response.success && response.data) {
        return response.data
      }
      throw new Error(response.error || 'Failed to compare baselines')
    },
    enabled: !!projectId && !!baselineAId && !!baselineBId,
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[1000px] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <ArrowLeftRight className="text-blue-500" size={24} />
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Baseline Comparison
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Compare two baselines
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
              Comparing baselines...
            </div>
          ) : !comparison ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Failed to load comparison
            </div>
          ) : (
            <div className="space-y-6">
              {/* Baseline Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Baseline A
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    {comparison.baselineA.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mb-1">
                    Created: {format(new Date(comparison.baselineA.createdAt), 'PPp')}
                  </p>
                  {LINKAGE_V1 && comparison.baselineA.linksCount != null && (
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      {comparison.baselineA.linksCount} links
                    </p>
                  )}
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Baseline B
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    {comparison.baselineB.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mb-1">
                    Created: {format(new Date(comparison.baselineB.createdAt), 'PPp')}
                  </p>
                  {LINKAGE_V1 && comparison.baselineB.linksCount != null && (
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      {comparison.baselineB.linksCount} links
                    </p>
                  )}
                </div>
              </div>

              {/* Summary */}
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                  Summary
                </h3>
                <div className={`grid gap-4 ${LINKAGE_V1 && (comparison.linksAdded?.length || comparison.linksRemoved?.length || comparison.linksSuspectChanged?.length) ? 'grid-cols-6' : 'grid-cols-3'}`}>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {comparison.added.length}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Req Added</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {comparison.removed.length}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Req Removed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                      {comparison.modified.length}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Req Modified</div>
                  </div>
                  {LINKAGE_V1 && (comparison.linksAdded?.length || comparison.linksRemoved?.length || comparison.linksSuspectChanged?.length) ? (
                    <>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {comparison.linksAdded?.length ?? 0}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Links Added</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                          {comparison.linksRemoved?.length ?? 0}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Links Removed</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                          {comparison.linksSuspectChanged?.length ?? 0}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Suspect Changed</div>
                      </div>
                    </>
                  ) : null}
                </div>
              </div>

              {/* Added Requirements */}
              {comparison.added.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Plus className="text-green-600 dark:text-green-400" size={20} />
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      Added Requirements ({comparison.added.length})
                    </h3>
                  </div>
                  <div className="border border-green-200 dark:border-green-800 rounded-lg overflow-hidden bg-green-50/50 dark:bg-green-900/10">
                    <div className="divide-y divide-green-200 dark:divide-green-800">
                      {comparison.added.map((req) => (
                        <div key={req.id} className="p-3 hover:bg-green-100/50 dark:hover:bg-green-900/20">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                                  {req.requirementId}
                                </span>
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                  {req.title}
                                </span>
                              </div>
                              {req.description && (
                                <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mt-1">
                                  {req.description.replace(/<[^>]*>/g, '').substring(0, 150)}
                                  {req.description.length > 150 ? '...' : ''}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              {req.priority && (
                                <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300">
                                  {req.priority}
                                </span>
                              )}
                              {req.status && (
                                <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300">
                                  {req.status}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Removed Requirements */}
              {comparison.removed.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Minus className="text-red-600 dark:text-red-400" size={20} />
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      Removed Requirements ({comparison.removed.length})
                    </h3>
                  </div>
                  <div className="border border-red-200 dark:border-red-800 rounded-lg overflow-hidden bg-red-50/50 dark:bg-red-900/10">
                    <div className="divide-y divide-red-200 dark:divide-red-800">
                      {comparison.removed.map((req) => (
                        <div key={req.id} className="p-3 hover:bg-red-100/50 dark:hover:bg-red-900/20">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                                  {req.requirementId}
                                </span>
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                  {req.title}
                                </span>
                              </div>
                              {req.description && (
                                <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mt-1">
                                  {req.description.replace(/<[^>]*>/g, '').substring(0, 150)}
                                  {req.description.length > 150 ? '...' : ''}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              {req.priority && (
                                <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300">
                                  {req.priority}
                                </span>
                              )}
                              {req.status && (
                                <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300">
                                  {req.status}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Modified Requirements */}
              {comparison.modified.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Edit className="text-yellow-600 dark:text-yellow-400" size={20} />
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      Modified Requirements ({comparison.modified.length})
                    </h3>
                  </div>
                  <div className="border border-yellow-200 dark:border-yellow-800 rounded-lg overflow-hidden bg-yellow-50/50 dark:bg-yellow-900/10">
                    <div className="divide-y divide-yellow-200 dark:divide-yellow-800">
                      {comparison.modified.map((req) => (
                        <div key={req.id} className="p-3 hover:bg-yellow-100/50 dark:hover:bg-yellow-900/20">
                          <div className="flex items-start justify-between gap-4 mb-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                                  {req.requirementId}
                                </span>
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                  {req.title}
                                </span>
                              </div>
                              {req.description && (
                                <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mt-1">
                                  {req.description.replace(/<[^>]*>/g, '').substring(0, 150)}
                                  {req.description.length > 150 ? '...' : ''}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              {req.priority && (
                                <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300">
                                  {req.priority}
                                </span>
                              )}
                              {req.status && (
                                <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300">
                                  {req.status}
                                </span>
                              )}
                            </div>
                          </div>
                          {req.previous && (
                            <div className="mt-2 pt-2 border-t border-yellow-300 dark:border-yellow-700">
                              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Previous values:</div>
                              <div className="flex items-center gap-2 text-xs">
                                {req.previous.title && req.previous.title !== req.title && (
                                  <span className="text-gray-600 dark:text-gray-400">
                                    Title: <span className="line-through">{req.previous.title}</span> → {req.title}
                                  </span>
                                )}
                                {req.previous.priority && req.previous.priority !== req.priority && (
                                  <span className="text-gray-600 dark:text-gray-400">
                                    Priority: <span className="line-through">{req.previous.priority}</span> → {req.priority}
                                  </span>
                                )}
                                {req.previous.status && req.previous.status !== req.status && (
                                  <span className="text-gray-600 dark:text-gray-400">
                                    Status: <span className="line-through">{req.previous.status}</span> → {req.status}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Link Changes (LINKAGE_V1) */}
              {LINKAGE_V1 && (comparison.linksAdded?.length || comparison.linksRemoved?.length || comparison.linksSuspectChanged?.length) ? (
                <div className="space-y-4">
                  {comparison.linksAdded && comparison.linksAdded.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Link2 className="text-green-600 dark:text-green-400" size={20} />
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          Links Added ({comparison.linksAdded.length})
                        </h3>
                      </div>
                      <div className="border border-green-200 dark:border-green-800 rounded-lg overflow-hidden bg-green-50/50 dark:bg-green-900/10 max-h-48 overflow-y-auto">
                        <div className="divide-y divide-green-200 dark:divide-green-800">
                          {comparison.linksAdded.map((link) => (
                            <div key={link.id} className="p-2 text-sm font-mono">
                              {link.sourceType}:{link.sourceId?.slice(0, 8)} → {link.targetType}:{link.targetId?.slice(0, 8)} [{link.linkType}]
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {comparison.linksRemoved && comparison.linksRemoved.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Link2Off className="text-red-600 dark:text-red-400" size={20} />
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          Links Removed ({comparison.linksRemoved.length})
                        </h3>
                      </div>
                      <div className="border border-red-200 dark:border-red-800 rounded-lg overflow-hidden bg-red-50/50 dark:bg-red-900/10 max-h-48 overflow-y-auto">
                        <div className="divide-y divide-red-200 dark:divide-red-800">
                          {comparison.linksRemoved.map((link) => (
                            <div key={link.id} className="p-2 text-sm font-mono">
                              {link.sourceType}:{link.sourceId?.slice(0, 8)} → {link.targetType}:{link.targetId?.slice(0, 8)} [{link.linkType}]
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  {comparison.linksSuspectChanged && comparison.linksSuspectChanged.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="text-amber-600 dark:text-amber-400" size={20} />
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          Links Suspect Status Changed ({comparison.linksSuspectChanged.length})
                        </h3>
                      </div>
                      <div className="border border-amber-200 dark:border-amber-800 rounded-lg overflow-hidden bg-amber-50/50 dark:bg-amber-900/10 max-h-48 overflow-y-auto">
                        <div className="divide-y divide-amber-200 dark:divide-amber-800">
                          {comparison.linksSuspectChanged.map((link) => (
                            <div key={link.id} className="p-2 text-sm font-mono">
                              {link.sourceType}:{link.sourceId?.slice(0, 8)} → {link.targetType}:{link.targetId?.slice(0, 8)} [{link.linkType}]
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {/* No Changes */}
              {comparison.added.length === 0 &&
                comparison.removed.length === 0 &&
                comparison.modified.length === 0 &&
                !(LINKAGE_V1 && (comparison.linksAdded?.length || comparison.linksRemoved?.length || comparison.linksSuspectChanged?.length)) && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <FileText size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
                    <p>No differences found between the two baselines</p>
                  </div>
                )}
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
