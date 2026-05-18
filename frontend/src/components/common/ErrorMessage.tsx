import clsx from 'clsx'

interface ErrorMessageProps {
  /** The error to surface — quote the exact failure (design-system.md §5.4). */
  message: string
  /** Compact form for inline/section use; default is a centred block. */
  inline?: boolean
  className?: string
}

/**
 * Shared error state. design-system.md §5.4: quote the exact error; engineer
 * voice, no "Something went wrong". A minimal danger-toned message — callers
 * pass a sentence that names the cause and a next action.
 */
export default function ErrorMessage({
  message,
  inline = false,
  className,
}: ErrorMessageProps) {
  return (
    <div
      role="alert"
      className={clsx(
        'text-status-danger text-sm',
        inline ? 'py-6' : 'text-center py-12',
        className,
      )}
    >
      {message}
    </div>
  )
}
