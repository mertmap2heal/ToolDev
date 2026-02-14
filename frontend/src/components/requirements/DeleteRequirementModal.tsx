import React from 'react'
import { X, AlertTriangle } from 'lucide-react'
import type { Requirement } from 'shared/types/engineering.types'

interface DeleteRequirementModalProps {
  isOpen: boolean
  requirement: Requirement | null

  /** Legacy: count of linked functions. When LINKAGE_V1, use linkedItemsCount instead. */
  linkedFunctionsCount?: number
  /** When LINKAGE_V1: count of linked items (excludes function/parameter) */
  linkedItemsCount?: number
  onCancel: () => void
  isDeleting?: boolean
  children?: Requirement[]
  linkedIssues?: { id: string; title: string }[]
  linkedChangeRequests?: { id: string; title: string }[]
  linkedFunctions?: { id: string; name: string; functionId?: string }[]
  linkedItems?: { id: string; targetType: string; targetId: string; label?: string; linkType?: string; title?: string; description?: string; displayId?: string }[]
  onConfirm: (reason?: string, childrenToDelete?: string[]) => void
}

export default function DeleteRequirementModal({
  isOpen,
  requirement,

  linkedFunctionsCount = 0,
  linkedItemsCount,
  onConfirm,
  onCancel,
  isDeleting = false,
  children = [], // New prop for children list
  linkedIssues = [], // New prop
  linkedChangeRequests = [], // New prop
  linkedFunctions = [],
  linkedItems = [],
}: DeleteRequirementModalProps) {
  const [reason, setReason] = React.useState('')
  const [childrenToDelete, setChildrenToDelete] = React.useState<Set<string>>(new Set())

  // Initialize all children as selected for deletion by default
  React.useEffect(() => {
    if (children && children.length > 0) {
      setChildrenToDelete(new Set(children.map(c => c.id)))
    }
  }, [children, isOpen])

  const toggleChild = (childId: string) => {
    setChildrenToDelete(prev => {
      const next = new Set(prev)
      if (next.has(childId)) {
        next.delete(childId)
      } else {
        next.add(childId)
      }
      return next
    })
  }

  if (!isOpen || !requirement) return null

  const displayLinkedFunctionsCount = linkedItemsCount ?? linkedFunctionsCount
  const hasLinkedItems = displayLinkedFunctionsCount > 0 || linkedIssues.length > 0 || linkedChangeRequests.length > 0 || linkedFunctions.length > 0 || linkedItems.length > 0

  const handleConfirm = () => {
    onConfirm(reason, Array.from(childrenToDelete))
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
              <AlertTriangle size={20} className="text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Move to Trash
            </h2>
          </div>
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="p-6 overflow-y-auto flex-1">
          <p className="text-gray-700 dark:text-gray-300 mb-6">
            Are you sure you want to move requirement{' '}
            <span className="font-semibold text-gray-900 dark:text-white">
              "{requirement.requirementId || requirement.id.substring(0, 8)} - {requirement.title}"
            </span>{' '}
            to trash?
          </p>

          {/* Child Requirements Section */}
          {children.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                Child Requirements ({children.length})
                <span className="text-xs font-normal text-gray-500">(Uncheck to keep and reparent to root)</span>
              </h3>
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700 max-h-40 overflow-y-auto">
                {children.map(child => (
                  <label key={child.id} className="flex items-center p-3 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={childrenToDelete.has(child.id)}
                      onChange={() => toggleChild(child.id)}
                      className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500 dark:border-gray-600 dark:bg-gray-700"
                    />
                    <div className="ml-3 flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {child.requirementId || child.id.substring(0, 8)} - {child.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {childrenToDelete.has(child.id) ? 'Will be deleted' : 'Will be moved to root level'}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Linked Items Warnings */}
          {hasLinkedItems && (
            <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
                <p className="text-sm text-yellow-800 dark:text-yellow-300 font-medium">
                  This requirement is linked to other items. Deleting it will break these links.
                </p>
              </div>

              <div className="space-y-3 pl-6">
                {/* Linked Functions */}
                {linkedFunctions.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-yellow-900 dark:text-yellow-200 uppercase tracking-wide mb-1">
                      Functions ({linkedFunctions.length})
                    </p>
                    <ul className="text-sm text-yellow-800 dark:text-yellow-300 space-y-1">
                      {linkedFunctions.map(func => (
                        <li key={func.id} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full flex-shrink-0" />
                          <span className="font-mono text-xs">{func.functionId || 'FUNC'}</span>
                          <span className="truncate">{func.name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Fallback for count only if list is empty but count is > 0 */}
                {linkedFunctions.length === 0 && linkedFunctionsCount > 0 && (
                  <div>
                    <p className="text-sm text-yellow-800 dark:text-yellow-300">
                      • {linkedFunctionsCount} linked function(s)
                    </p>
                  </div>
                )}

                {/* Linked Issues */}
                {linkedIssues.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-yellow-900 dark:text-yellow-200 uppercase tracking-wide mb-1">
                      Issues ({linkedIssues.length})
                    </p>
                    <ul className="text-sm text-yellow-800 dark:text-yellow-300 space-y-1">
                      {linkedIssues.map(issue => (
                        <li key={issue.id} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full flex-shrink-0" />
                          {issue.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Linked Change Requests */}
                {linkedChangeRequests.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-yellow-900 dark:text-yellow-200 uppercase tracking-wide mb-1">
                      Change Requests ({linkedChangeRequests.length})
                    </p>
                    <ul className="text-sm text-yellow-800 dark:text-yellow-300 space-y-1">
                      {linkedChangeRequests.map(cr => (
                        <li key={cr.id} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full flex-shrink-0" />
                          {cr.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Linked Items (Generic/V1) */}
                {linkedItems.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-yellow-900 dark:text-yellow-200 uppercase tracking-wide mb-1">
                      Other Links ({linkedItems.length})
                    </p>
                    <ul className="text-sm text-yellow-800 dark:text-yellow-300 space-y-1">
                      {linkedItems.map(item => {
                        const typeLabel = item.targetType.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                        const linkLabel = item.linkType ? item.linkType.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : ''
                        const displayId = item.displayId || item.targetId.substring(0, 8)

                        // Determine URL
                        let url = '#'
                        if (item.targetType === 'issue') url = `/projects/${requirement.projectId}/issues/${item.targetId}` // Using projectId from requirement
                        else if (item.targetType === 'change_request') url = `/projects/${requirement.projectId}/change-requests/${item.targetId}?changeRequestId=${item.targetId}`
                        else if (item.targetType === 'requirement') url = `/projects/${requirement.projectId}/requirements?requirementId=${item.targetId}`

                        return (
                          <li key={item.id} className="flex items-center gap-2 py-0.5">
                            <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full flex-shrink-0" />
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 uppercase tracking-wide">
                                  {typeLabel}
                                </span>
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-xs truncate hover:underline hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                                  title={item.title || item.label}
                                >
                                  {displayId}
                                </a>
                              </div>
                              {(item.title || linkLabel) && (
                                <div className="flex items-center gap-1 ml-1 text-xs text-yellow-700 dark:text-yellow-400">
                                  {item.title && <span className="truncate max-w-[200px] italic">"{item.title}"</span>}
                                  {item.title && linkLabel && <span>&mdash;</span>}
                                  {linkLabel && <span className="opacity-75">{linkLabel}</span>}
                                </div>
                              )}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Items in trash will be permanently deleted after 7 days.
          </p>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Reason (optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you deleting this?"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              rows={2}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 shrink-0 flex items-center justify-end gap-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isDeleting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Moving to Trash...</span>
              </>
            ) : (
              'Move to Trash'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
