import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import clsx from 'clsx'
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges'

interface RenameModalProps {
  isOpen: boolean
  currentName: string
  onSave: (newName: string) => void
  onCancel: () => void
}

export default function RenameModal({
  isOpen,
  currentName,
  onSave,
  onCancel,
}: RenameModalProps) {
  const onDiscardRef = useRef<() => void>()
  const { markDirty, resetDirty, guardClose, warningDialog, draftBanner } = useUnsavedChanges(onCancel, isOpen, () => onDiscardRef.current?.())
  const [name, setName] = useState(currentName)
  const inputRef = useRef<HTMLInputElement>(null)

  onDiscardRef.current = () => {
    setName(currentName)
  }

  // Reset and focus when modal opens
  useEffect(() => {
    if (isOpen) {
      setName(currentName)
      // Small delay to ensure modal is rendered before focusing
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 10)
    }
  }, [isOpen, currentName])

  // Keyboard handling
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        guardClose()
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSave()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, name, currentName, onCancel])

  const handleSave = () => {
    const trimmed = name.trim()
    if (trimmed && trimmed !== currentName) {
      resetDirty()
      onSave(trimmed)
    } else {
      guardClose()
    }
  }

  const isValid = name.trim().length > 0
  const hasChanges = name.trim() !== currentName

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) guardClose() }}
        aria-hidden
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Rename Component
          </h3>
          <div className="flex items-center gap-2">
            {draftBanner}
            <button
              type="button"
              onClick={guardClose}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Component name
          </label>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); markDirty() }}
            placeholder="Enter component name"
            className={clsx(
              'w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white',
              'focus:ring-2 focus:ring-blue-500 focus:border-transparent',
              !isValid && name.length > 0
                ? 'border-red-500 dark:border-red-500'
                : 'border-gray-300 dark:border-gray-600'
            )}
          />
          {!isValid && name.length > 0 && (
            <p className="mt-1 text-sm text-red-500">Name cannot be empty</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <button
            type="button"
            onClick={guardClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isValid || !hasChanges}
            className={clsx(
              'px-4 py-2 text-sm font-medium rounded-lg',
              isValid && hasChanges
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            )}
          >
            Save
          </button>
        </div>
      </div>
      {warningDialog}
    </div>
  )
}
