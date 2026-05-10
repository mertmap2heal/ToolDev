import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { requirementService } from '../../services/requirement.service'

interface Props {
  projectId: string
  requirementId: string
  /**
   * The element the user actually sees (a link, a key chip, the whole row).
   * Hovering it for ~150ms opens the card. The card stays open while the
   * cursor is over either the trigger or the card itself.
   */
  children: React.ReactNode
  /**
   * Optional fallback content shown immediately while the description is
   * still loading or if the requirement was deleted.
   */
  fallbackTitle?: string | null
  className?: string
}

/**
 * Hover preview for a requirement. Lazy-fetches the requirement once when
 * the trigger is first hovered and caches it via React Query, so repeated
 * hovers are free.
 */
export default function RequirementHoverCard({
  projectId,
  requirementId,
  children,
  fallbackTitle,
  className,
}: Props) {
  const [open, setOpen] = useState(false)
  const [primed, setPrimed] = useState(false)
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data } = useQuery({
    queryKey: ['requirement-hover', projectId, requirementId],
    enabled: primed,
    queryFn: async () => {
      const all = await requirementService.getAllRequirements(projectId)
      if (!all.success || !all.data) return null
      return all.data.find((r) => r.id === requirementId) ?? null
    },
    staleTime: 60_000,
  })

  useEffect(
    () => () => {
      if (openTimer.current) clearTimeout(openTimer.current)
      if (closeTimer.current) clearTimeout(closeTimer.current)
    },
    [],
  )

  const handleEnter = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setPrimed(true)
    openTimer.current = setTimeout(() => setOpen(true), 150)
  }
  const handleLeave = () => {
    if (openTimer.current) clearTimeout(openTimer.current)
    closeTimer.current = setTimeout(() => setOpen(false), 120)
  }

  return (
    <span
      className={`relative inline-flex ${className ?? ''}`}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}
      {open && (
        <div
          role="tooltip"
          className="absolute z-50 left-0 top-full mt-1 w-80 max-w-[90vw] bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-3 text-xs"
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-blue-700 dark:text-blue-300">
              {data?.requirementId ?? requirementId.slice(0, 8)}
            </span>
            {data?.priority && (
              <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                {data.priority}
              </span>
            )}
            {data?.status && (
              <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                {data.status}
              </span>
            )}
          </div>
          <p className="font-semibold text-gray-900 dark:text-white mb-1">
            {data?.title ?? fallbackTitle ?? 'Loading…'}
          </p>
          {data?.description && (
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap line-clamp-6">
              {data.description}
            </p>
          )}
          {data?.acceptanceCriteria && (
            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <p className="text-[10px] font-semibold uppercase text-gray-500 mb-0.5">
                Acceptance criteria
              </p>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap line-clamp-4">
                {data.acceptanceCriteria}
              </p>
            </div>
          )}
          {data === null && (
            <p className="text-gray-500 italic">Requirement not found (may be deleted).</p>
          )}
        </div>
      )}
    </span>
  )
}
