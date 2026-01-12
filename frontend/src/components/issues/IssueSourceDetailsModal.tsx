import { X } from 'lucide-react'
import type { Issue } from '../../../shared/types/engineering.types'
import type { SystemFunction } from '../../../shared/types/engineering.types'

interface IssueSourceDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  issue: Issue | null
  functions: SystemFunction[]
}

export default function IssueSourceDetailsModal({
  isOpen,
  onClose,
  issue,
  functions,
}: IssueSourceDetailsModalProps) {
  if (!isOpen || !issue) return null

  const relatedFunctions = issue.relatedFunctionIds
    ?.map((funcId) => functions.find((f) => f.id === funcId))
    .filter(Boolean) as SystemFunction[]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Source Details: {issue.title}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {relatedFunctions && relatedFunctions.length > 0 ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                  Source Type
                </label>
                <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <span className="text-blue-700 dark:text-blue-300 font-medium">Function(s)</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                  Related Functions ({relatedFunctions.length})
                </label>
                <div className="space-y-3">
                  {relatedFunctions.map((func) => (
                    <div
                      key={func.id}
                      className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg"
                    >
                      <div className="mb-2">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Function ID
                        </span>
                        <div className="mt-1 text-gray-900 dark:text-white">
                          {func.functionId || 'N/A'}
                        </div>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Function Name
                        </span>
                        <div className="mt-1 text-gray-900 dark:text-white">{func.name}</div>
                      </div>
                      {func.description && (
                        <div className="mt-2">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Description
                          </span>
                          <div className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                            {func.description}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                  How This Issue Was Created
                </label>
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    This issue was created from the selected function(s) using the "Raise Issue" feature.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">
                No source information available for this issue.
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
