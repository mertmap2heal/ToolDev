import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { ExportProfile, DocumentType } from '../types'
import { EXPORT_FORMATS, WATERMARK_OPTIONS, DOC_TYPES } from '../mockData'
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges'

interface CreateExportProfileModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (profile: Omit<ExportProfile, 'id'> & { id: string }) => void
  nextId: string
  initial?: ExportProfile | null
}

export default function CreateExportProfileModal({
  isOpen,
  onClose,
  onSave,
  nextId,
  initial,
}: CreateExportProfileModalProps) {
  const onDiscardRef = useRef<() => void>()
  const { markDirty, resetDirty, guardClose, warningDialog, draftBanner } = useUnsavedChanges(onClose, isOpen, () => onDiscardRef.current?.())
  const [name, setName] = useState(initial?.name ?? '')
  const [format, setFormat] = useState<ExportProfile['format']>(initial?.format ?? 'PDF')
  const [headerFooter, setHeaderFooter] = useState(initial?.headerFooter ?? true)
  const [numbering, setNumbering] = useState(initial?.numbering ?? true)
  const [includeManifest, setIncludeManifest] = useState(initial?.includeManifest ?? true)
  const [watermark, setWatermark] = useState<ExportProfile['watermark']>(initial?.watermark ?? 'None')
  const [defaultDocTypes, setDefaultDocTypes] = useState<DocumentType[]>(initial?.defaultDocTypes ?? [])

  onDiscardRef.current = () => {
    setName('')
    setFormat('PDF')
    setHeaderFooter(true)
    setNumbering(true)
    setIncludeManifest(true)
    setWatermark('None')
    setDefaultDocTypes([])
  }

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') guardClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      if (initial) {
        setName(initial.name)
        setFormat(initial.format)
        setHeaderFooter(initial.headerFooter)
        setNumbering(initial.numbering)
        setIncludeManifest(initial.includeManifest)
        setWatermark(initial.watermark)
        setDefaultDocTypes(initial.defaultDocTypes)
      } else {
        setName('')
        setFormat('PDF')
        setHeaderFooter(true)
        setNumbering(true)
        setIncludeManifest(true)
        setWatermark('None')
        setDefaultDocTypes([])
      }
      return () => document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, onClose, initial])

  const toggleDocType = (t: DocumentType) => {
    setDefaultDocTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    )
    markDirty()
  }

  const handleSave = () => {
    onSave({
      id: initial?.id ?? nextId,
      name: name || 'Unnamed profile',
      format,
      headerFooter,
      numbering,
      includeManifest,
      watermark,
      defaultDocTypes,
    })
    resetDirty()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={(e) => { if (e.target === e.currentTarget) guardClose() }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {initial ? 'Edit profile' : 'Create export profile'}
          </h2>
          <div className="flex items-center gap-2">
            {draftBanner}
            <button
              onClick={guardClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); markDirty() }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Profile name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Format</label>
            <select
              value={format}
              onChange={(e) => { setFormat(e.target.value as ExportProfile['format']); markDirty() }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {EXPORT_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={headerFooter}
              onChange={(e) => { setHeaderFooter(e.target.checked); markDirty() }}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Header/footer</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={numbering}
              onChange={(e) => { setNumbering(e.target.checked); markDirty() }}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Numbering</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeManifest}
              onChange={(e) => { setIncludeManifest(e.target.checked); markDirty() }}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Include manifest</span>
          </label>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Watermark</label>
            <select
              value={watermark}
              onChange={(e) => { setWatermark(e.target.value as ExportProfile['watermark']); markDirty() }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {WATERMARK_OPTIONS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Default document types
            </label>
            <div className="flex flex-wrap gap-2">
              {DOC_TYPES.map((opt) => (
                <label key={opt.value} className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={defaultDocTypes.includes(opt.value)}
                    onChange={() => toggleDocType(opt.value)}
                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={guardClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            {initial ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
      {warningDialog}
    </div>
  )
}
