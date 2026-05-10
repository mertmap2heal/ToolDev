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
    <div className="rounded-lg border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 flex items-start gap-3">
      <Info size={18} className="mt-0.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
      <div className="flex-1 text-sm">
        <p className="font-semibold text-blue-900 dark:text-blue-200">
          Validation answers to a stakeholder. Verification answers to a requirement.
        </p>
        <p className="mt-1 text-blue-800 dark:text-blue-300">
          Use Validation to confirm the system meets stakeholder needs (demos, operational tests,
          stakeholder reviews). For low-level requirement compliance, use the Verification module.
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
      >
        <X size={16} />
      </button>
    </div>
  )
}
