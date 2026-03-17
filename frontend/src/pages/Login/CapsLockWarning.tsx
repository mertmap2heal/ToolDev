interface CapsLockWarningProps {
  show: boolean
}

export default function CapsLockWarning({ show }: CapsLockWarningProps) {
  if (!show) return null
  return (
    <p
      id="capslock-warning"
      className="mt-1 text-sm text-amber-600 dark:text-amber-400"
      role="status"
      aria-live="polite"
    >
      Caps Lock is on
    </p>
  )
}
