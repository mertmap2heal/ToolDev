import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { EvidencePack, Document } from '../types'

interface AddToPackModalProps {
  isOpen: boolean
  onClose: () => void
  packs: EvidencePack[]
  documents: Document[]
  selectedDocumentIds: string[]
  onAdd: (packId: string, documentIds: string[]) => void
  onCreatePack?: (title: string) => string
}

export default function AddToPackModal({
  isOpen,
  onClose,
  packs,
  documents,
  selectedDocumentIds,
  onAdd,
  onCreatePack,
}: AddToPackModalProps) {
  const [packId, setPackId] = useState('')
  const [newPackTitle, setNewPackTitle] = useState('')
  const [useNewPack, setUseNewPack] = useState(false)

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      if (packs.length && !packId && !useNewPack) setPackId(packs[0].id)
      return () => document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, onClose, packs, packId, useNewPack])

  const handleConfirm = () => {
    let targetPackId = packId
    if (useNewPack && newPackTitle.trim() && onCreatePack) {
      targetPackId = onCreatePack(newPackTitle.trim())
    }
    if (targetPackId) {
      onAdd(targetPackId, selectedDocumentIds)
    }
    setNewPackTitle('')
    setUseNewPack(false)
    onClose()
  }

  if (!isOpen) return null

  const canConfirm = (packId && !useNewPack) || (useNewPack && newPackTitle.trim() && onCreatePack)

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
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add to Evidence Pack</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Adding {selectedDocumentIds.length} document(s) to pack.
          </p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={!useNewPack}
              onChange={() => setUseNewPack(false)}
              className="text-blue-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Existing pack</span>
          </label>
          {!useNewPack && (
            <select
              value={packId}
              onChange={(e) => setPackId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {packs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
              {packs.length === 0 && <option value="">No packs</option>}
            </select>
          )}
          {onCreatePack && (
            <>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={useNewPack}
                  onChange={() => setUseNewPack(true)}
                  className="text-blue-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">New pack</span>
              </label>
              {useNewPack && (
                <input
                  type="text"
                  value={newPackTitle}
                  onChange={(e) => setNewPackTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Pack title"
                />
              )}
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
