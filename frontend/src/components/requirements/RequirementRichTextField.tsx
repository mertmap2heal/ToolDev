import clsx from 'clsx'

const LOOKS_LIKE_HTML = /<[a-z][\s\S]*>/i

/**
 * Renders requirement fields stored as HTML (e.g. TipTap) as real markup.
 * Otherwise renders plain text with newlines preserved.
 */
export default function RequirementRichTextField({
  value,
  className,
}: {
  value: string
  className?: string
}) {
  const trimmed = (value || '').trim()
  if (!trimmed) return null

  if (LOOKS_LIKE_HTML.test(trimmed)) {
    return (
      <div
        className={clsx(
          'prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300',
          'dark:prose-headings:text-gray-200 prose-p:my-1',
          className
        )}
        dangerouslySetInnerHTML={{ __html: trimmed }}
      />
    )
  }

  return (
    <p className={clsx('whitespace-pre-wrap leading-relaxed', className)}>
      {trimmed}
    </p>
  )
}
