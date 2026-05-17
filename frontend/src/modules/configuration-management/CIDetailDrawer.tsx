// NX-3 (#443) — Configuration Item detail drawer. Canonical object panel
// (design-system §6.1): header (mono ID · type · status pill · lock pill),
// title, attribute grid, lifecycle-transition controls, lock/unlock actions.
import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { X, Shield, Lock, Unlock } from 'lucide-react'
import clsx from 'clsx'
import { configItemService, type ConfigItem } from '../../services/configItem.service'
import { getCIStatusColor, getCILockStateColor } from './constants'

interface CIDetailDrawerProps {
  projectId: string
  ci: ConfigItem | null
  isOpen: boolean
  onClose: () => void
  onChanged: (updated: ConfigItem) => void
  onDelete?: () => void
}

// IEEE 828 lifecycle: Draft -> InReview -> Released -> Obsolete. The button on
// each state names the next transition explicitly.
const NEXT_TRANSITION: Record<string, { to: string; label: string } | null> = {
  Draft: { to: 'InReview', label: 'Submit for review' },
  InReview: { to: 'Released', label: 'Release' },
  Released: { to: 'Obsolete', label: 'Mark obsolete' },
  Obsolete: null,
}

export default function CIDetailDrawer({
  projectId,
  ci,
  isOpen,
  onClose,
  onChanged,
  onDelete,
}: CIDetailDrawerProps) {
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      return () => document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, onClose])

  useEffect(() => {
    setActionError(null)
  }, [ci?.id])

  const transitionMutation = useMutation({
    mutationFn: (status: string) => configItemService.update(projectId, ci!.id, { status }),
    onSuccess: (res) => {
      if (res.data) onChanged(res.data)
    },
    onError: (e: Error) => setActionError(e.message),
  })
  const lockMutation = useMutation({
    mutationFn: () => configItemService.lock(projectId, ci!.id, 'FrozenByBaseline'),
    onSuccess: (res) => {
      if (res.data) onChanged(res.data)
    },
    onError: (e: Error) => setActionError(e.message),
  })
  const unlockMutation = useMutation({
    mutationFn: () => configItemService.unlock(projectId, ci!.id),
    onSuccess: (res) => {
      if (res.data) onChanged(res.data)
    },
    onError: (e: Error) => setActionError(e.message),
  })

  if (!ci) return null

  const transition = NEXT_TRANSITION[ci.status]
  const busy = transitionMutation.isPending || lockMutation.isPending || unlockMutation.isPending

  return (
    <div
      className={clsx(
        'fixed right-0 top-0 z-40 flex h-full flex-col overflow-hidden transition-all duration-200 ease-out',
        isOpen ? 'w-full min-w-[32rem] max-w-2xl' : 'w-0 min-w-0',
      )}
      style={{ height: 'calc(100vh - 4rem)', top: '4rem' }}
      role="region"
      aria-label="Configuration item details"
    >
      {/* Floating rounded card (kb/react-typescript.md drawer styling). */}
      <div className="m-3 flex h-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-2xl border border-default bg-surface-raised shadow-2xl">
        <div className="flex flex-shrink-0 items-center justify-between border-b border-default bg-surface-inset px-6 py-4">
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm text-ink-muted">{ci.ciKey}</span>
              <span className="rounded-xs bg-surface-base px-2 py-0.5 text-xs text-ink-muted">
                {ci.type}
              </span>
              <span className={clsx('rounded-xs px-2 py-0.5 text-xs font-medium', getCIStatusColor(ci.status))}>
                {ci.status}
              </span>
              <span
                className={clsx('rounded-xs px-2 py-0.5 text-xs font-medium', getCILockStateColor(ci.lockState))}
              >
                {ci.lockState}
              </span>
              {ci.safetyCritical && (
                <span className="inline-flex items-center gap-1 rounded-xs bg-status-warning/12 px-1.5 py-0.5 text-xs text-status-warning">
                  <Shield size={12} />
                  {ci.dal ?? 'Safety'}
                </span>
              )}
            </div>
            <h2 className="text-xl font-semibold text-ink-primary">{ci.name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-2 text-ink-muted hover:bg-surface-base"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          <section>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-ink-muted">Type</dt>
              <dd className="text-ink-primary">{ci.type}</dd>
              <dt className="text-ink-muted">Owner</dt>
              <dd className="text-ink-primary">{ci.ownerName ?? '—'}</dd>
              <dt className="text-ink-muted">Version</dt>
              <dd className="font-mono text-ink-primary">{ci.version}</dd>
              <dt className="text-ink-muted">Revision</dt>
              <dd className="font-mono text-ink-primary">{ci.revision}</dd>
              <dt className="text-ink-muted">Lock state</dt>
              <dd className="text-ink-primary">{ci.lockState}</dd>
              <dt className="text-ink-muted">DAL</dt>
              <dd className="text-ink-primary">{ci.dal ?? '—'}</dd>
              <dt className="text-ink-muted">Created</dt>
              <dd className="text-ink-primary">{new Date(ci.createdAt).toLocaleString()}</dd>
              <dt className="text-ink-muted">Updated</dt>
              <dd className="text-ink-primary">{new Date(ci.updatedAt).toLocaleString()}</dd>
            </dl>
            {ci.tags.length > 0 && (
              <div className="mt-3">
                <span className="text-sm text-ink-muted">Tags</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {ci.tags.map((t) => (
                    <span key={t} className="rounded-xs bg-surface-inset px-2 py-0.5 text-xs text-ink-muted">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          {(ci.refType || ci.refId) && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-ink-primary">Linked artefact</h3>
              <p className="text-sm text-ink-muted">
                <span className="font-mono">{ci.refType}</span>
                {' · '}
                <span className="font-mono">{ci.refId}</span>
              </p>
            </section>
          )}

          <section>
            <h3 className="mb-2 text-sm font-semibold text-ink-primary">Provenance</h3>
            <p className="text-sm text-ink-muted">
              Authored by {ci.authorType === 'human' ? 'a human engineer' : `AI (${ci.authorType})`} ·
              review status {ci.provenanceReviewStatus}.
            </p>
          </section>

          {actionError && (
            <p role="alert" className="text-sm text-status-danger">
              {actionError}
            </p>
          )}
        </div>

        <div className="flex flex-shrink-0 flex-wrap gap-2 border-t border-default px-6 py-4">
          {transition && (
            <button
              type="button"
              onClick={() => transitionMutation.mutate(transition.to)}
              disabled={busy}
              aria-label={transition.label}
              className="rounded-sm bg-accent-primary px-4 py-2 text-sm text-white hover:bg-accent-primary-hover disabled:opacity-50"
            >
              {transition.label}
            </button>
          )}
          {ci.lockState === 'Unlocked' ? (
            <button
              type="button"
              onClick={() => lockMutation.mutate()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-sm border border-default px-4 py-2 text-sm text-ink-primary hover:bg-surface-inset disabled:opacity-50"
            >
              <Lock size={14} />
              Lock CI
            </button>
          ) : (
            <button
              type="button"
              onClick={() => unlockMutation.mutate()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-sm border border-default px-4 py-2 text-sm text-ink-primary hover:bg-surface-inset disabled:opacity-50"
            >
              <Unlock size={14} />
              Unlock CI
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className="rounded-sm border border-default px-4 py-2 text-sm text-status-danger hover:bg-surface-inset disabled:opacity-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
