import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createCommittee, type CommitteeKind } from '../../../services/stakeholders.service'
import { useUnsavedChanges } from '../../../hooks/useUnsavedChanges'

const COMMITTEE_KINDS: CommitteeKind[] = [
  'CCB',
  'ReviewBoard',
  'AuthorityInterface',
  'SupplierPanel',
  'ProgramGovernance',
]

interface CreateCommitteeModalProps {
  projectId: string
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
}

/**
 * NX-8 (#463): create a committee via the real backend. Members and default
 * reviewers are wired afterwards in the committee detail drawer.
 */
export default function CreateCommitteeModal({
  projectId,
  isOpen,
  onClose,
  onSaved,
}: CreateCommitteeModalProps) {
  const qc = useQueryClient()
  const onDiscardRef = useRef<() => void>()
  const { markDirty, resetDirty, guardClose, warningDialog, draftBanner } = useUnsavedChanges(
    onClose,
    isOpen,
    () => onDiscardRef.current?.()
  )
  const [name, setName] = useState('')
  const [kind, setKind] = useState<CommitteeKind>('CCB')
  const [meetingFrequency, setMeetingFrequency] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  onDiscardRef.current = () => {
    setName('')
    setKind('CCB')
    setMeetingFrequency('')
    setNotes('')
    setError(null)
  }

  const createMut = useMutation({
    mutationFn: () =>
      createCommittee(projectId, {
        name: name.trim(),
        kind,
        meetingFrequency: meetingFrequency.trim() || null,
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['committees', projectId] })
      onSaved()
      resetDirty()
      onClose()
      onDiscardRef.current?.()
    },
    onError: (e: Error) => setError(e.message),
  })

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') guardClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      return () => document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, guardClose])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    createMut.mutate()
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) guardClose()
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-surface-base rounded-lg border border-default w-full max-w-lg mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-default">
          <h2 className="text-xl font-medium text-ink-primary">Create committee / board</h2>
          <div className="flex items-center gap-2">
            {draftBanner}
            <button
              type="button"
              onClick={guardClose}
              className="p-2 hover:bg-surface-inset rounded-sm"
              aria-label="Close"
            >
              <X size={18} className="text-ink-muted" />
            </button>
          </div>
        </div>
        <form id="create-committee-form" onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            {error && (
              <p className="text-sm text-status-danger" role="alert">
                {error}
              </p>
            )}
            <div>
              <label className="block text-sm font-medium text-ink-primary mb-1">Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  markDirty()
                }}
                className="w-full px-3 py-2 border border-default rounded-sm bg-surface-base text-ink-primary text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-primary mb-1">Kind</label>
              <select
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value as CommitteeKind)
                  markDirty()
                }}
                className="w-full px-3 py-2 border border-default rounded-sm bg-surface-base text-ink-primary text-sm"
              >
                {COMMITTEE_KINDS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-primary mb-1">
                Meeting frequency
              </label>
              <input
                type="text"
                value={meetingFrequency}
                onChange={(e) => {
                  setMeetingFrequency(e.target.value)
                  markDirty()
                }}
                placeholder="e.g. Weekly Tue 10:00"
                className="w-full px-3 py-2 border border-default rounded-sm bg-surface-base text-ink-primary text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-primary mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value)
                  markDirty()
                }}
                rows={2}
                className="w-full px-3 py-2 border border-default rounded-sm bg-surface-base text-ink-primary text-sm"
              />
            </div>
            <p className="text-xs text-ink-faint">
              Add members and default reviewers after creating — open the committee from the list.
            </p>
          </div>
          <div className="p-6 border-t border-default flex justify-end gap-2">
            <button
              type="button"
              onClick={guardClose}
              className="px-4 py-2 border border-default text-ink-primary rounded-sm hover:bg-surface-raised text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-committee-form"
              disabled={createMut.isPending}
              className="px-4 py-2 bg-accent-primary hover:bg-accent-primary-hover text-white rounded-sm disabled:opacity-50 text-sm"
            >
              {createMut.isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
      {warningDialog}
    </div>
  )
}
