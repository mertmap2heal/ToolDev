// NX-3 (#443) — Create Configuration Item modal. Single-screen modal
// (design-system §2.4 one decision per screen). Opinionated defaults (§2.1):
// the backend sets status Draft / lockState Unlocked / version 0.1.0.
import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { CI_TYPES, type CreateConfigItemPayload } from '../../services/configItem.service'
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges'

interface CreateCIModalProps {
  isOpen: boolean
  onClose: () => void
  submitting?: boolean
  onCreate: (payload: CreateConfigItemPayload) => Promise<void> | void
}

const DAL_OPTIONS = ['A', 'B', 'C', 'D', 'E'] as const

export default function CreateCIModal({ isOpen, onClose, submitting, onCreate }: CreateCIModalProps) {
  const onDiscardRef = useRef<() => void>()
  const { markDirty, resetDirty, guardClose, warningDialog, draftBanner } = useUnsavedChanges(
    onClose,
    isOpen,
    () => onDiscardRef.current?.(),
  )
  const [name, setName] = useState('')
  const [type, setType] = useState<string>('Requirement')
  const [ownerName, setOwnerName] = useState('')
  const [safetyCritical, setSafetyCritical] = useState(false)
  const [dal, setDal] = useState<string>('')
  const [tagsText, setTagsText] = useState('')
  const [error, setError] = useState<string | null>(null)

  onDiscardRef.current = () => {
    setName('')
    setType('Requirement')
    setOwnerName('')
    setSafetyCritical(false)
    setDal('')
    setTagsText('')
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const tags = tagsText.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean)
    try {
      await onCreate({
        name: name.trim(),
        type,
        ownerName: ownerName.trim() || null,
        safetyCritical,
        dal: dal || null,
        tags,
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
        className="mx-4 w-full max-w-md rounded-md border border-default bg-surface-raised"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-default p-6">
          <h2 className="text-xl font-semibold text-ink-primary">Create Configuration Item</h2>
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
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label htmlFor="ci-name" className="mb-1 block text-sm font-medium text-ink-primary">
              Name *
            </label>
            <input
              id="ci-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                markDirty()
              }}
              className="w-full rounded-sm border border-default bg-surface-base px-3 py-2 text-ink-primary"
              required
            />
          </div>
          <div>
            <label htmlFor="ci-type" className="mb-1 block text-sm font-medium text-ink-primary">
              Type
            </label>
            <select
              id="ci-type"
              value={type}
              onChange={(e) => {
                setType(e.target.value)
                markDirty()
              }}
              className="w-full rounded-sm border border-default bg-surface-base px-3 py-2 text-ink-primary"
            >
              {CI_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ci-owner" className="mb-1 block text-sm font-medium text-ink-primary">
              Owner
            </label>
            <input
              id="ci-owner"
              type="text"
              value={ownerName}
              onChange={(e) => {
                setOwnerName(e.target.value)
                markDirty()
              }}
              className="w-full rounded-sm border border-default bg-surface-base px-3 py-2 text-ink-primary"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ci-safety-critical"
              checked={safetyCritical}
              onChange={(e) => {
                setSafetyCritical(e.target.checked)
                markDirty()
              }}
              className="rounded border-default accent-accent-primary"
            />
            <label htmlFor="ci-safety-critical" className="text-sm text-ink-primary">
              Safety-critical
            </label>
          </div>
          {safetyCritical && (
            <div>
              <label htmlFor="ci-dal" className="mb-1 block text-sm font-medium text-ink-primary">
                DAL
              </label>
              <select
                id="ci-dal"
                value={dal}
                onChange={(e) => setDal(e.target.value)}
                className="w-full rounded-sm border border-default bg-surface-base px-3 py-2 text-ink-primary"
              >
                <option value="">—</option>
                {DAL_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="ci-tags" className="mb-1 block text-sm font-medium text-ink-primary">
              Tags (comma or space separated)
            </label>
            <input
              id="ci-tags"
              type="text"
              value={tagsText}
              onChange={(e) => {
                setTagsText(e.target.value)
                markDirty()
              }}
              placeholder="e.g. flight-control, pdr"
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
              {submitting ? 'Creating...' : 'Create CI'}
            </button>
          </div>
        </form>
      </div>
      {warningDialog}
    </div>
  )
}
