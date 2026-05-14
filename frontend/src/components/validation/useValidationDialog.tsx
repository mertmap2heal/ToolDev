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

interface OpenConfirm extends ConfirmSpec {
  kind: 'confirm'
  resolve: (value: boolean) => void
}
interface OpenPrompt extends PromptSpec {
  kind: 'prompt'
  resolve: (value: string | null) => void
}
type Open = OpenConfirm | OpenPrompt

// Pub-sub so a singleton <DialogHost /> mounted anywhere in the tree drives
// every imperative confirm()/prompt() call. Avoids context-provider plumbing
// and lets non-component callsites use the same API.
let listener: ((o: Open | null) => void) | null = null

function open(o: Open) {
  if (listener) listener(o)
  else {
    // Fallback: native dialog if host hasn't mounted yet.
    if (o.kind === 'confirm') o.resolve(window.confirm(`${o.title}\n\n${o.message ?? ''}`))
    else o.resolve(window.prompt(`${o.title}\n\n${o.message ?? ''}`, o.defaultValue) ?? null)
  }
}

export function confirmDialog(spec: ConfirmSpec): Promise<boolean> {
  return new Promise((resolve) => open({ kind: 'confirm', resolve, ...spec }))
}

export function promptDialog(spec: PromptSpec): Promise<string | null> {
  return new Promise((resolve) => open({ kind: 'prompt', resolve, ...spec }))
}

export function ValidationDialogHost() {
  const [current, setCurrent] = useState<Open | null>(null)
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const okRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    listener = (o) => {
      if (o && o.kind === 'prompt') setInputValue(o.defaultValue ?? '')
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
      } else okRef.current?.focus()
    }, 30)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (current.kind === 'confirm') current.resolve(false)
        else current.resolve(null)
        setCurrent(null)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [current])

  if (!current) return null

  const close = (value: boolean | string | null) => {
    if (!current) return
    if (current.kind === 'confirm') current.resolve(value as boolean)
    else current.resolve(value as string | null)
    setCurrent(null)
  }

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
