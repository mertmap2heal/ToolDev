import clsx from 'clsx'

interface LoadingSpinnerProps {
  /** Object being loaded — design-system.md §7: name the object, not "Loading...". */
  label?: string
  /** Compact form for inline/section use; default is a centred block. */
  inline?: boolean
  className?: string
}

/**
 * Shared loading state. design-system.md §5.4 / §7: name the object being
 * loaded; no spinning circle as the only signal. A minimal centred message —
 * pages that need a richer skeleton render their own.
 */
export default function LoadingSpinner({
  label = 'Loading…',
  inline = false,
  className,
}: LoadingSpinnerProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={clsx(
        'text-ink-muted text-sm',
        inline ? 'py-6' : 'text-center py-12',
        className,
      )}
    >
      {label}
    </div>
  )
}
