import React from 'react'
import clsx from 'clsx'
import { ChevronRight } from 'lucide-react'

interface LifecycleStep {
  id: string
  statusId: string
  order: number
}

interface StatusDefinition {
  id: string
  name: string
  color?: string
}

interface RequirementLifecycleVisualProps {
  steps: LifecycleStep[]
  statuses: StatusDefinition[]
  currentStatusId?: string
  className?: string
  /** Status IDs that are allowed transition targets (e.g. from lifecycle rules + permissions). */
  clickableTargetStatusIds?: string[]
  /** When set, steps whose statusId is in clickableTargetStatusIds (and not current) become buttons. */
  onTargetStepClick?: (statusId: string) => void
  /** Tooltip when a step is not clickable (optional). */
  disabledStepHint?: string
  /** Hide the inner "Lifecycle" heading when the parent already provides context. */
  hideLabel?: boolean
}

export function RequirementLifecycleVisual({
  steps,
  statuses,
  currentStatusId,
  className,
  clickableTargetStatusIds,
  onTargetStepClick,
  disabledStepHint = 'No transition to this status from your current role or lifecycle rules.',
  hideLabel = false,
}: RequirementLifecycleVisualProps) {
  const sortedSteps = [...steps].sort((a, b) => a.order - b.order)
  const currentIndex = sortedSteps.findIndex((s) => s.statusId === currentStatusId)
  const targets = clickableTargetStatusIds ?? []

  return (
    <div className={clsx(hideLabel ? '' : 'space-y-4', className)}>
      {!hideLabel && (
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Lifecycle</div>
      )}
      <div className="flex flex-wrap items-center gap-1">
        {sortedSteps.map((step, i) => {
          const status = statuses.find((s) => s.id === step.statusId)
          const isCurrent = step.statusId === currentStatusId
          const isPast = currentIndex !== -1 && i < currentIndex
          const canClick =
            Boolean(onTargetStepClick) &&
            targets.includes(step.statusId) &&
            !isCurrent

          const pillClass = clsx(
            'rounded-full px-2.5 py-0.5 text-xs font-medium',
            isCurrent
              ? 'bg-blue-600 text-white dark:bg-blue-500'
              : isPast
                ? 'bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
                : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
            canClick &&
              'cursor-pointer ring-1 ring-blue-400/60 hover:bg-blue-50 hover:text-blue-800 dark:hover:bg-blue-950/40 dark:hover:text-blue-200'
          )

          const label = status?.name || 'Unknown'

          return (
            <div key={step.id} className="flex items-center gap-1">
              {canClick ? (
                <button
                  type="button"
                  className={pillClass}
                  onClick={() => onTargetStepClick?.(step.statusId)}
                >
                  {label}
                </button>
              ) : (
                <span className={pillClass} title={!isCurrent && onTargetStepClick ? disabledStepHint : undefined}>
                  {label}
                </span>
              )}
              {i < sortedSteps.length - 1 && (
                <ChevronRight
                  size={14}
                  className="text-gray-400 dark:text-gray-500 shrink-0"
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
