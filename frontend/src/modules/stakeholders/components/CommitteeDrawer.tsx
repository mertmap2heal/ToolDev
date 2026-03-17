import { useEffect, useState } from 'react'
import { X, UserPlus, UserMinus, Play } from 'lucide-react'
import clsx from 'clsx'
import type { Committee, DefaultReviewerFor } from '../types'
import { useStakeholdersStore } from '../store'
import ConfirmModal from './ConfirmModal'

const DEFAULT_REVIEWER_OPTIONS: DefaultReviewerFor[] = [
  'Baseline',
  'Release',
  'CertificationPackage',
  'SafetyGate',
  'VerificationReview',
]

interface CommitteeDrawerProps {
  committee: Committee | null
  isOpen: boolean
  onClose: () => void
  onShowToast: (msg: string) => void
  canEdit: boolean
}

export default function CommitteeDrawer({
  committee,
  isOpen,
  onClose,
  onShowToast,
  canEdit,
}: CommitteeDrawerProps) {
  const { state, dispatch } = useStakeholdersStore()
  const [addMemberId, setAddMemberId] = useState('')
  const [removeConfirm, setRemoveConfirm] = useState<{ stakeholderId: string; name: string } | null>(null)

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      return () => document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, onClose])

  if (!committee) return null

  const getStakeholderName = (id: string) => state.stakeholders.find((s) => s.stakeholderId === id)?.displayName ?? id
  const availableToAdd = state.stakeholders.filter((s) => !committee.members.includes(s.stakeholderId))

  const handleAddMember = () => {
    if (!addMemberId) return
    dispatch({ type: 'ADD_MEMBER', payload: { groupId: committee.groupId, stakeholderId: addMemberId } })
    setAddMemberId('')
    onShowToast('Member added.')
  }

  const handleRemoveMember = (stakeholderId: string) => {
    dispatch({ type: 'REMOVE_MEMBER', payload: { groupId: committee.groupId, stakeholderId } })
    setRemoveConfirm(null)
    onShowToast('Member removed.')
  }

  const handleUpdateDefaultReviewers = (value: DefaultReviewerFor, checked: boolean) => {
    const next = checked
      ? [...committee.defaultReviewersFor, value]
      : committee.defaultReviewersFor.filter((x) => x !== value)
    dispatch({
      type: 'UPDATE_GROUP',
      payload: { ...committee, defaultReviewersFor: next },
    })
  }

  const handleStartReviewSession = () => {
    const commId = `COMM-${state.communicationLog.length + 1}`
    dispatch({
      type: 'CREATE_COMM',
      payload: {
        commId,
        type: 'ReviewRequest',
        audience: { type: 'Group', ref: committee.groupId },
        timestamp: new Date().toISOString(),
        summary: `Review session started for ${committee.name}`,
        createdBy: state.role,
      },
    })
    onShowToast('Review session started (placeholder). Communication log entry created.')
  }

  return (
    <>
      <div
        className={clsx(
          'h-full bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 ease-in-out overflow-hidden fixed right-0 top-0 z-40',
          isOpen ? 'w-full max-w-2xl min-w-[32rem]' : 'w-0 min-w-0'
        )}
        style={{ height: 'calc(100vh - 4rem)', top: '4rem' }}
        role="region"
        aria-label="Committee details"
      >
        <div className="flex flex-col h-full overflow-y-auto">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div>
              {committee.type === 'AuthorityInterface' && (
                <span className="inline-block px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded text-xs font-medium mb-2">
                  Authority Interface
                </span>
              )}
              <div className="font-mono text-sm text-gray-600 dark:text-gray-400">{committee.groupId}</div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{committee.name}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{committee.type}</p>
            </div>
            <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              <X size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>
          <div className="px-6 py-4 space-y-6">
            <section>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Chair</h3>
              <p className="text-sm text-gray-900 dark:text-white">
                {committee.chair ? getStakeholderName(committee.chair) : '—'}
              </p>
            </section>
            <section>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Members</h3>
              <ul className="space-y-2">
                {committee.members.map((id) => (
                  <li key={id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-900 dark:text-white">{getStakeholderName(id)}</span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setRemoveConfirm({ stakeholderId: id, name: getStakeholderName(id) })}
                        className="p-1 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                      >
                        <UserMinus size={14} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {canEdit && availableToAdd.length > 0 && (
                <div className="mt-3 flex gap-2">
                  <select
                    value={addMemberId}
                    onChange={(e) => setAddMemberId(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="">Add member…</option>
                    {availableToAdd.map((s) => (
                      <option key={s.stakeholderId} value={s.stakeholderId}>
                        {s.displayName} ({s.stakeholderId})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddMember}
                    disabled={!addMemberId}
                    className="flex items-center gap-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 text-sm"
                  >
                    <UserPlus size={14} /> Add
                  </button>
                </div>
              )}
            </section>
            <section>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Default reviewers for</h3>
              <div className="flex flex-wrap gap-3">
                {DEFAULT_REVIEWER_OPTIONS.map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={committee.defaultReviewersFor.includes(opt)}
                      onChange={(e) => handleUpdateDefaultReviewers(opt, e.target.checked)}
                      disabled={!canEdit}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </section>
            <section>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Meeting cadence</h3>
              <p className="text-sm text-gray-900 dark:text-white">{committee.meetingCadence}</p>
            </section>
            {committee.notes && (
              <section>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Notes</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">{committee.notes}</p>
              </section>
            )}
            <section>
              <button
                type="button"
                onClick={handleStartReviewSession}
                disabled={!canEdit}
                title={!canEdit ? 'Read-only or insufficient permissions' : undefined}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 text-sm"
              >
                <Play size={16} />
                Start Review Session
              </button>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Creates a Communication Log entry and audit event (placeholder).
              </p>
            </section>
          </div>
        </div>
      </div>
      <ConfirmModal
        isOpen={!!removeConfirm}
        title="Remove member"
        message={
          removeConfirm
            ? `Remove ${removeConfirm.name} from this committee?`
            : ''
        }
        confirmLabel="Remove"
        variant="danger"
        onConfirm={() => removeConfirm && handleRemoveMember(removeConfirm.stakeholderId)}
        onCancel={() => setRemoveConfirm(null)}
      />
    </>
  )
}
