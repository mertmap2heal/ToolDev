import React from 'react'
import { X, AlertTriangle } from 'lucide-react'
import type { Requirement } from 'shared/types/engineering.types'

interface DeleteRequirementModalProps {
  isOpen: boolean
  requirement: Requirement | null
  hasChildren: boolean
  /** Legacy: count of linked functions. When LINKAGE_V1, use linkedItemsCount instead. */
  linkedFunctionsCount?: number
  /** When LINKAGE_V1: count of linked items (excludes function/parameter) */
  linkedItemsCount?: number
  onConfirm: (reason?: string) => void
  onCancel: () => void
  isDeleting?: boolean
}

export default function DeleteRequirementModal({
  isOpen,
  requirement,
  hasChildren,
  linkedFunctionsCount = 0,
  linkedItemsCount,
  onConfirm,
  onCancel,
  isDeleting = false,
}: DeleteRequirementModalProps) {
  const [reason, setReason] = React.useState('')

  if (!isOpen || !requirement) return null

  const warnings: string[] = []
  if (hasChildren) {
    warnings.push('This requirement has child requirements that must be deleted or reassigned first.')
  }
  const linkCount = linkedItemsCount ?? linkedFunctionsCount
  if (linkCount > 0) {
    warnings.push(
      linkedItemsCount != null
        ? `This requirement is linked to ${linkCount} item(s). Please unlink them first.`
        : `This requirement is linked to ${linkCount} function(s). Please unlink them first.`
    )
  }

  const handleConfirm = () => {
    onConfirm(reason)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
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

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Are you sure you want to move requirement{' '}
            <span className="font-semibold text-gray-900 dark:text-white">
              "{requirement.requirementId || requirement.id.substring(0, 8)} - {requirement.title}"
            </span>{' '}
            to trash?
          </p>

          {warnings.length > 0 && (
            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-2">
                Cannot move to trash:
              </p>
              <ul className="list-disc list-inside text-sm text-yellow-700 dark:text-yellow-400 space-y-1">
                {warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {warnings.length === 0 && (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Items in trash will be permanently deleted after 7 days.
              </p>

              <div className="mb-6">
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
            </>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-4">
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
              disabled={isDeleting || warnings.length > 0}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isDeleting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Moving...</span>
                </>
              ) : (
                'Move to Trash'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
