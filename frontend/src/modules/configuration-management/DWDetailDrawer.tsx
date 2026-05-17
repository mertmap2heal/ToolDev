// NX-3 (#443) — Deviation / Waiver detail drawer. Hosts the CFR 21 Part 11
// sign-off ceremony: "Sign off" -> reauthDialog -> SignatureEvent write. Also
// the submit / close / reject transitions.
import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { X, AlertTriangle } from 'lucide-react'
import clsx from 'clsx'
import { authService } from '../../services/auth.service'
import { deviationWaiverService, type DeviationWaiver } from '../../services/deviationWaiver.service'
import { getDWStatusColor, getRiskLevelColor } from './constants'
import { cmReauthDialog, type CmReauthOutcome } from './useCmReauthDialog'

interface DWDetailDrawerProps {
  projectId: string
  dw: DeviationWaiver | null
  isOpen: boolean
  onClose: () => void
  onChanged: (updated: DeviationWaiver) => void
}

export default function DWDetailDrawer({
  projectId,
  dw,
  isOpen,
  onClose,
  onChanged,
}: DWDetailDrawerProps) {
  const [error, setError] = useState<string | null>(null)

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
    setError(null)
  }, [dw?.id])

  const submitMutation = useMutation({
    mutationFn: () => deviationWaiverService.update(projectId, dw!.id, { status: 'Submitted' }),
    onSuccess: (res) => res.data && onChanged(res.data),
    onError: (e: Error) => setError(e.message),
  })
  const closeMutation = useMutation({
    mutationFn: () => deviationWaiverService.close(projectId, dw!.id),
    onSuccess: (res) => res.data && onChanged(res.data),
    onError: (e: Error) => setError(e.message),
  })
  const rejectMutation = useMutation({
    mutationFn: () => deviationWaiverService.reject(projectId, dw!.id),
    onSuccess: (res) => res.data && onChanged(res.data),
    onError: (e: Error) => setError(e.message),
  })

  if (!dw) return null

  const busy = submitMutation.isPending || closeMutation.isPending || rejectMutation.isPending

  const runSignOff = async () => {
    setError(null)
    const ok = await cmReauthDialog({
      title: 'Sign off',
      message:
        `Signing this ${dw.type} is a signed engineering act under CFR 21 Part 11. ` +
        'Re-enter your password to sign.',
      confirmText: 'Sign off',
      verifyingText: 'Verifying password...',
      submittingText: 'Signing off...',
      onSubmit: async (password, signalSigning): Promise<CmReauthOutcome> => {
        const reauth = await authService.reauth(password)
        if (!reauth.success || !reauth.data) {
          return { ok: false, phase: 'reauth', message: reauth.error || 'Password verification failed.' }
        }
        signalSigning()
        const res = await deviationWaiverService.sign(projectId, dw.id, reauth.data.reauthToken)
        if (!res.success) {
          return {
            ok: false,
            phase: 'action',
            message: res.error || `Sign-off failed for ${dw.dwKey}.`,
          }
        }
        if (res.data) onChanged(res.data)
        return { ok: true }
      },
    })
    if (!ok) {
      // Cancelled or failed — the modal surfaced the message itself.
      return
    }
  }

  return (
    <div
      className={clsx(
        'fixed right-0 top-0 z-40 flex h-full flex-col overflow-hidden transition-all duration-200 ease-out',
        isOpen ? 'w-full min-w-[32rem] max-w-2xl' : 'w-0 min-w-0',
      )}
      style={{ height: 'calc(100vh - 4rem)', top: '4rem' }}
      role="region"
      aria-label="Deviation/Waiver details"
    >
      <div className="m-3 flex h-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-2xl border border-default bg-surface-raised shadow-2xl">
        <div className="flex flex-shrink-0 items-center justify-between border-b border-default bg-surface-inset px-6 py-4">
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm text-ink-muted">{dw.dwKey}</span>
              <span className="rounded-xs bg-surface-base px-2 py-0.5 text-xs text-ink-muted">{dw.type}</span>
              <span className={clsx('rounded-xs px-2 py-0.5 text-xs font-medium', getDWStatusColor(dw.status))}>
                {dw.status}
              </span>
              <span
                className={clsx('rounded-xs px-2 py-0.5 text-xs font-medium', getRiskLevelColor(dw.riskLevel))}
              >
                {dw.riskLevel}
              </span>
              {dw.authorityInvolved && (
                <span className="inline-flex items-center gap-1 rounded-xs bg-status-warning/12 px-1.5 py-0.5 text-xs text-status-warning">
                  <AlertTriangle size={12} />
                  Authority involved
                </span>
              )}
            </div>
            <h2 className="text-xl font-semibold text-ink-primary">{dw.title}</h2>
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
            <h3 className="mb-2 text-sm font-semibold text-ink-primary">Description</h3>
            <p className="whitespace-pre-wrap text-sm text-ink-muted">{dw.description || '—'}</p>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-ink-primary">Linked configuration items</h3>
            {dw.linkedConfigItemIds.length === 0 ? (
              <p className="text-sm text-ink-muted">None linked.</p>
            ) : (
              <ul className="list-inside list-disc font-mono text-sm text-ink-muted">
                {dw.linkedConfigItemIds.map((ref) => (
                  <li key={ref.itemId}>{ref.itemId}</li>
                ))}
              </ul>
            )}
          </section>

          {dw.validUntil && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-ink-primary">Valid until</h3>
              <p className="text-sm text-ink-muted">{new Date(dw.validUntil).toLocaleDateString()}</p>
            </section>
          )}

          <section>
            <h3 className="mb-2 text-sm font-semibold text-ink-primary">Decision notes</h3>
            <p className="text-sm text-ink-muted">{dw.decisionNotes || '—'}</p>
          </section>

          {dw.status === 'Approved' && dw.reviewTimestamp && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-ink-primary">Sign-off</h3>
              <p className="text-sm text-ink-muted">
                Signed {new Date(dw.reviewTimestamp).toLocaleString()}.
              </p>
            </section>
          )}

          {error && (
            <p role="alert" className="flex items-center gap-1.5 text-sm text-status-danger">
              <AlertTriangle size={14} />
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-shrink-0 flex-wrap gap-2 border-t border-default px-6 py-4">
          {dw.status === 'Draft' && (
            <button
              type="button"
              onClick={() => submitMutation.mutate()}
              disabled={busy}
              className="rounded-sm border border-default px-4 py-2 text-sm text-ink-primary hover:bg-surface-inset disabled:opacity-50"
            >
              Submit for review
            </button>
          )}
          {dw.status === 'Submitted' && (
            <>
              <button
                type="button"
                onClick={runSignOff}
                disabled={busy}
                className="rounded-sm bg-accent-primary px-4 py-2 text-sm text-white hover:bg-accent-primary-hover disabled:opacity-50"
              >
                Sign off
              </button>
              <button
                type="button"
                onClick={() => rejectMutation.mutate()}
                disabled={busy}
                className="rounded-sm border border-default px-4 py-2 text-sm text-status-danger hover:bg-surface-inset disabled:opacity-50"
              >
                Reject
              </button>
            </>
          )}
          {dw.status === 'Approved' && (
            <button
              type="button"
              onClick={() => closeMutation.mutate()}
              disabled={busy}
              className="rounded-sm border border-default px-4 py-2 text-sm text-ink-primary hover:bg-surface-inset disabled:opacity-50"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
