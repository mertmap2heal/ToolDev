// NX-3 (#443) — Change Request detail drawer. Renders the CR plus its CCB
// decision ledger, and hosts the CCB decision ceremony: pick a decision +
// level + impacted CIs, then re-enter the password (reauthDialog) -> the
// service writes the CcbDecision, bumps every impacted CI version, and records
// a SignatureEvent — all in one transaction.
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, AlertTriangle, ShieldAlert } from 'lucide-react'
import clsx from 'clsx'
import type { ChangeRequest } from 'shared/types/engineering.types'
import { authService } from '../../services/auth.service'
import {
  ccbDecisionService,
  CCB_LEVELS,
  CCB_DECISIONS,
  type CcbDecision,
} from '../../services/ccbDecision.service'
import { configItemService } from '../../services/configItem.service'
import { getCRStatusColor, getCcbDecisionColor } from './constants'
import { cmReauthDialog, type CmReauthOutcome } from './useCmReauthDialog'

interface CRDetailDrawerProps {
  projectId: string
  cr: ChangeRequest | null
  decisions: CcbDecision[]
  isOpen: boolean
  onClose: () => void
  onCeremonyComplete: () => void
}

export default function CRDetailDrawer({
  projectId,
  cr,
  decisions,
  isOpen,
  onClose,
  onCeremonyComplete,
}: CRDetailDrawerProps) {
  const [ceremonyOpen, setCeremonyOpen] = useState(false)
  const [ccbLevel, setCcbLevel] = useState<string>('SystemCCB')
  const [decision, setDecision] = useState<string>('Approved')
  const [safetyImpact, setSafetyImpact] = useState(false)
  const [rationale, setRationale] = useState('')
  const [impactedCiIds, setImpactedCiIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  // The project's CIs feed the impacted-CI picker (only when the ceremony is open).
  const { data: ciData } = useQuery({
    queryKey: ['cm', 'config-items', projectId],
    queryFn: async () => (await configItemService.list(projectId)).data ?? [],
    enabled: !!projectId && ceremonyOpen,
  })
  const cis = ciData ?? []

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
    setCeremonyOpen(false)
    setError(null)
    setImpactedCiIds(new Set())
    setRationale('')
    setSafetyImpact(false)
  }, [cr?.id])

  if (!cr) return null

  const toggleCi = (id: string) => {
    setImpactedCiIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const runCeremony = async () => {
    setError(null)
    const ok = await cmReauthDialog({
      title: 'Record CCB decision',
      message:
        'Recording a CCB decision is a signed engineering act under CFR 21 Part 11. ' +
        'An approval bumps every impacted CI version. Re-enter your password to sign.',
      confirmText: 'Record CCB decision',
      verifyingText: 'Verifying password...',
      submittingText: 'Recording decision...',
      onSubmit: async (password, signalSigning): Promise<CmReauthOutcome> => {
        const reauth = await authService.reauth(password)
        if (!reauth.success || !reauth.data) {
          return { ok: false, phase: 'reauth', message: reauth.error || 'Password verification failed.' }
        }
        signalSigning()
        const res = await ccbDecisionService.sign(
          projectId,
          {
            changeRequestId: cr.id,
            ccbLevel,
            decision,
            safetyImpact,
            decisionRationale: rationale.trim(),
            impactedConfigItemIds: Array.from(impactedCiIds).map((id) => ({
              itemType: 'configItem',
              itemId: id,
            })),
          },
          reauth.data.reauthToken,
        )
        if (!res.success) {
          return { ok: false, phase: 'action', message: res.error || 'Failed to record the CCB decision.' }
        }
        return { ok: true }
      },
    })
    if (ok) {
      setCeremonyOpen(false)
      setImpactedCiIds(new Set())
      setRationale('')
      onCeremonyComplete()
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
      aria-label="Change request details"
    >
      <div className="m-3 flex h-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-2xl border border-default bg-surface-raised shadow-2xl">
        <div className="flex flex-shrink-0 items-center justify-between border-b border-default bg-surface-inset px-6 py-4">
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm text-ink-muted">{cr.crId ?? '—'}</span>
              <span
                className={clsx(
                  'rounded-xs px-2 py-0.5 text-xs font-medium capitalize',
                  getCRStatusColor(
                    cr.status === 'in-review'
                      ? 'UnderReview'
                      : cr.status.charAt(0).toUpperCase() + cr.status.slice(1),
                  ),
                )}
              >
                {cr.status}
              </span>
            </div>
            <h2 className="text-xl font-semibold text-ink-primary">{cr.title}</h2>
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
            <p className="whitespace-pre-wrap text-sm text-ink-muted">{cr.description}</p>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-ink-primary">CCB decision ledger</h3>
            {decisions.length === 0 ? (
              <p className="text-sm text-ink-muted">
                No CCB decisions recorded yet. Record one below to route this change through the board.
              </p>
            ) : (
              <ul className="space-y-2">
                {decisions.map((d) => (
                  <li
                    key={d.id}
                    className="rounded-sm border border-default bg-surface-base px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={clsx(
                          'rounded-xs px-2 py-0.5 text-xs font-medium',
                          getCcbDecisionColor(d.decision),
                        )}
                      >
                        {d.decision}
                      </span>
                      <span className="text-ink-muted">{d.ccbLevel}</span>
                      {d.safetyImpact && (
                        <span
                          className="inline-flex items-center gap-1 text-status-warning"
                          aria-label="Safety impact"
                        >
                          <ShieldAlert size={14} />
                          Safety impact
                        </span>
                      )}
                      {d.meaningCode && <span className="text-ink-faint">· {d.meaningCode}</span>}
                    </div>
                    {d.decisionRationale && (
                      <p className="mt-1 text-ink-muted">{d.decisionRationale}</p>
                    )}
                    {d.signedAt && (
                      <p className="mt-1 text-xs text-ink-faint">
                        Signed {new Date(d.signedAt).toLocaleString()}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {ceremonyOpen && (
            <section className="rounded-md border border-default bg-surface-base p-4">
              <h3 className="mb-3 text-sm font-semibold text-ink-primary">Record a CCB decision</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="ccb-level" className="mb-1 block text-xs font-medium text-ink-muted">
                    CCB level
                  </label>
                  <select
                    id="ccb-level"
                    value={ccbLevel}
                    onChange={(e) => setCcbLevel(e.target.value)}
                    className="w-full rounded-sm border border-default bg-surface-raised px-2 py-1.5 text-sm text-ink-primary"
                  >
                    {CCB_LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="ccb-decision" className="mb-1 block text-xs font-medium text-ink-muted">
                    Decision
                  </label>
                  <select
                    id="ccb-decision"
                    value={decision}
                    onChange={(e) => setDecision(e.target.value)}
                    className="w-full rounded-sm border border-default bg-surface-raised px-2 py-1.5 text-sm text-ink-primary"
                  >
                    {CCB_DECISIONS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-ink-primary">
                <input
                  type="checkbox"
                  checked={safetyImpact}
                  onChange={(e) => setSafetyImpact(e.target.checked)}
                  className="rounded border-default accent-accent-primary"
                />
                Safety-impacting change
              </label>
              <div className="mt-3">
                <label htmlFor="ccb-rationale" className="mb-1 block text-xs font-medium text-ink-muted">
                  Decision rationale
                </label>
                <textarea
                  id="ccb-rationale"
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  rows={2}
                  className="w-full rounded-sm border border-default bg-surface-raised px-2 py-1.5 text-sm text-ink-primary"
                />
              </div>
              <div className="mt-3">
                <span className="mb-1 block text-xs font-medium text-ink-muted">
                  Impacted configuration items (an approval bumps each one&apos;s version)
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
                          checked={impactedCiIds.has(c.id)}
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
              {error && (
                <p role="alert" className="mt-2 flex items-center gap-1.5 text-sm text-status-danger">
                  <AlertTriangle size={14} />
                  {error}
                </p>
              )}
            </section>
          )}
        </div>

        <div className="flex flex-shrink-0 flex-wrap gap-2 border-t border-default px-6 py-4">
          {ceremonyOpen ? (
            <>
              <button
                type="button"
                onClick={runCeremony}
                className="rounded-sm bg-accent-primary px-4 py-2 text-sm text-white hover:bg-accent-primary-hover"
              >
                Record CCB decision
              </button>
              <button
                type="button"
                onClick={() => setCeremonyOpen(false)}
                className="rounded-sm border border-default px-4 py-2 text-sm text-ink-primary hover:bg-surface-inset"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setCeremonyOpen(true)}
              className="rounded-sm bg-accent-primary px-4 py-2 text-sm text-white hover:bg-accent-primary-hover"
            >
              Record CCB decision
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
