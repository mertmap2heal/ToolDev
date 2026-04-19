import { Sparkles } from 'lucide-react'
import clsx from 'clsx'

/**
 * Row / cell marker for objects whose last author was an AI model or an
 * accepted-but-not-yet-reviewed AI suggestion (ai-ready-vision.md §6.1).
 *
 * Deliberately neutral iconography (lucide Sparkles, same size as
 * other row icons) - the design system bans the sparkles-as-AI cue
 * elsewhere, but this is the provenance marker, not a feature teaser.
 * The badge is opinionated about review state to make the audit
 * question "what's been AI-modified and not yet reviewed?" a visual
 * answer, not a filter click.
 */
export type AuthorType = 'human' | 'ai_suggestion' | 'ai_accepted' | 'ai_applied'
export type ReviewStatus = 'drafted' | 'reviewed' | 'approved' | 'signed_off'

export default function AiDraftBadge({
  authorType,
  reviewStatus,
  size = 12,
}: {
  authorType: AuthorType
  reviewStatus: ReviewStatus
  size?: number
}) {
  if (authorType === 'human') return null

  const needsReview = reviewStatus === 'drafted'
  const label =
    authorType === 'ai_suggestion'
      ? 'AI draft'
      : authorType === 'ai_accepted'
        ? 'AI accepted'
        : 'AI applied'

  return (
    <span
      title={`${label} - review status: ${reviewStatus}`}
      className={clsx(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border',
        needsReview
          ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200'
          : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300',
      )}
    >
      <Sparkles size={size} />
      {label}
    </span>
  )
}
