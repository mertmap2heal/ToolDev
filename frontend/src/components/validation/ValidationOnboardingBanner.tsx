import { useState, useEffect } from 'react'
import { Info, X } from 'lucide-react'

const STORAGE_KEY = 'validation:onboarding-dismissed'

/**
 * First-visit dismissible banner clarifying the boundary between Validation
 * (stakeholder-need confirmation) and Verification (requirement compliance).
 * Dismissal persists in localStorage. The banner does not re-appear once
 * dismissed; clearing localStorage shows it again.
 */
export default function ValidationOnboardingBanner() {
  const [dismissed, setDismissed] = useState<boolean>(true)

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY) === 'true')
    } catch {
      setDismissed(false)
    }
  }, [])

  if (dismissed) return null

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch { /* ignore */ }
    setDismissed(true)
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        background: 'var(--pv-surface-soft)',
        border: '1px solid var(--pv-line)',
        borderLeft: '2px solid var(--pv-blue)',
        borderRadius: 4,
        fontSize: 12,
        color: 'var(--pv-fg-2)',
      }}
    >
      <Info size={12} style={{ flexShrink: 0, color: 'var(--pv-blue)' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 500, color: 'var(--pv-fg)' }}>
          Validation answers to a stakeholder; Verification answers to a requirement.
        </span>{' '}
        <span style={{ color: 'var(--pv-fg-3)' }}>
          Use this page for demos, operational tests, and stakeholder reviews — not low-level
          requirement compliance.
        </span>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          background: 'none',
          border: 0,
          color: 'var(--pv-fg-3)',
          cursor: 'pointer',
          padding: 0,
          flexShrink: 0,
        }}
      >
        <X size={12} />
      </button>
    </div>
  )
}
