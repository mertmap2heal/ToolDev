import { Check, Lock } from 'lucide-react'
import type { WorkflowStep } from 'shared/types/workflow.types'
import clsx from 'clsx'

interface WorkflowStepperProps {
  steps: WorkflowStep[]
  currentStepId?: string
  onStepClick?: (stepId: string) => void
}

export default function WorkflowStepper({
  steps,
  currentStepId,
  onStepClick,
}: WorkflowStepperProps) {
  return (
    <div className="flex flex-col gap-4">
      {steps.map((step, index) => {
        const isActive = step.id === currentStepId
        const isCompleted = step.isCompleted
        const isLocked = step.isLocked

        return (
          <div
            key={step.id}
            className={clsx(
              'flex items-center gap-4 p-4 rounded-lg border-2 transition-colors',
              isActive
                ? 'border-blue-500 bg-blue-50'
                : isLocked
                ? 'border-gray-200 bg-gray-50 opacity-50'
                : 'border-gray-200 bg-white hover:border-gray-300 cursor-pointer'
            )}
            onClick={() => !isLocked && onStepClick?.(step.id)}
          >
            <div
              className={clsx(
                'w-10 h-10 rounded-full flex items-center justify-center font-semibold',
                isCompleted
                  ? 'bg-green-500 text-white'
                  : isActive
                  ? 'bg-blue-500 text-white'
                  : isLocked
                  ? 'bg-gray-300 text-gray-500'
                  : 'bg-gray-200 text-gray-600'
              )}
            >
              {isCompleted ? (
                <Check size={20} />
              ) : isLocked ? (
                <Lock size={20} />
              ) : (
                index + 1
              )}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">{step.title}</h3>
              <p className="text-sm text-gray-600">{step.description}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
