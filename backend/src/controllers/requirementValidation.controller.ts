import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma'
import { requirementValidationService } from '../services/requirementValidation.service'


export const validateRequirement = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, requirementId } = req.params

    // Get requirement from database

    const requirement = await prisma.requirement.findFirst({
      where: {
        projectId,
        OR: [{ id: requirementId }, { requirementId: requirementId }],
      },
      include: { moc: true },
    })

    if (!requirement) {
      return res.status(404).json({
        success: false,
        error: 'Requirement not found',
      })
    }

    const validation = await requirementValidationService.validateRequirement(requirement as any)

    res.json({
      success: true,
      data: validation,
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

    res.json({
      success: true,
      data: results,
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
