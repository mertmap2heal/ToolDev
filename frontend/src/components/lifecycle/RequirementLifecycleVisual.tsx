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
}

export function RequirementLifecycleVisual({
    steps,
    statuses,
    currentStatusId,
    className,
}: RequirementLifecycleVisualProps) {
    // Sort steps by order
    const sortedSteps = [...steps].sort((a, b) => a.order - b.order)

    // Find current step index
    const currentIndex = sortedSteps.findIndex((s) => s.statusId === currentStatusId)

    return (
        <div className={clsx('space-y-4', className)}>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Lifecycle
            </div>
            <div className="flex flex-wrap items-center gap-1">
                {sortedSteps.map((step, i) => {
                    const status = statuses.find((s) => s.id === step.statusId)
                    const isCurrent = step.statusId === currentStatusId
                    const isPast = currentIndex !== -1 && i < currentIndex

                    return (
                        <div key={step.id} className="flex items-center gap-1">
                            <span
                                className={clsx(
                                    'rounded-full px-2.5 py-0.5 text-xs font-medium',
                                    isCurrent
                                        ? 'bg-blue-600 text-white dark:bg-blue-500'
                                        : isPast
                                            ? 'bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
                                            : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                                )}
                            >
                                {status?.name || 'Unknown'}
                            </span>
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
