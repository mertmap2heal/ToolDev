import { ChevronRight } from 'lucide-react'
import clsx from 'clsx'

export type LifecycleEntityType = 'TEST_CASE' | 'TEST_PLAN' | 'SETUP'

export interface LifecycleStage {
  value: string
  label: string
}

export interface LifecycleAction {
  label: string
  nextStatus: string
}

const CONFIG: Record<
  LifecycleEntityType,
  { stages: LifecycleStage[]; actions: Record<string, LifecycleAction[]> }
> = {
  TEST_CASE: {
    stages: [
      { value: 'DRAFT', label: 'Draft' },
      { value: 'REVIEWED', label: 'Reviewed' },
      { value: 'APPROVED', label: 'Approved' },
      { value: 'READY', label: 'Ready' },
    ],
    actions: {
      DRAFT: [{ label: 'Submit for review', nextStatus: 'REVIEWED' }],
      REVIEWED: [
        { label: 'Approve', nextStatus: 'APPROVED' },
        { label: 'Back to draft', nextStatus: 'DRAFT' },
      ],
      APPROVED: [{ label: 'Mark ready', nextStatus: 'READY' }],
      READY: [],
    },
  },
  TEST_PLAN: {
    stages: [
      { value: 'DRAFT', label: 'Draft' },
      { value: 'REVIEWED', label: 'Reviewed' },
      { value: 'APPROVED', label: 'Approved' },
      { value: 'ACTIVE', label: 'Active' },
      { value: 'CLOSED', label: 'Closed' },
    ],
    actions: {
      DRAFT: [{ label: 'Submit for review', nextStatus: 'REVIEWED' }],
      REVIEWED: [
        { label: 'Approve', nextStatus: 'APPROVED' },
        { label: 'Back to draft', nextStatus: 'DRAFT' },
      ],
      APPROVED: [{ label: 'Activate', nextStatus: 'ACTIVE' }],
      ACTIVE: [{ label: 'Close plan', nextStatus: 'CLOSED' }],
      CLOSED: [],
    },
  },
  SETUP: {
    stages: [
      { value: 'DRAFT', label: 'Draft' },
      { value: 'APPROVED', label: 'Approved' },
      { value: 'DEPRECATED', label: 'Deprecated' },
    ],
    actions: {
      DRAFT: [{ label: 'Approve', nextStatus: 'APPROVED' }],
      APPROVED: [{ label: 'Deprecate', nextStatus: 'DEPRECATED' }],
      DEPRECATED: [],
    },
  },
}

interface VerificationLifecycleProps {
  entityType: LifecycleEntityType
  currentStatus: string
  onTransition: (newStatus: string, actionLabel?: string) => void
  isTransitioning?: boolean
  className?: string
}

export default function VerificationLifecycle({
  entityType,
  currentStatus,
  onTransition,
  isTransitioning = false,
  className,
}: VerificationLifecycleProps) {
  const { stages, actions } = CONFIG[entityType]
  const currentIndex = stages.findIndex((s) => s.value === currentStatus)
  const allowedActions = actions[currentStatus] ?? []

  return (
    <div className={clsx('space-y-4', className)}>
      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Lifecycle
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {stages.map((stage, i) => (
          <div key={stage.value} className="flex items-center gap-1">
            <span
              className={clsx(
                'rounded-full px-2.5 py-0.5 text-xs font-medium',
                stage.value === currentStatus
                  ? 'bg-blue-600 text-white dark:bg-blue-500'
                  : i < currentIndex
                    ? 'bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300'
                    : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
              )}
            >
              {stage.label}
            </span>
            {i < stages.length - 1 && (
              <ChevronRight
                size={14}
                className="text-gray-400 dark:text-gray-500 shrink-0"
              />
            )}
          </div>
        ))}
      </div>
      {allowedActions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {allowedActions.map((a) => (
            <button
              key={a.nextStatus}
              type="button"
              onClick={() => onTransition(a.nextStatus, a.label)}
              disabled={isTransitioning}
              className={clsx(
                'px-3 py-1.5 text-sm rounded-lg transition-colors disabled:opacity-50',
                a.nextStatus === 'DRAFT' || a.label.toLowerCase().includes('back')
                  ? 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500'
                  : a.nextStatus === 'DEPRECATED' || a.label.toLowerCase().includes('deprecate')
                    ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50'
                    : a.nextStatus === 'CLOSED' || a.label.toLowerCase().includes('close')
                      ? 'bg-gray-600 text-white hover:bg-gray-700 dark:bg-gray-500 dark:hover:bg-gray-600'
                      : 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
              )}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
