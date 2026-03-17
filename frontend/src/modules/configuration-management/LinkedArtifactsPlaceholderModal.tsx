import { useEffect } from 'react'
import { X } from 'lucide-react'

export interface FakeRow {
  id: string
  label: string
  status?: string
}

interface LinkedArtifactsPlaceholderModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  message: string
  fakeRows: FakeRow[]
}

export default function LinkedArtifactsPlaceholderModal({
  isOpen,
  onClose,
  title,
  message,
  fakeRows,
}: LinkedArtifactsPlaceholderModalProps) {
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

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="linked-artifacts-modal-title"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 id="linked-artifacts-modal-title" className="text-xl font-bold text-gray-900 dark:text-white">
            {title}
          </h2>
          <button
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
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    ID
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Label
                  </th>
                  {fakeRows.some((r) => r.status) && (
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Status
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {fakeRows.map((row) => (
                  <tr key={row.id} className="text-gray-700 dark:text-gray-300">
                    <td className="px-4 py-2 font-mono text-xs">{row.id}</td>
                    <td className="px-4 py-2">{row.label}</td>
                    {fakeRows.some((r) => r.status) && (
                      <td className="px-4 py-2">{row.status ?? '—'}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 italic">
            Preview only. No navigation to other modules.
          </p>
        </div>
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}
