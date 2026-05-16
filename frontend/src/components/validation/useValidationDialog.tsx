import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, AlertTriangle } from 'lucide-react'

type Variant = 'default' | 'danger' | 'warning'

interface ConfirmSpec {
  title: string
  message?: string
  confirmText?: string
  cancelText?: string
  variant?: Variant
}

interface PromptSpec {
  title: string
  message?: string
  placeholder?: string
  defaultValue?: string
  confirmText?: string
  cancelText?: string
  inputLabel?: string
  allowEmpty?: boolean
}

/**
 * N-2.1 — CFR 21 Part 11 reauthentication signing dialog.
 *
 * A friction-by-design centred modal: the user re-enters their password to
 * confirm an electronic signature (sign-off or revoke). The modal owns the
 * two-phase lifecycle on one confirm button:
 *   (1) Verifying password... — the caller's onSubmit obtains a reauth token.
 *   (2) Signing off... / Revoking... — the caller fires the gated request.
 * onSubmit performs BOTH steps and reports back which phase failed; the modal
 * keeps itself open on any error, clears + refocuses the password field on a
 * wrong-password / timeout error, and disables Escape/backdrop mid-flight.
 */
type ReauthPhase = 'reauth' | 'action'
export type ReauthOutcome =
  | { ok: true }
  | { ok: false; phase: ReauthPhase; message: string }

interface ReauthSpec {
  title: string
  /** The body sentence — names the artefact + the Part 11 weight. */
  message: string
  /** Confirm button label when idle (e.g. "Sign off" / "Revoke sign-off"). */
  confirmText: string
  /** Confirm button label while phase 1 (reauth) is in flight. */
  verifyingText?: string
  /** Confirm button label while phase 2 (the signing request) is in flight. */
  submittingText?: string
  cancelText?: string
  /**
   * Runs both phases with the entered password. The caller invokes
   * `signalSigning()` immediately before it fires the phase-2 (signing)
   * request, so the modal flips the confirm button from "Verifying
   * password..." to "Signing off...". Resolves { ok:true } on a completed
   * sign-off / revoke, or { ok:false, phase, message } on failure.
   */
  onSubmit: (
    password: string,
    signalSigning: () => void,
  ) => Promise<ReauthOutcome>
}

interface OpenConfirm extends ConfirmSpec {
  kind: 'confirm'
  resolve: (value: boolean) => void
}
interface OpenPrompt extends PromptSpec {
  kind: 'prompt'
  resolve: (value: string | null) => void
}
interface OpenReauth extends ReauthSpec {
  kind: 'reauth'
  // Resolves true once a signature completes, false if the user cancelled.
  resolve: (value: boolean) => void
}
type Open = OpenConfirm | OpenPrompt | OpenReauth

// Pub-sub so a singleton <DialogHost /> mounted anywhere in the tree drives
// every imperative confirm()/prompt() call. Avoids context-provider plumbing
// and lets non-component callsites use the same API.
let listener: ((o: Open | null) => void) | null = null

function open(o: Open) {
  if (listener) listener(o)
  else {
    // Fallback: native dialog if host hasn't mounted yet.
    if (o.kind === 'confirm') o.resolve(window.confirm(`${o.title}\n\n${o.message ?? ''}`))
    else if (o.kind === 'prompt')
      o.resolve(window.prompt(`${o.title}\n\n${o.message ?? ''}`, o.defaultValue) ?? null)
    else o.resolve(false)
  }
}

export function confirmDialog(spec: ConfirmSpec): Promise<boolean> {
  return new Promise((resolve) => open({ kind: 'confirm', resolve, ...spec }))
}

export function promptDialog(spec: PromptSpec): Promise<string | null> {
  return new Promise((resolve) => open({ kind: 'prompt', resolve, ...spec }))
}

/**
 * Open the CFR 21 Part 11 reauthentication signing modal. Resolves true once
 * the signature completes successfully, false if the user cancels.
 */
export function reauthDialog(spec: ReauthSpec): Promise<boolean> {
  return new Promise((resolve) => open({ kind: 'reauth', resolve, ...spec }))
}

export function ValidationDialogHost() {
  const [current, setCurrent] = useState<Open | null>(null)
  const [inputValue, setInputValue] = useState('')
  // Reauth modal lifecycle. phase: idle | reauth | action.
  const [reauthPhase, setReauthPhase] = useState<'idle' | ReauthPhase>('idle')
  const [reauthError, setReauthError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const okRef = useRef<HTMLButtonElement | null>(null)
  const pwRef = useRef<HTMLInputElement | null>(null)

  const reauthBusy = reauthPhase !== 'idle'

  useEffect(() => {
    listener = (o) => {
      if (o && o.kind === 'prompt') setInputValue(o.defaultValue ?? '')
      if (o && o.kind === 'reauth') {
        setInputValue('')
        setReauthPhase('idle')
        setReauthError(null)
      }
      setCurrent(o)
    }
    return () => {
      listener = null
    }
  }, [])

  useEffect(() => {
    if (!current) return
    const t = setTimeout(() => {
      if (current.kind === 'prompt') {
        inputRef.current?.focus()
        inputRef.current?.select()
      } else if (current.kind === 'reauth') {
        pwRef.current?.focus()
      } else okRef.current?.focus()
    }, 30)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // N-2.1: no dismiss mid-signature — Escape is suppressed while a
        // reauth / signing request is in flight.
        if (current.kind === 'reauth' && reauthBusy) {
          e.preventDefault()
          return
        }
        e.preventDefault()
        if (current.kind === 'confirm') current.resolve(false)
        else if (current.kind === 'prompt') current.resolve(null)
        else current.resolve(false)
        setCurrent(null)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [current, reauthBusy])

  if (!current) return null

  const close = (value: boolean | string | null) => {
    if (!current) return
    if (current.kind === 'confirm') current.resolve(value as boolean)
    else if (current.kind === 'prompt') current.resolve(value as string | null)
    else current.resolve(value as boolean)
    setCurrent(null)
  }

  // ---- Reauth signing modal -------------------------------------------------
  if (current.kind === 'reauth') {
    const runReauthSubmit = async () => {
      if (!inputValue || reauthBusy) return
      setReauthError(null)
      setReauthPhase('reauth')
      let outcome: ReauthOutcome
      try {
        // Phase 1 starts now ("Verifying password..."). The caller calls
        // signalSigning() right before the phase-2 signing request, flipping
        // the button to "Signing off..." / "Revoking...".
        outcome = await current.onSubmit(inputValue, () => setReauthPhase('action'))
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
      // Failure: keep the modal open, surface the message, re-enable controls.
      setReauthPhase('idle')
      setReauthError(outcome.message)
      // Wrong password / timed-out token: clear + refocus the field.
      setInputValue('')
      setTimeout(() => pwRef.current?.focus(), 20)
    }

    const confirmLabel =
      reauthPhase === 'reauth'
        ? current.verifyingText ?? 'Verifying password...'
        : reauthPhase === 'action'
          ? current.submittingText ?? 'Working...'
          : current.confirmText

    return createPortal(
      <div
        className="params-v2 validation-v2 fixed inset-0 z-[60] flex items-center justify-center p-4"
        style={{ background: 'rgba(15,20,25,0.45)' }}
        onClick={(e) => {
          // Backdrop dismiss — disabled mid-flight.
          if (e.target === e.currentTarget && !reauthBusy) close(false)
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="validation-dialog-title"
          className="pv-drawer-shell"
          style={{ width: '100%', maxWidth: 440, margin: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="vv-dr-head">
            <span
              id="validation-dialog-title"
              style={{
                fontFamily: "'Fraunces', Georgia, serif",
                fontSize: 16,
                fontWeight: 500,
                letterSpacing: '-0.01em',
                color: 'var(--pv-fg)',
              }}
            >
              {current.title}
            </span>
            <div className="vv-dr-head-actions">
              <button
                type="button"
                onClick={() => !reauthBusy && close(false)}
                aria-label="Close"
                disabled={reauthBusy}
                className="pv-icon-btn"
                style={{ width: 26, height: 26 }}
              >
                <X size={14} />
              </button>
            </div>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void runReauthSubmit()
            }}
          >
            <div
              className="pv-dr-body"
              style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: 'var(--pv-fg-2)',
                  lineHeight: 1.55,
                }}
              >
                {current.message}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label
                  htmlFor="reauth-password"
                  style={{ fontSize: 11, fontWeight: 600, color: 'var(--pv-fg-2)' }}
                >
                  Password
                </label>
                <input
                  id="reauth-password"
                  ref={pwRef}
                  type="password"
                  autoComplete="current-password"
                  value={inputValue}
                  disabled={reauthBusy}
                  onChange={(e) => setInputValue(e.target.value)}
                  style={{
                    width: '100%',
                    height: 32,
                    padding: '0 10px',
                    fontSize: 13,
                    border: '1px solid var(--pv-line)',
                    borderRadius: 4,
                    background: 'var(--pv-bg)',
                    color: 'var(--pv-fg)',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
              {/* Error row — reserve its height so the footer never jumps. */}
              <div
                role="alert"
                style={{
                  minHeight: 16,
                  fontSize: 11,
                  color: 'var(--pv-red)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  lineHeight: 1.4,
                }}
              >
                {reauthError && (
                  <>
                    <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                    <span>{reauthError}</span>
                  </>
                )}
              </div>
            </div>
            <div className="pv-dr-foot">
              <div className="right" style={{ marginLeft: 'auto' }}>
                <button
                  type="button"
                  onClick={() => !reauthBusy && close(false)}
                  disabled={reauthBusy}
                  className="pv-dr-btn"
                >
                  {current.cancelText ?? 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={!inputValue || reauthBusy}
                  className="pv-dr-btn primary"
                  style={{
                    background: 'var(--pv-green)',
                    borderColor: 'var(--pv-green)',
                    color: '#fff',
                  }}
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>,
      document.body,
    )
  }

  // ---- Confirm / prompt modals ---------------------------------------------
  const variant: Variant = current.kind === 'confirm' ? current.variant ?? 'default' : 'default'
  const accentColor =
    variant === 'danger' ? 'var(--pv-red)' : variant === 'warning' ? 'var(--pv-amber)' : 'var(--pv-green)'
  const showIcon = variant !== 'default'

  return createPortal(
    <div
      className="params-v2 validation-v2 fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,20,25,0.45)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close(current.kind === 'confirm' ? false : null)
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="validation-dialog-title"
        className="pv-drawer-shell"
        style={{ width: '100%', maxWidth: 440, margin: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="vv-dr-head">
          <span
            id="validation-dialog-title"
            style={{
              fontFamily: "'Fraunces', Georgia, serif",
              fontSize: 16,
              fontWeight: 500,
              letterSpacing: '-0.01em',
              color: 'var(--pv-fg)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {showIcon && <AlertTriangle size={16} style={{ color: accentColor }} />}
            {current.title}
          </span>
          <div className="vv-dr-head-actions">
            <button
              type="button"
              onClick={() => close(current.kind === 'confirm' ? false : null)}
              aria-label="Close"
              className="pv-icon-btn"
              style={{ width: 26, height: 26 }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
        <div className="pv-dr-body" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {current.message && (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--pv-fg-2)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
              {current.message}
            </p>
          )}
          {current.kind === 'prompt' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {current.inputLabel && (
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--pv-fg-2)' }}>{current.inputLabel}</label>
              )}
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (inputValue.trim() || current.allowEmpty)) {
                    e.preventDefault()
                    close(inputValue)
                  }
                }}
                placeholder={current.placeholder}
                style={{
                  width: '100%',
                  height: 32,
                  padding: '0 10px',
                  fontSize: 13,
                  border: '1px solid var(--pv-line)',
                  borderRadius: 4,
                  background: 'var(--pv-bg)',
                  color: 'var(--pv-fg)',
                  fontFamily: 'inherit',
                }}
              />
            </div>
          )}
        </div>
        <div className="pv-dr-foot">
          <div className="right" style={{ marginLeft: 'auto' }}>
            <button
              type="button"
              onClick={() => close(current.kind === 'confirm' ? false : null)}
              className="pv-dr-btn"
            >
              {current.cancelText ?? 'Cancel'}
            </button>
            <button
              ref={okRef}
              type="button"
              onClick={() => {
                if (current.kind === 'confirm') close(true)
                else if (inputValue.trim() || current.allowEmpty) close(inputValue)
              }}
              disabled={
                current.kind === 'prompt' && !inputValue.trim() && !current.allowEmpty
              }
              className={`pv-dr-btn primary${variant === 'danger' ? ' danger' : ''}`}
            >
              {current.confirmText ?? (current.kind === 'prompt' ? 'OK' : 'Confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
