import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import type { Finding, FindingSeverity } from '../types'
import { useCertificationStore, useNextFindingId } from '../store'
import { useFocusTrap } from '../useFocusTrap'

interface CreateFindingModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (finding: Finding) => void
  initialLinkedObjectiveId?: string
}

const SEVERITIES: FindingSeverity[] = ['Minor', 'Major', 'Observation']

const MOCK_OWNERS = ['J. Smith', 'M. Chen', 'A. Lee', 'K. Park', 'L. Davis', 'T. Wilson']

export default function CreateFindingModal({
  isOpen,
  onClose,
  onCreate,
  initialLinkedObjectiveId,
}: CreateFindingModalProps) {
  const { state } = useCertificationStore()
  const nextFindingId = useNextFindingId()
  const [title, setTitle] = useState('')
  const [severity, setSeverity] = useState<FindingSeverity>('Minor')
  const [linkedObjectiveIds, setLinkedObjectiveIds] = useState<Set<string>>(
    initialLinkedObjectiveId ? new Set([initialLinkedObjectiveId]) : new Set()
  )
  const [notes, setNotes] = useState('')
  const [assignedTo, setAssignedTo] = useState(MOCK_OWNERS[0])
  const [dueDays, setDueDays] = useState(14)

  useEffect(() => {
    if (initialLinkedObjectiveId) {
      setLinkedObjectiveIds(new Set([initialLinkedObjectiveId]))
    }
  }, [initialLinkedObjectiveId])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      return () => document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, onClose])

  const containerRef = useRef<HTMLDivElement>(null)
  useFocusTrap(containerRef, isOpen)

  const toggleObjective = (objId: string) => {
    setLinkedObjectiveIds((prev) => {
      const next = new Set(prev)
      if (next.has(objId)) next.delete(objId)
      else next.add(objId)
      return next
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + dueDays)
    const finding: Finding = {
      findingId: nextFindingId(),
      title: title.trim(),
      severity,
      status: 'Open',
      linkedRegRef: null,
      linkedObjectives: Array.from(linkedObjectiveIds),
      linkedEvidence: [],
      assignedTo,
      dueDate: dueDate.toISOString(),
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
    }
    onCreate(finding)
    setTitle('')
    setSeverity('Minor')
    setLinkedObjectiveIds(new Set())
    setNotes('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-finding-modal-title"
    >
      <div
        ref={containerRef}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 id="create-finding-modal-title" className="text-xl font-bold text-gray-900 dark:text-white">
            Create Finding
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            aria-label="Close"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1">
          <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              placeholder="Finding title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Severity
            </label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as FindingSeverity)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Link to objectives
            </label>
            <div className="max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2 space-y-1">
              {state.objectives.map((obj) => (
                <label key={obj.objId} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={linkedObjectiveIds.has(obj.objId)}
                    onChange={() => toggleObjective(obj.objId)}
                    className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                  />
                  <span className="font-mono text-gray-600 dark:text-gray-400">{obj.objId}</span>
                  <span className="text-gray-700 dark:text-gray-300 truncate">{obj.title}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Assigned to
            </label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              {MOCK_OWNERS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Due in (days)
            </label>
            <input
              type="number"
              min={1}
              value={dueDays}
              onChange={(e) => setDueDays(parseInt(e.target.value, 10) || 14)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              placeholder="Optional notes"
            />
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
              type="submit"
              disabled={!title.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg"
            >
              Create Finding
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
