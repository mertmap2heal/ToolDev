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
        alignItems: 'flex-start',
        gap: 10,
        padding: '10px 14px',
        background: 'var(--pv-blue-tint)',
        border: '1px solid #B6DCFE',
        borderRadius: 6,
        fontSize: 12,
        color: 'var(--pv-blue-ink)',
      }}
    >
      <Info size={14} style={{ marginTop: 2, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontWeight: 600 }}>
          Validation answers to a stakeholder. Verification answers to a requirement.
        </p>
        <p style={{ margin: '4px 0 0', color: 'inherit', opacity: 0.85 }}>
          Use Validation to confirm the system meets stakeholder needs (demos, operational tests,
          stakeholder reviews). For low-level requirement compliance, use Verification.
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          background: 'none',
          border: 0,
          color: 'inherit',
          cursor: 'pointer',
          padding: 0,
          flexShrink: 0,
        }}
      >
        <X size={14} />
      </button>
    </div>
  )
}
