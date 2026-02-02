import { useEffect, useRef } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { useFocusTrap } from '../useFocusTrap'

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
  variant?: 'danger' | 'default'
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
  variant = 'default',
}: ConfirmModalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  useFocusTrap(containerRef, isOpen)

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      return () => document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, onCancel])

  if (!isOpen) return null

  const isDanger = variant === 'danger'

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div
        ref={containerRef}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            {isDanger && (
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-600 dark:text-red-400" />
              </div>
            )}
            <h2 id="confirm-modal-title" className="text-xl font-bold text-gray-900 dark:text-white">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            aria-label="Close"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>
        <div className="p-6">
          <p className="text-gray-700 dark:text-gray-300 text-sm">{message}</p>
        </div>
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={
              isDanger
                ? 'px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg'
                : 'px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg'
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
