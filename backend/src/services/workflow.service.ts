import { prisma } from '../lib/prisma'
// @ts-ignore
import type { WorkflowProgress, LifecycleStage } from '../../../shared/types/workflow.types'


const lifecycleStages: LifecycleStage[] = [
  'requirements',
  'system-functions',
  'architecture',
  'verification',
  'documentation',
]

export const getWorkflowProgress = async (projectId: string): Promise<WorkflowProgress> => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      requirements: true,
      functions: true,
      architectures: true,
      verifications: true,
      documents: true,
    },
  })

  if (!project) {
    throw new Error('Project not found')
  }

  const completedStages: LifecycleStage[] = []
  let currentStage: LifecycleStage = 'requirements'

  if (project.requirements.length > 0) {
    completedStages.push('requirements')
    currentStage = 'system-functions'
  }
  if (project.functions.length > 0) {
    completedStages.push('system-functions')
    currentStage = 'architecture'
  }
  if (project.architectures.length > 0) {
    completedStages.push('architecture')
    currentStage = 'verification'
  }
  if (project.verifications.length > 0) {
    completedStages.push('verification')
    currentStage = 'documentation'
  }
  if (project.documents.length > 0) {
    completedStages.push('documentation')
  }

  const steps = lifecycleStages.map((stage, index) => ({
    id: `step-${index + 1}`,
    stage,
    title: formatStageTitle(stage),
    description: `Complete ${formatStageTitle(stage)} stage`,
    order: index + 1,
    isCompleted: completedStages.includes(stage),
    isLocked: false, // All options are unlocked - users can access any stage
    dependencies: index > 0 ? [`step-${index}`] : undefined,
  }))

  const overallProgress = (completedStages.length / lifecycleStages.length) * 100

  return {
    projectId,
    currentStage,
    completedStages,
    steps,
    overallProgress: Math.round(overallProgress),
  }
}

function formatStageTitle(stage: LifecycleStage): string {
  const titles: Record<LifecycleStage, string> = {
    'requirements': 'Requirements',
    'system-functions': 'System Functions',
    'architecture': 'Architecture',
    'verification': 'Verification',
    'documentation': 'Documentation',
  }
  return titles[stage]
}
