import { useEffect } from 'react'
import { X } from 'lucide-react'
import type { ExportHistoryItem, ExportProfile } from '../types'

interface ExportHistoryDetailModalProps {
  isOpen: boolean
  onClose: () => void
  entry: ExportHistoryItem | null
  profiles: ExportProfile[]
}

export default function ExportHistoryDetailModal({
  isOpen,
  onClose,
  entry,
  profiles,
}: ExportHistoryDetailModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      return () => document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, onClose])

  if (!isOpen || !entry) return null

  const profile = entry.profileId ? profiles.find((p) => p.id === entry.profileId) : null

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Export details</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Time</span>
            <p className="text-gray-900 dark:text-white">{new Date(entry.timestamp).toLocaleString()}</p>
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Exported by</span>
            <p className="text-gray-900 dark:text-white">{entry.exportedBy}</p>
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Profile</span>
            <p className="text-gray-900 dark:text-white">{entry.exportProfileName}</p>
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Items</span>
            <p className="text-gray-900 dark:text-white">{entry.itemsCount}</p>
            {entry.itemIds && entry.itemIds.length > 0 && (
              <ul className="mt-1 text-sm text-gray-600 dark:text-gray-400 list-disc list-inside">
                {entry.itemIds.map((id) => (
                  <li key={id}>{id}</li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Output</span>
            <p className="text-gray-900 dark:text-white font-mono text-sm">{entry.outputLabel}</p>
          </div>
          {entry.notes && (
            <div>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Notes</span>
              <p className="text-gray-600 dark:text-gray-400">{entry.notes}</p>
            </div>
          )}
          {profile && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Profile settings</span>
              <ul className="mt-2 text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>Format: {profile.format}</li>
                <li>Header/footer: {profile.headerFooter ? 'Yes' : 'No'}</li>
                <li>Numbering: {profile.numbering ? 'Yes' : 'No'}</li>
                <li>Include manifest: {profile.includeManifest ? 'Yes' : 'No'}</li>
                <li>Watermark: {profile.watermark}</li>
              </ul>
            </div>
          )}
        </div>
        <div className="flex justify-end p-6 border-t border-gray-200 dark:border-gray-700">
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
