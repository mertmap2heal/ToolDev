import { useState } from 'react'
import WorkflowStepper from '../../features/workflow/WorkflowStepper'
import AIGuidancePanel from '../../features/ai-guidance/AIGuidancePanel'
import { useWorkflowStore } from '../../store/workflowStore'
import { useQuery } from '@tanstack/react-query'
import { workflowService } from '../../services/workflow.service'
import { useParams } from 'react-router-dom'

export default function RequirementsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { progress, setProgress } = useWorkflowStore()

  const { data, isLoading } = useQuery({
    queryKey: ['workflow', projectId],
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID required')
      const response = await workflowService.getWorkflowProgress(projectId)
      if (response.success && response.data) {
        setProgress(response.data)
        return response.data
      }
      throw new Error(response.error || 'Failed to load workflow')
    },
    enabled: !!projectId,
  })

  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Requirements</h2>
          {progress && (
            <WorkflowStepper
              steps={progress.steps}
              currentStepId={progress.steps.find((s) => s.stage === 'requirements')?.id}
            />
          )}
          <div className="mt-6 bg-white border border-gray-200 rounded-lg p-6">
            <p className="text-gray-600">Requirements form will be implemented here</p>
          </div>
        </div>
        <div>
          {projectId && (
            <AIGuidancePanel projectId={projectId} stage="requirements" />
          )}
        </div>
      </div>
    </div>
  )
}
