import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface AIGuidanceRequest {
  projectId: string
  stage: string
  context: string
  prompt: string
}

interface AIGuidanceResponse {
  guidance: string
  suggestions: string[]
  nextSteps: string[]
}

export const aiService = {
  async getGuidance(request: AIGuidanceRequest): Promise<AIGuidanceResponse> {
    const { projectId, stage, context, prompt } = request

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        requirements: true,
        functions: true,
        architectures: true,
        verifications: true,
      },
    })

    if (!project) {
      throw new Error('Project not found')
    }

    const stageContext = getStageContext(project, stage)

    const guidance = generateGuidance(stage, stageContext, context, prompt)
    const suggestions = generateSuggestions(stage, stageContext)
    const nextSteps = generateNextSteps(stage, stageContext)

    return {
      guidance,
      suggestions,
      nextSteps,
    }
  },
}

function getStageContext(project: any, stage: string): any {
  switch (stage) {
    case 'requirements':
      return {
        count: project.requirements.length,
        items: project.requirements,
      }
    case 'system-functions':
      return {
        count: project.functions.length,
        items: project.functions,
        requirements: project.requirements,
      }
    case 'architecture':
      return {
        count: project.architectures.length,
        items: project.architectures,
        functions: project.functions,
      }
    case 'verification':
      return {
        count: project.verifications.length,
        items: project.verifications,
        requirements: project.requirements,
      }
    default:
      return {}
  }
}

function generateGuidance(
  stage: string,
  stageContext: any,
  context: string,
  prompt: string
): string {
  const stageGuidance: Record<string, string> = {
    requirements:
      'Start by identifying all functional and non-functional requirements. Ensure each requirement is specific, measurable, and testable. Consider stakeholder needs and system constraints.',
    'system-functions':
      'Derive system functions from your requirements. Each function should address one or more requirements. Ensure functions are clearly defined and can be implemented.',
    architecture:
      'Design the system architecture based on your functions. Consider component relationships, interfaces, and system boundaries. Ensure the architecture supports all required functions.',
    verification:
      'Create verification plans for each requirement. Define test cases, acceptance criteria, and validation methods. Ensure traceability from requirements to verification.',
  }

  return stageGuidance[stage] || 'Continue working through the engineering lifecycle stages.'
}

function generateSuggestions(stage: string, stageContext: any): string[] {
  const suggestions: Record<string, string[]> = {
    requirements: [
      'Break down high-level requirements into detailed specifications',
      'Categorize requirements by priority and type',
      'Ensure all requirements are traceable',
    ],
    'system-functions': [
      'Map functions to originating requirements',
      'Define function interfaces and behaviors',
      'Consider function dependencies and interactions',
    ],
    architecture: [
      'Define component boundaries and responsibilities',
      'Specify interfaces between components',
      'Consider scalability and maintainability',
    ],
    verification: [
      'Create test cases for each requirement',
      'Define acceptance criteria',
      'Plan verification methods (testing, analysis, inspection)',
    ],
  }

  return suggestions[stage] || []
}

function generateNextSteps(stage: string, stageContext: any): string[] {
  const nextSteps: Record<string, string[]> = {
    requirements: [
      'Review and validate all requirements',
      'Proceed to System Functions stage',
      'Link requirements to system functions',
    ],
    'system-functions': [
      'Validate function completeness',
      'Proceed to Architecture stage',
      'Map functions to architectural components',
    ],
    architecture: [
      'Validate architecture design',
      'Proceed to Verification stage',
      'Create verification plans',
    ],
    verification: [
      'Complete verification plans',
      'Generate documentation',
      'Review traceability matrix',
    ],
  }

  return nextSteps[stage] || []
}
