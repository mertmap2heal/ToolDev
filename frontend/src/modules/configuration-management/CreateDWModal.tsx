// NX-3 (#443) — Create Deviation / Waiver modal. Single-screen modal. The
// backend sets status Draft. A Waiver with no validUntil is permanent.
import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import {
  DW_TYPES,
  DW_RISK_LEVELS,
  type CreateDeviationWaiverPayload,
} from '../../services/deviationWaiver.service'
import { configItemService } from '../../services/configItem.service'
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges'

interface CreateDWModalProps {
  projectId: string
  isOpen: boolean
  onClose: () => void
  submitting?: boolean
  onCreate: (payload: CreateDeviationWaiverPayload) => Promise<void> | void
}

export default function CreateDWModal({
  projectId,
  isOpen,
  onClose,
  submitting,
  onCreate,
}: CreateDWModalProps) {
  const onDiscardRef = useRef<() => void>()
  const { markDirty, resetDirty, guardClose, warningDialog, draftBanner } = useUnsavedChanges(
    onClose,
    isOpen,
    () => onDiscardRef.current?.(),
  )
  const [type, setType] = useState<string>('Deviation')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [riskLevel, setRiskLevel] = useState<string>('Low')
  const [validUntil, setValidUntil] = useState('')
  const [authorityInvolved, setAuthorityInvolved] = useState(false)
  const [decisionNotes, setDecisionNotes] = useState('')
  const [linkedCiIds, setLinkedCiIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const { data: ciData } = useQuery({
    queryKey: ['cm', 'config-items', projectId],
    queryFn: async () => (await configItemService.list(projectId)).data ?? [],
    enabled: !!projectId && isOpen,
  })
  const cis = ciData ?? []

  onDiscardRef.current = () => {
    setType('Deviation')
    setTitle('')
    setDescription('')
    setRiskLevel('Low')
    setValidUntil('')
    setAuthorityInvolved(false)
    setDecisionNotes('')
    setLinkedCiIds(new Set())
    setError(null)
  }

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

  const toggleCi = (id: string) => {
    setLinkedCiIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    markDirty()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      await onCreate({
        type,
        title: title.trim(),
        description: description.trim(),
        riskLevel,
        validUntil: validUntil.trim() || null,
        authorityInvolved,
        decisionNotes: decisionNotes.trim(),
        linkedConfigItemIds: Array.from(linkedCiIds).map((id) => ({
          itemType: 'configItem',
          itemId: id,
        })),
      })
      onDiscardRef.current?.()
      resetDirty()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) guardClose()
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="mx-4 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-md border border-default bg-surface-raised"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-default p-6">
          <h2 className="text-xl font-semibold text-ink-primary">Create Deviation / Waiver</h2>
          <div className="flex items-center gap-2">
            {draftBanner}
            <button
              type="button"
              onClick={guardClose}
              aria-label="Close"
              className="rounded p-2 text-ink-muted hover:bg-surface-inset"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto p-6">
          <div>
            <label htmlFor="dw-type" className="mb-1 block text-sm font-medium text-ink-primary">
              Type
            </label>
            <select
              id="dw-type"
              value={type}
              onChange={(e) => {
                setType(e.target.value)
                markDirty()
              }}
              className="w-full rounded-sm border border-default bg-surface-base px-3 py-2 text-ink-primary"
            >
              {DW_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="dw-title" className="mb-1 block text-sm font-medium text-ink-primary">
              Title *
            </label>
            <input
              id="dw-title"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                markDirty()
              }}
              className="w-full rounded-sm border border-default bg-surface-base px-3 py-2 text-ink-primary"
              required
            />
          </div>
          <div>
            <label htmlFor="dw-description" className="mb-1 block text-sm font-medium text-ink-primary">
              Description
            </label>
            <textarea
              id="dw-description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
                markDirty()
              }}
              rows={2}
              className="w-full rounded-sm border border-default bg-surface-base px-3 py-2 text-ink-primary"
            />
          </div>
          <div>
            <label htmlFor="dw-risk" className="mb-1 block text-sm font-medium text-ink-primary">
              Risk level
            </label>
            <select
              id="dw-risk"
              value={riskLevel}
              onChange={(e) => setRiskLevel(e.target.value)}
              className="w-full rounded-sm border border-default bg-surface-base px-3 py-2 text-ink-primary"
            >
              {DW_RISK_LEVELS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="dw-valid-until" className="mb-1 block text-sm font-medium text-ink-primary">
              Valid until (leave blank for a permanent waiver)
            </label>
            <input
              id="dw-valid-until"
              type="date"
              value={validUntil}
              onChange={(e) => {
                setValidUntil(e.target.value)
                markDirty()
              }}
              className="w-full rounded-sm border border-default bg-surface-base px-3 py-2 text-ink-primary"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="dw-authority"
              checked={authorityInvolved}
              onChange={(e) => {
                setAuthorityInvolved(e.target.checked)
                markDirty()
              }}
              className="rounded border-default accent-accent-primary"
            />
            <label htmlFor="dw-authority" className="text-sm text-ink-primary">
              Authority involved
            </label>
          </div>
          <div>
            <span className="mb-1 block text-sm font-medium text-ink-primary">
              Linked configuration items
            </span>
            <div className="max-h-32 overflow-y-auto rounded-sm border border-default p-2">
              {cis.length === 0 ? (
                <p className="text-sm text-ink-faint">No configuration items in this project.</p>
              ) : (
                cis.map((c) => (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-2 py-1 text-sm text-ink-primary"
                  >
                    <input
                      type="checkbox"
                      checked={linkedCiIds.has(c.id)}
                      onChange={() => toggleCi(c.id)}
                      className="rounded border-default accent-accent-primary"
                    />
                    <span className="font-mono">{c.ciKey}</span>
                    <span className="truncate text-ink-muted">{c.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>
          <div>
            <label htmlFor="dw-notes" className="mb-1 block text-sm font-medium text-ink-primary">
              Decision notes
            </label>
            <textarea
              id="dw-notes"
              value={decisionNotes}
              onChange={(e) => {
                setDecisionNotes(e.target.value)
                markDirty()
              }}
              rows={2}
              className="w-full rounded-sm border border-default bg-surface-base px-3 py-2 text-ink-primary"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-status-danger">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={guardClose}
              className="rounded-sm border border-default px-4 py-2 text-ink-primary hover:bg-surface-inset"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-sm bg-accent-primary px-4 py-2 text-white hover:bg-accent-primary-hover disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Deviation / Waiver'}
            </button>
          </div>
        </form>
      </div>
      {warningDialog}
    </div>
  )
}
