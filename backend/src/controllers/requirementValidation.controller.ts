import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma'
import { requirementValidationService } from '../services/requirementValidation.service'
import { requirementQualityWorkbenchService } from '../services/requirementQualityWorkbench.service'


export const validateRequirement = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, requirementId } = req.params

    const [requirement, project] = await Promise.all([
      prisma.requirement.findFirst({
        where: {
          projectId,
          OR: [{ id: requirementId }, { requirementId: requirementId }],
        },
        include: { moc: true },
      }),
      prisma.project.findUnique({
        where: { id: projectId },
        select: { strictLifecycleGates: true },
      }),
    ])

    if (!requirement) {
      return res.status(404).json({
        success: false,
        error: 'Requirement not found',
      })
    }

    const strictLifecycleGates = project?.strictLifecycleGates ?? false
    const validation = await requirementValidationService.validateRequirement(
      requirement as any,
      { projectId, strictLifecycleGates }
    )

    const issueKeys = (validation.issues ?? []).map((i: { severity: string; message: string }) => `${i.severity}:${i.message}`)
    const currentSingle = { score: validation.score, issueKeys }
    const prevSnap = await requirementQualityWorkbenchService.getLatestSingleRequirementSnapshot(
      projectId,
      requirement.id
    )
    const prevPayload = prevSnap?.payload as { score?: number; issueKeys?: string[] } | undefined
    const previous =
      prevPayload && typeof prevPayload.score === 'number'
        ? { score: prevPayload.score, issueKeys: Array.isArray(prevPayload.issueKeys) ? prevPayload.issueKeys : [] }
        : null
    const compareSingle = requirementQualityWorkbenchService.compareSingleRequirement(
      previous,
      currentSingle,
      prevSnap?.capturedAt.toISOString()
    )

    await requirementQualityWorkbenchService.saveRequirementSnapshot(
      projectId,
      requirement.id,
      req.userId,
      currentSingle
    )

    res.json({
      success: true,
      data: { ...validation, compare: compareSingle },
    })
  } catch (error: any) {
    console.error('Validate requirement error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    })
  }
}

export const validateProjectRequirements = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params

    const results = await requirementValidationService.validateProjectRequirements(projectId)

    const currentPayload = requirementQualityWorkbenchService.buildPayloadFromProjectValidation({
      requirements: results.requirements.map((r) => ({
        requirementId: r.requirementId,
        validation: r.validation,
      })),
    })
    const previousRow = await requirementQualityWorkbenchService.getLatestFullProjectSnapshot(projectId)
    const prevPayload = previousRow?.payload as
      | { avgScore: number; requirements: Record<string, { score: number; issueKeys: string[] }> }
      | undefined
    const normalizedPrev =
      prevPayload && typeof prevPayload.avgScore === 'number' && prevPayload.requirements
        ? prevPayload
        : null
    const compare = requirementQualityWorkbenchService.comparePayloads(
      normalizedPrev,
      currentPayload,
      previousRow?.capturedAt.toISOString()
    )

    await requirementQualityWorkbenchService.saveFullProjectSnapshot(
      projectId,
      req.userId,
      currentPayload as Record<string, unknown>
    )

    res.json({
      success: true,
      data: { ...results, compare },
    })
  } catch (error: any) {
    console.error('Validate project requirements error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    })
  }
}

export const checkCircularDependencies = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params

    const circular = await requirementValidationService.checkCircularDependencies(projectId)

    res.json({
      success: true,
      data: circular,
    })
  } catch (error: any) {
    console.error('Check circular dependencies error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    })
  }
}

export const checkDuplicateIds = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params

    const duplicates = await requirementValidationService.checkDuplicateIds(projectId)

    res.json({
      success: true,
      data: duplicates,
    })
  } catch (error: any) {
    console.error('Check duplicate IDs error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    })
  }
}
