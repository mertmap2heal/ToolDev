import { AlertTriangle } from 'lucide-react'

interface UnsavedChangesDialogProps {
  isOpen: boolean
  onKeepEditing: () => void
  onKeepForLater: () => void
  onDiscardAll: () => void
}

export default function UnsavedChangesDialog({
  isOpen,
  onKeepEditing,
  onKeepForLater,
  onDiscardAll,
}: UnsavedChangesDialogProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[200]"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onKeepEditing}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-gray-200 dark:border-gray-700">
          <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30 shrink-0">
            <AlertTriangle size={20} className="text-orange-600 dark:text-orange-400" />
          </div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Unsaved changes
          </h2>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            You have unsaved changes. What would you like to do?
          </p>
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-2 px-5 pb-5">
          <button
            onClick={onKeepEditing}
            className="w-full px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
          >
            Continue editing
          </button>
          <button
            onClick={onKeepForLater}
            className="w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors font-medium"
          >
            Keep for later
          </button>
          <button
            onClick={onDiscardAll}
            className="w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors font-medium"
          >
            Discard all changes
          </button>
        </div>
      </div>
    </div>
  )
}
