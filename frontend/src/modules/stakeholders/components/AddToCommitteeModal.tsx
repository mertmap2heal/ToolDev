import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useStakeholdersStore } from '../store'

interface AddToCommitteeModalProps {
  isOpen: boolean
  onClose: () => void
  stakeholderIds: string[]
  onDone: () => void
}

export default function AddToCommitteeModal({
  isOpen,
  onClose,
  stakeholderIds,
  onDone,
}: AddToCommitteeModalProps) {
  const { state, dispatch } = useStakeholdersStore()
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')

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

  const handleAdd = () => {
    if (!selectedGroupId || stakeholderIds.length === 0) return
    stakeholderIds.forEach((stakeholderId) => {
      dispatch({ type: 'ADD_MEMBER', payload: { groupId: selectedGroupId, stakeholderId } })
    })
    onDone()
    onClose()
    setSelectedGroupId('')
  }

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
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add to committee</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Adding {stakeholderIds.length} stakeholder(s) to the selected committee.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Committee</label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="">Select…</option>
              {state.committees.map((c) => (
                <option key={c.groupId} value={c.groupId}>
                  {c.name} ({c.groupId})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!selectedGroupId}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
