// NX-3 (#443) — Configuration Management reauthentication signing dialog.
//
// Mirrors the N-2.1 validation reauth modal (components/validation/
// useValidationDialog.tsx): a friction-by-design centred modal where the user
// re-enters their password to confirm a CFR 21 Part 11 electronic signature
// (CCB decision / deviation sign-off). The N-2.1 dialog is namespaced to the
// validation-page CSS scope, so the CM module hosts its own copy of the same
// two-phase pub-sub contract, styled with the design-system tokens (R-9).
//
// The confirm button is two-phase on one button:
//   (1) "Verifying password..." — the caller obtains a reauth token.
//   (2) "Recording decision..." / "Signing off..." — the caller fires the
//        gated request.
// onSubmit performs BOTH steps and reports which phase failed; the modal stays
// open on any error, clears + refocuses the password field, and disables
// Escape / backdrop dismiss mid-flight.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, AlertTriangle } from 'lucide-react'

type ReauthPhase = 'reauth' | 'action'

export type CmReauthOutcome =
  | { ok: true }
  | { ok: false; phase: ReauthPhase; message: string }

interface CmReauthSpec {
  /** Modal title. */
  title: string
  /** Body sentence — names the artefact + the Part 11 weight. */
  message: string
  /** Confirm button label when idle. */
  confirmText: string
  /** Confirm label while phase 1 (reauth) runs. */
  verifyingText?: string
  /** Confirm label while phase 2 (the signing request) runs. */
  submittingText?: string
  cancelText?: string
  /**
   * Runs both phases with the entered password. The caller invokes
   * `signalSigning()` immediately before it fires the phase-2 request, so the
   * modal flips the confirm button from "Verifying..." to the submitting
   * label. Resolves { ok:true } on success, or { ok:false, phase, message }.
   */
  onSubmit: (password: string, signalSigning: () => void) => Promise<CmReauthOutcome>
}

interface OpenReauth extends CmReauthSpec {
  // Resolves true once a signature completes, false if the user cancelled.
  resolve: (value: boolean) => void
}

// Pub-sub so a singleton <CmReauthDialogHost /> drives every imperative call.
let listener: ((o: OpenReauth | null) => void) | null = null

/**
 * Open the CM reauthentication signing modal. Resolves true once the signature
 * completes successfully, false if the user cancels.
 */
export function cmReauthDialog(spec: CmReauthSpec): Promise<boolean> {
  return new Promise((resolve) => {
    if (listener) listener({ ...spec, resolve })
    else resolve(false) // host not mounted — fail safe (no signature recorded).
  })
}

export function CmReauthDialogHost() {
  const [current, setCurrent] = useState<OpenReauth | null>(null)
  const [password, setPassword] = useState('')
  const [phase, setPhase] = useState<'idle' | ReauthPhase>('idle')
  const [error, setError] = useState<string | null>(null)
  const pwRef = useRef<HTMLInputElement | null>(null)

  const busy = phase !== 'idle'

  useEffect(() => {
    listener = (o) => {
      setPassword('')
      setPhase('idle')
      setError(null)
      setCurrent(o)
    }
    return () => {
      listener = null
    }
  }, [])

  useEffect(() => {
    if (!current) return
    const t = setTimeout(() => pwRef.current?.focus(), 30)
    const onKey = (e: KeyboardEvent) => {
      // No dismiss mid-signature — Escape is suppressed while a request runs.
      if (e.key === 'Escape' && !busy) {
        e.preventDefault()
        current.resolve(false)
        setCurrent(null)
      } else if (e.key === 'Escape') {
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [current, busy])

  if (!current) return null

  const close = (value: boolean) => {
    current.resolve(value)
    setCurrent(null)
  }

  const run = async () => {
    if (!password || busy) return
    setError(null)
    setPhase('reauth')
    let outcome: CmReauthOutcome
    try {
      outcome = await current.onSubmit(password, () => setPhase('action'))
    } catch (e) {
      outcome = {
        ok: false,
        phase: 'reauth',
        message: (e as Error).message || 'Could not verify your password.',
      }
    }
    if (outcome.ok) {
      close(true)
      return
    }
    setPhase('idle')
    setError(outcome.message)
    setPassword('')
    setTimeout(() => pwRef.current?.focus(), 20)
  }

  const confirmLabel =
    phase === 'reauth'
      ? current.verifyingText ?? 'Verifying password...'
      : phase === 'action'
        ? current.submittingText ?? 'Working...'
        : current.confirmText

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/45"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) close(false)
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cm-reauth-title"
        className="w-full max-w-md rounded-md border border-default bg-surface-raised"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-default px-6 py-4">
          <h2
            id="cm-reauth-title"
            className="text-base font-semibold text-ink-primary"
          >
            {current.title}
          </h2>
          <button
            type="button"
            onClick={() => !busy && close(false)}
            disabled={busy}
            aria-label="Close"
            className="rounded p-1 text-ink-muted hover:bg-surface-inset disabled:opacity-50"
          >
            <X size={14} />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void run()
          }}
        >
          <div className="flex flex-col gap-3 px-6 py-4">
            <p className="text-sm leading-relaxed text-ink-muted">{current.message}</p>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="cm-reauth-password"
                className="text-xs font-semibold text-ink-muted"
              >
                Password
              </label>
              <input
                id="cm-reauth-password"
                ref={pwRef}
                type="password"
                autoComplete="current-password"
                value={password}
                disabled={busy}
                onChange={(e) => setPassword(e.target.value)}
                className="h-8 w-full rounded-sm border border-default bg-surface-base px-2.5 text-sm text-ink-primary"
              />
            </div>
            {/* Error row — reserve height so the footer never jumps. */}
            <div role="alert" className="flex min-h-[16px] items-center gap-1.5 text-xs text-status-danger">
              {error && (
                <>
                  <AlertTriangle size={14} className="flex-shrink-0" />
                  <span>{error}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-default px-6 py-3">
            <button
              type="button"
              onClick={() => !busy && close(false)}
              disabled={busy}
              className="rounded-sm border border-default px-4 py-2 text-sm text-ink-primary hover:bg-surface-inset disabled:opacity-50"
            >
              {current.cancelText ?? 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={!password || busy}
              className="rounded-sm bg-accent-primary px-4 py-2 text-sm text-white hover:bg-accent-primary-hover disabled:opacity-50"
            >
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
