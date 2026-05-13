import { useState, useCallback } from 'react'

interface ToastAction {
  label: string
  onClick: () => void
}
interface Toast {
  id: number
  kind: 'info' | 'success' | 'error'
  message: string
  action?: ToastAction
}

/**
 * Lightweight in-page toast — no global provider needed. Auto-dismisses
 * after 3 seconds (6 seconds when an action is attached so the user has
 * time to react). Used by inline mutations on the validation page so the
 * user sees a confirmation without leaving the row.
 */
export function useValidationToast() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])
  const push = useCallback(
    (kind: Toast['kind'], message: string, action?: ToastAction) => {
      const id = Date.now() + Math.random()
      setToasts((prev) => [...prev, { id, kind, message, action }])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, action ? 6000 : 3000)
      return id
    },
    [],
  )
  const success = useCallback(
    (m: string, action?: ToastAction) => push('success', m, action),
    [push],
  )
  const error = useCallback((m: string) => push('error', m), [push])
  const info = useCallback(
    (m: string, action?: ToastAction) => push('info', m, action),
    [push],
  )
  return { toasts, success, error, info, dismiss }
}

interface RendererProps {
  toasts: ReturnType<typeof useValidationToast>['toasts']
  onDismiss?: (id: number) => void
}
export function ValidationToastRenderer({ toasts, onDismiss }: RendererProps) {
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
              maxWidth: 380,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <span style={{ flex: 1 }}>{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action!.onClick()
                  onDismiss?.(t.id)
                }}
                style={{
                  background: 'transparent',
                  border: `1px solid ${fg}55`,
                  color: fg,
                  padding: '3px 10px',
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
