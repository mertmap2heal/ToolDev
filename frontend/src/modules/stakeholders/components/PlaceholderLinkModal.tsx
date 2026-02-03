import { useEffect } from 'react'
import { X } from 'lucide-react'

export interface PlaceholderLinkModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  moduleName: string
  filterKey: string
  filterValue: string
  previewColumns: string[]
  previewRows: Record<string, string>[]
  onPlaceholderNavigate?: () => void
}

const MAX_PREVIEW_ROWS = 8

export default function PlaceholderLinkModal({
  isOpen,
  onClose,
  title,
  moduleName,
  filterKey,
  filterValue,
  previewColumns,
  previewRows,
  onPlaceholderNavigate,
}: PlaceholderLinkModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      return () => document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const message = `Placeholder: This would navigate to ${moduleName} filtered by ${filterKey}=${filterValue}. Navigation not implemented yet.`
  const rows = previewRows.slice(0, MAX_PREVIEW_ROWS)

  const handleGoToModule = () => {
    onPlaceholderNavigate?.()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="placeholder-link-modal-title"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 id="placeholder-link-modal-title" className="text-xl font-bold text-gray-900 dark:text-white">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">{message}</p>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  {previewColumns.map((col) => (
                    <th
                      key={col}
                      className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {rows.map((row, idx) => (
                  <tr key={idx} className="text-gray-700 dark:text-gray-300">
                    {previewColumns.map((col) => (
                      <td key={col} className="px-4 py-2 text-gray-900 dark:text-white">
                        {row[col] ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 italic">
            Preview only. No navigation to other modules.
          </p>
        </div>
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleGoToModule}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Go to module (placeholder)
          </button>
        </div>
      </div>
    </div>
  )
}
