import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { ExportProfile, ExportHistoryItem } from '../types'
import { EXPORT_FORMATS } from '../mockData'

interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
  profiles: ExportProfile[]
  onExport: (entry: ExportHistoryItem) => void
  itemCount: number
  itemIds: string[]
  onToast?: (message: string) => void
}

export default function ExportModal({
  isOpen,
  onClose,
  profiles,
  onExport,
  itemCount,
  itemIds,
  onToast,
}: ExportModalProps) {
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? '')
  const [includeManifest, setIncludeManifest] = useState(true)

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      if (profiles.length && !profileId) setProfileId(profiles[0].id)
      return () => document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, onClose, profiles, profileId])

  const profile = profiles.find((p) => p.id === profileId)

  const handleExport = () => {
    const entry: ExportHistoryItem = {
      id: `hist-${Date.now()}`,
      timestamp: new Date().toISOString(),
      exportedBy: 'Current User',
      exportProfileName: profile?.name ?? 'Export',
      itemsCount: itemCount,
      outputLabel: `documentation-export-${new Date().toISOString().slice(0, 10)}`,
      itemIds,
      profileId: profile?.id,
    }
    onExport(entry)
    onToast?.('Export recorded (local)')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Export</h2>
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Export profile</label>
            <select
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.format})
                </option>
              ))}
              {profiles.length === 0 && <option value="">No profiles</option>}
            </select>
          </div>
          {profile && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Format: {profile.format} · Watermark: {profile.watermark}
            </p>
          )}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeManifest}
              onChange={(e) => setIncludeManifest(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Include manifest</span>
          </label>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Items to export: {itemCount} (UI-only; export will be recorded in history.)
          </p>
        </div>
        <div className="flex justify-end gap-2 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={profiles.length === 0}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            Export
          </button>
        </div>
      </div>
    </div>
  )
}
