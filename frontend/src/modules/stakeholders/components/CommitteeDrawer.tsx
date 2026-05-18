import { useEffect, useState } from 'react'
import { X, UserPlus, UserMinus } from 'lucide-react'
import clsx from 'clsx'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  addCommitteeMember,
  removeCommitteeMember,
  setDefaultReviewer,
  unsetDefaultReviewer,
  type Committee,
  type CommitteeRole,
  type BaselineKind,
} from '../../../services/stakeholders.service'
import { getProjectUsersWithRoles } from '../../../services/stakeholderRoles.service'
import ConfirmModal from './ConfirmModal'

// The six per-committee organisational seats (NX-8: a FOURTH role concept,
// distinct from engineering / admin / simulation roles).
const COMMITTEE_ROLES: CommitteeRole[] = [
  'Chair',
  'Voting',
  'NonVoting',
  'Observer',
  'Secretary',
  'Auditor',
]
const BASELINE_KINDS: BaselineKind[] = ['VER', 'CERT', 'PARAM', 'VALIDATION', 'CM']

interface CommitteeDrawerProps {
  projectId: string
  committee: Committee | null
  isOpen: boolean
  onClose: () => void
  onShowToast: (msg: string) => void
  canEdit: boolean
}

/**
 * NX-8 (#463): the committee detail panel — design-system.md §6.1 object panel.
 * Members are grouped into a seat grid by `committeeRole`; the default-reviewer
 * baselineKind set is its own section. React Query-backed; tokens only.
 */
export default function CommitteeDrawer({
  projectId,
  committee,
  isOpen,
  onClose,
  onShowToast,
  canEdit,
}: CommitteeDrawerProps) {
  const qc = useQueryClient()
  const [addUserId, setAddUserId] = useState('')
  const [addRole, setAddRole] = useState<CommitteeRole>('Voting')
  const [removeConfirm, setRemoveConfirm] = useState<{ memberId: string; name: string } | null>(null)

  const { data: users = [] } = useQuery({
    queryKey: ['project', projectId, 'usersWithRoles'],
    queryFn: () => getProjectUsersWithRoles(projectId),
    enabled: !!projectId && isOpen,
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

  const invalidate = () => qc.invalidateQueries({ queryKey: ['committees', projectId] })

  const addMemberMut = useMutation({
    mutationFn: (input: { userId: string; committeeRole: CommitteeRole }) =>
      addCommitteeMember(projectId, committee!.id, input),
    onSuccess: () => {
      invalidate()
      setAddUserId('')
      onShowToast('Member added.')
    },
    onError: (e: Error) => onShowToast(e.message),
  })

  const removeMemberMut = useMutation({
    mutationFn: (memberId: string) => removeCommitteeMember(projectId, committee!.id, memberId),
    onSuccess: () => {
      invalidate()
      setRemoveConfirm(null)
      onShowToast('Member removed.')
    },
    onError: (e: Error) => onShowToast(e.message),
  })

  const setReviewerMut = useMutation({
    mutationFn: (kind: BaselineKind) => setDefaultReviewer(projectId, committee!.id, kind),
    onSuccess: () => {
      invalidate()
      onShowToast('Default reviewer updated.')
    },
    onError: (e: Error) => onShowToast(e.message),
  })

  const unsetReviewerMut = useMutation({
    mutationFn: (reviewerId: string) => unsetDefaultReviewer(projectId, committee!.id, reviewerId),
    onSuccess: () => {
      invalidate()
      onShowToast('Default reviewer updated.')
    },
    onError: (e: Error) => onShowToast(e.message),
  })

  if (!committee) return null

  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? id
  const userRoleChips = (id: string) => users.find((u) => u.id === id)?.engineeringRoles ?? []
  const memberUserIds = new Set(committee.members.map((m) => m.userId))
  const availableUsers = users.filter((u) => !memberUserIds.has(u.id))
  const wiredKinds = new Set(committee.defaultReviewers.map((r) => r.baselineKind))

  return (
    <>
      <div
        className={clsx(
          'h-full bg-surface-base shadow-md border-l border-default flex flex-col transition-all duration-200 ease-out overflow-hidden fixed right-0 top-0 z-40',
          isOpen ? 'w-full max-w-2xl min-w-[32rem]' : 'w-0 min-w-0'
        )}
        style={{ height: 'calc(100vh - 4rem)', top: '4rem' }}
        role="region"
        aria-label="Committee details"
      >
        <div className="flex flex-col h-full overflow-y-auto">
          {/* §6.1 object-panel header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-default bg-surface-raised">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-ink-muted">{committee.id.slice(0, 8)}</span>
                <span className="px-2 py-0.5 rounded-xs text-xs font-medium bg-surface-inset text-ink-muted">
                  {committee.kind}
                </span>
              </div>
              <h2 className="mt-1 text-xl font-medium text-ink-primary">{committee.name}</h2>
              {committee.meetingFrequency && (
                <p className="text-sm text-ink-muted">Cadence: {committee.meetingFrequency}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-surface-inset rounded-sm"
              aria-label="Close committee details"
            >
              <X size={18} className="text-ink-muted" />
            </button>
          </div>

          <div className="px-6 py-4 space-y-6">
            {/* Seat grid — members grouped by committeeRole */}
            <section>
              <h3 className="text-sm font-semibold text-ink-muted uppercase mb-3">Seats</h3>
              {committee.members.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  No members yet. Add a chair and voting members so this committee can route
                  approvals.
                </p>
              ) : (
                <div className="space-y-4">
                  {COMMITTEE_ROLES.map((role) => {
                    const seats = committee.members.filter((m) => m.committeeRole === role)
                    if (seats.length === 0) return null
                    return (
                      <div key={role} className="space-y-1">
                        <h4 className="text-xs font-medium text-ink-faint uppercase">{role}</h4>
                        <ul className="space-y-1">
                          {seats.map((m) => (
                            <li
                              key={m.id}
                              className="flex items-center justify-between text-sm py-1"
                            >
                              <span className="flex items-center gap-2">
                                <span className="text-ink-primary">{userName(m.userId)}</span>
                                {userRoleChips(m.userId).map((r) => (
                                  <span
                                    key={r.id}
                                    className="px-1.5 py-0.5 rounded-xs text-xs bg-surface-inset text-ink-muted"
                                  >
                                    {r.name}
                                  </span>
                                ))}
                              </span>
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setRemoveConfirm({ memberId: m.id, name: userName(m.userId) })
                                  }
                                  className="p-1 text-status-danger hover:bg-surface-inset rounded-sm"
                                  aria-label={`Remove ${userName(m.userId)}`}
                                >
                                  <UserMinus size={14} />
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              )}
              {canEdit && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <select
                    value={addUserId}
                    onChange={(e) => setAddUserId(e.target.value)}
                    className="flex-1 min-w-[12rem] px-3 py-2 border border-default rounded-sm bg-surface-base text-ink-primary text-sm"
                  >
                    <option value="">Add member…</option>
                    {availableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={addRole}
                    onChange={(e) => setAddRole(e.target.value as CommitteeRole)}
                    className="px-3 py-2 border border-default rounded-sm bg-surface-base text-ink-primary text-sm"
                    aria-label="Committee seat"
                  >
                    {COMMITTEE_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      addUserId && addMemberMut.mutate({ userId: addUserId, committeeRole: addRole })
                    }
                    disabled={!addUserId || addMemberMut.isPending}
                    className="flex items-center gap-1 px-3 py-2 bg-accent-primary hover:bg-accent-primary-hover text-white rounded-sm disabled:opacity-50 text-sm"
                  >
                    <UserPlus size={14} /> Add
                  </button>
                </div>
              )}
            </section>

            {/* Default reviewers */}
            <section>
              <h3 className="text-sm font-semibold text-ink-muted uppercase mb-3">
                Default reviewers
              </h3>
              <p className="text-xs text-ink-faint mb-2">
                Baseline kinds this committee reviews by default.
              </p>
              <div className="flex flex-wrap gap-3">
                {BASELINE_KINDS.map((kind) => {
                  const reviewer = committee.defaultReviewers.find((r) => r.baselineKind === kind)
                  const wired = wiredKinds.has(kind)
                  return (
                    <label
                      key={kind}
                      className="flex items-center gap-2 text-sm text-ink-primary"
                    >
                      <input
                        type="checkbox"
                        checked={wired}
                        disabled={!canEdit || setReviewerMut.isPending || unsetReviewerMut.isPending}
                        onChange={(e) => {
                          if (e.target.checked) setReviewerMut.mutate(kind)
                          else if (reviewer) unsetReviewerMut.mutate(reviewer.id)
                        }}
                        className="rounded-sm border-default"
                      />
                      {kind}
                    </label>
                  )
                })}
              </div>
            </section>

            {committee.notes && (
              <section>
                <h3 className="text-sm font-semibold text-ink-muted uppercase mb-2">Notes</h3>
                <p className="text-sm text-ink-muted">{committee.notes}</p>
              </section>
            )}
          </div>
        </div>
      </div>
      <ConfirmModal
        isOpen={!!removeConfirm}
        title="Remove member"
        message={removeConfirm ? `Remove ${removeConfirm.name} from this committee?` : ''}
        confirmLabel="Remove"
        variant="danger"
        onConfirm={() => removeConfirm && removeMemberMut.mutate(removeConfirm.memberId)}
        onCancel={() => setRemoveConfirm(null)}
      />
    </>
  )
}
