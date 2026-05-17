// NX-3 (#443) — Create Change Request modal. Single-screen modal. A CM change
// request targets a Configuration Item; the existing ChangeRequest model
// requires a source artefact, so the modal sources the CR from the picked
// CI's linked artefact (refType / refId). A CI with no linked source artefact
// cannot yet be the subject of a CR — the modal says so plainly.
import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import type { CreateChangeRequestDto } from 'shared/types/engineering.types'
import { configItemService } from '../../services/configItem.service'
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges'

interface CreateCRModalProps {
  isOpen: boolean
  onClose: () => void
  submitting?: boolean
  onCreate: (payload: CreateChangeRequestDto) => Promise<void> | void
}

const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const
// The source-artefact types the ChangeRequest model accepts.
const VALID_SOURCE_TYPES = new Set(['function', 'issue', 'parameter', 'requirement'])

export default function CreateCRModal({ isOpen, onClose, submitting, onCreate }: CreateCRModalProps) {
  const onDiscardRef = useRef<() => void>()
  const { markDirty, resetDirty, guardClose, warningDialog, draftBanner } = useUnsavedChanges(
    onClose,
    isOpen,
    () => onDiscardRef.current?.(),
  )
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<string>('medium')
  const [subjectCiId, setSubjectCiId] = useState('')
  const [justification, setJustification] = useState('')
  const [error, setError] = useState<string | null>(null)

  // CIs feed the subject picker — only items linked to a source artefact
  // qualify. Loaded lazily the first time the picker is opened.
  const [projectCis, setProjectCis] = useState<
    { id: string; ciKey: string; name: string; refType: string | null; refId: string | null }[]
  >([])

  onDiscardRef.current = () => {
    setTitle('')
    setDescription('')
    setPriority('medium')
    setSubjectCiId('')
    setJustification('')
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

  const subject = projectCis.find((c) => c.id === subjectCiId)
  const subjectLinked =
    !!subject && !!subject.refType && !!subject.refId && VALID_SOURCE_TYPES.has(subject.refType)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!subject) {
      setError('Pick the configuration item this change request targets.')
      return
    }
    if (!subjectLinked) {
      setError(
        `${subject.ciKey} is not linked to a source artefact. Link the CI to a requirement, ` +
          'function, parameter, or issue first, then raise the change request.',
      )
      return
    }
    try {
      await onCreate({
        title: title.trim(),
        description: description.trim(),
        sourceType: subject.refType as CreateChangeRequestDto['sourceType'],
        sourceId: subject.refId as string,
        priority: priority as CreateChangeRequestDto['priority'],
        justification: justification.trim() || undefined,
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
          <h2 className="text-xl font-semibold text-ink-primary">Create Change Request</h2>
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
            <label htmlFor="cr-title" className="mb-1 block text-sm font-medium text-ink-primary">
              Title *
            </label>
            <input
              id="cr-title"
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
            <label htmlFor="cr-subject" className="mb-1 block text-sm font-medium text-ink-primary">
              Subject configuration item *
            </label>
            <select
              id="cr-subject"
              value={subjectCiId}
              onClick={async () => {
                if (projectCis.length === 0) {
                  // Lazy-load the project CIs from the cache-less service the
                  // first time the picker is touched.
                  const projId = window.location.pathname.split('/projects/')[1]?.split('/')[0]
                  if (projId) {
                    const res = await configItemService.list(projId)
                    setProjectCis(
                      (res.data ?? []).map((c) => ({
                        id: c.id,
                        ciKey: c.ciKey,
                        name: c.name,
                        refType: c.refType,
                        refId: c.refId,
                      })),
                    )
                  }
                }
              }}
              onChange={(e) => {
                setSubjectCiId(e.target.value)
                markDirty()
              }}
              className="w-full rounded-sm border border-default bg-surface-base px-3 py-2 text-ink-primary"
            >
              <option value="">Select a configuration item...</option>
              {projectCis.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.ciKey} — {c.name}
                </option>
              ))}
            </select>
            {subject && !subjectLinked && (
              <p className="mt-1 text-xs text-status-warning">
                {subject.ciKey} has no linked source artefact. Link it on the CI detail panel first.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="cr-priority" className="mb-1 block text-sm font-medium text-ink-primary">
              Priority
            </label>
            <select
              id="cr-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full rounded-sm border border-default bg-surface-base px-3 py-2 capitalize text-ink-primary"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="cr-description" className="mb-1 block text-sm font-medium text-ink-primary">
              Description *
            </label>
            <textarea
              id="cr-description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
                markDirty()
              }}
              rows={3}
              className="w-full rounded-sm border border-default bg-surface-base px-3 py-2 text-ink-primary"
              required
            />
          </div>
          <div>
            <label htmlFor="cr-justification" className="mb-1 block text-sm font-medium text-ink-primary">
              Justification
            </label>
            <textarea
              id="cr-justification"
              value={justification}
              onChange={(e) => {
                setJustification(e.target.value)
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
              {submitting ? 'Creating...' : 'Create Change Request'}
            </button>
          </div>
        </form>
      </div>
      {warningDialog}
    </div>
  )
}
