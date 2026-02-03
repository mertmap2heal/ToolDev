import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { Committee, CommitteeType, DefaultReviewerFor } from '../types'
import { useStakeholdersStore } from '../store'

const COMMITTEE_TYPES: CommitteeType[] = ['CCB', 'ReviewBoard', 'AuthorityInterface', 'SupplierPanel', 'ProgramGovernance']
const DEFAULT_REVIEWER_OPTIONS: DefaultReviewerFor[] = [
  'Baseline',
  'Release',
  'CertificationPackage',
  'SafetyGate',
  'VerificationReview',
]

interface CreateCommitteeModalProps {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

export default function CreateCommitteeModal({ isOpen, onClose, onSaved }: CreateCommitteeModalProps) {
  const { state, dispatch, nextGroupId } = useStakeholdersStore()
  const [name, setName] = useState('')
  const [type, setType] = useState<CommitteeType>('CCB')
  const [chair, setChair] = useState('')
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [defaultReviewersFor, setDefaultReviewersFor] = useState<DefaultReviewerFor[]>([])
  const [meetingCadence, setMeetingCadence] = useState('')
  const [notes, setNotes] = useState('')

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

  const toggleMember = (id: string) => {
    setMemberIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const toggleDefaultReviewer = (opt: DefaultReviewerFor) => {
    setDefaultReviewersFor((prev) =>
      prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const groupId = nextGroupId()
    const committee: Committee = {
      groupId,
      name,
      type,
      members: memberIds,
      chair: chair || undefined,
      defaultReviewersFor,
      meetingCadence: meetingCadence || 'TBD',
      notes: notes || undefined,
    }
    dispatch({ type: 'CREATE_GROUP', payload: committee })
    onSaved()
    onClose()
    setName('')
    setType('CCB')
    setChair('')
    setMemberIds([])
    setDefaultReviewersFor([])
    setMeetingCadence('')
    setNotes('')
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create Committee / Board</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>
        <form id="create-committee-form" onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as CommitteeType)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              {COMMITTEE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Chair</label>
            <select
              value={chair}
              onChange={(e) => setChair(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="">None</option>
              {state.stakeholders.map((s) => (
                <option key={s.stakeholderId} value={s.stakeholderId}>
                  {s.displayName} ({s.stakeholderId})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Members</label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {state.stakeholders.map((s) => (
                <label key={s.stakeholderId} className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={memberIds.includes(s.stakeholderId)}
                    onChange={() => toggleMember(s.stakeholderId)}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  {s.displayName}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Default reviewers for</label>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_REVIEWER_OPTIONS.map((opt) => (
                <label key={opt} className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={defaultReviewersFor.includes(opt)}
                    onChange={() => toggleDefaultReviewer(opt)}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  {opt}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Meeting cadence</label>
            <input
              type="text"
              value={meetingCadence}
              onChange={(e) => setMeetingCadence(e.target.value)}
              placeholder="e.g. Weekly Tue 10:00"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
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
            form="create-committee-form"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Create
          </button>
        </div>
        </form>
      </div>
    </div>
  )
}
