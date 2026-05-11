import { useState, useCallback } from 'react'

interface Toast {
  id: number
  kind: 'info' | 'success' | 'error'
  message: string
}

/**
 * Lightweight in-page toast — no global provider needed. Auto-dismisses
 * after 3 seconds. Used by inline mutations on the validation page so the
 * user sees a confirmation without leaving the row.
 */
export function useValidationToast() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((kind: Toast['kind'], message: string) => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, kind, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3000)
  }, [])
  const success = useCallback((m: string) => push('success', m), [push])
  const error = useCallback((m: string) => push('error', m), [push])
  const info = useCallback((m: string) => push('info', m), [push])
  return { toasts, success, error, info }
}

interface RendererProps {
  toasts: ReturnType<typeof useValidationToast>['toasts']
}
export function ValidationToastRenderer({ toasts }: RendererProps) {
  if (toasts.length === 0) return null
  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 60,
      }}
    >
      {toasts.map((t) => {
        const bg =
          t.kind === 'success'
            ? 'var(--pv-green-tint)'
            : t.kind === 'error'
            ? 'var(--pv-red-tint)'
            : 'var(--pv-blue-tint)'
        const fg =
          t.kind === 'success'
            ? 'var(--pv-green)'
            : t.kind === 'error'
            ? 'var(--pv-red)'
            : 'var(--pv-blue-ink)'
        return (
          <div
            key={t.id}
            role="status"
            style={{
              padding: '8px 14px',
              fontSize: 12.5,
              fontWeight: 500,
              background: bg,
              color: fg,
              border: `1px solid ${fg}33`,
              borderRadius: 6,
              boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
              maxWidth: 360,
            }}
          >
            {t.message}
          </div>
        )
      })}
    </div>
  )
}
