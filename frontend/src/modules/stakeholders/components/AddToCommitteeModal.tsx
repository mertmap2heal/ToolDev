import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listCommittees,
  addCommitteeMember,
  type CommitteeRole,
} from '../../../services/stakeholders.service'

const COMMITTEE_ROLES: CommitteeRole[] = [
  'Chair',
  'Voting',
  'NonVoting',
  'Observer',
  'Secretary',
  'Auditor',
]

interface AddToCommitteeModalProps {
  projectId: string
  isOpen: boolean
  onClose: () => void
  /** Real user ids of the selected directory rows. */
  userIds: string[]
  onDone: () => void
}

/**
 * NX-8 (#463): bulk-add the selected directory users to a committee. React
 * Query-backed; each user is added as a seat with the chosen committeeRole.
 */
export default function AddToCommitteeModal({
  projectId,
  isOpen,
  onClose,
  userIds,
  onDone,
}: AddToCommitteeModalProps) {
  const qc = useQueryClient()
  const [committeeId, setCommitteeId] = useState('')
  const [committeeRole, setCommitteeRole] = useState<CommitteeRole>('Voting')
  const [error, setError] = useState<string | null>(null)

  const { data: committees = [] } = useQuery({
    queryKey: ['committees', projectId],
    queryFn: () => listCommittees(projectId),
    enabled: !!projectId && isOpen,
  })

  const addMut = useMutation({
    mutationFn: async () => {
      for (const userId of userIds) {
        await addCommitteeMember(projectId, committeeId, { userId, committeeRole })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['committees', projectId] })
      onDone()
      onClose()
      setCommitteeId('')
    },
    onError: (e: Error) => setError(e.message),
  })

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

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-surface-base rounded-lg border border-default w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-default">
          <h2 className="text-xl font-medium text-ink-primary">Add to committee</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-surface-inset rounded-sm"
            aria-label="Close"
          >
            <X size={18} className="text-ink-muted" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {error && (
            <p className="text-sm text-status-danger" role="alert">
              {error}
            </p>
          )}
          <p className="text-sm text-ink-muted">
            Adding {userIds.length} {userIds.length === 1 ? 'person' : 'people'} to the selected
            committee.
          </p>
          <div>
            <label className="block text-sm font-medium text-ink-primary mb-2">Committee</label>
            <select
              value={committeeId}
              onChange={(e) => setCommitteeId(e.target.value)}
              className="w-full px-3 py-2 border border-default rounded-sm bg-surface-base text-ink-primary text-sm"
            >
              <option value="">Select…</option>
              {committees.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-primary mb-2">Seat</label>
            <select
              value={committeeRole}
              onChange={(e) => setCommitteeRole(e.target.value as CommitteeRole)}
              className="w-full px-3 py-2 border border-default rounded-sm bg-surface-base text-ink-primary text-sm"
            >
              {COMMITTEE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="p-6 border-t border-default flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-default text-ink-primary rounded-sm hover:bg-surface-raised text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => committeeId && addMut.mutate()}
            disabled={!committeeId || addMut.isPending}
            className="px-4 py-2 bg-accent-primary hover:bg-accent-primary-hover text-white rounded-sm disabled:opacity-50 text-sm"
          >
            {addMut.isPending ? 'Adding…' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}
