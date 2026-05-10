import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma'
import { allocateUseCaseId } from '../lib/useCaseId'

export const getUseCases = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const useCases = await prisma.useCase.findMany({
      where: { projectId },
      orderBy: { useCaseId: 'asc' },
    })

    res.json({
      success: true,
      data: useCases,
    })
  } catch (error) {
    console.error('Get use cases error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const getUseCase = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, useCaseId } = req.params
    const useCase = await prisma.useCase.findFirst({
      where: {
        projectId,
        OR: [{ id: useCaseId }, { useCaseId: useCaseId }],
      },
    })

    if (!useCase) {
      return res.status(404).json({
        success: false,
        error: 'Use case not found',
      })
    }

    res.json({
      success: true,
      data: useCase,
    })
  } catch (error) {
    console.error('Get use case error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const createUseCase = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const {
      useCaseId: providedUseCaseId,
      name,
      description,
      actors,
      preconditions,
      postconditions,
      mainFlow,
      alternativeFlows,
      extensions,
      priority,
      complexity,
      status,
      relatedRequirementIds,
    } = req.body

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Name is required',
      })
    }

    // SECURITY (MEDIUM): allocate the use-case id under a per-project
    // advisory lock, mirroring lib/paramId.ts. Without this, two concurrent
    // POSTs would race and produce duplicate UC-NNN values.
    const useCase = await prisma.$transaction(async (tx) => {
      const finalUseCaseId = providedUseCaseId
        ? providedUseCaseId
        : await allocateUseCaseId(tx, projectId)

      if (providedUseCaseId) {
        const existing = await tx.useCase.findFirst({
          where: { projectId, useCaseId: finalUseCaseId },
        })
        if (existing) {
          throw new Error(`Use case ID "${finalUseCaseId}" already exists`)
        }
      }

      return tx.useCase.create({
        data: {
          projectId,
          useCaseId: finalUseCaseId,
          name,
          description: description || null,
          actors: actors || [],
          preconditions: preconditions || null,
          postconditions: postconditions || null,
          mainFlow: mainFlow || null,
          alternativeFlows: alternativeFlows && Array.isArray(alternativeFlows) ? JSON.stringify(alternativeFlows) : null,
          extensions: extensions && Array.isArray(extensions) ? JSON.stringify(extensions) : null,
          priority: priority || null,
          complexity: complexity || null,
          status: status || 'draft',
          relatedRequirementIds: relatedRequirementIds || [],
        },
      })
    })

    res.status(201).json({
      success: true,
      data: useCase,
    })
  } catch (error: any) {
    console.error('Create use case error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    })
  }
}

export const updateUseCase = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, useCaseId } = req.params
    const updateData = req.body

    const existing = await prisma.useCase.findFirst({
      where: {
        projectId,
        OR: [{ id: useCaseId }, { useCaseId: useCaseId }],
      },
    })

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Use case not found',
      })
    }

    const dataToUpdate: any = {}
    if (updateData.name !== undefined) dataToUpdate.name = updateData.name
    if (updateData.description !== undefined) dataToUpdate.description = updateData.description || null
    if (updateData.actors !== undefined) dataToUpdate.actors = updateData.actors
    if (updateData.preconditions !== undefined) dataToUpdate.preconditions = updateData.preconditions || null
    if (updateData.postconditions !== undefined) dataToUpdate.postconditions = updateData.postconditions || null
    if (updateData.mainFlow !== undefined) dataToUpdate.mainFlow = updateData.mainFlow || null
    if (updateData.alternativeFlows !== undefined) dataToUpdate.alternativeFlows = Array.isArray(updateData.alternativeFlows) ? JSON.stringify(updateData.alternativeFlows) : null
    if (updateData.extensions !== undefined) dataToUpdate.extensions = Array.isArray(updateData.extensions) ? JSON.stringify(updateData.extensions) : null
    if (updateData.priority !== undefined) dataToUpdate.priority = updateData.priority || null
    if (updateData.complexity !== undefined) dataToUpdate.complexity = updateData.complexity || null
    if (updateData.status !== undefined) dataToUpdate.status = updateData.status
    if (updateData.relatedRequirementIds !== undefined) dataToUpdate.relatedRequirementIds = updateData.relatedRequirementIds

    const updated = await prisma.useCase.update({
      where: { id: existing.id },
      data: dataToUpdate,
    })

    res.json({
      success: true,
      data: updated,
    })
  } catch (error: any) {
    console.error('Update use case error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    })
  }
}

export const deleteUseCase = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, useCaseId } = req.params

    const useCase = await prisma.useCase.findFirst({
      where: {
        projectId,
        OR: [{ id: useCaseId }, { useCaseId: useCaseId }],
      },
    })

    if (!useCase) {
      return res.status(404).json({
        success: false,
        error: 'Use case not found',
      })
    }

    await prisma.useCase.delete({
      where: { id: useCase.id },
    })

    res.json({
      success: true,
      message: 'Use case deleted successfully',
    })
  } catch (error: any) {
    console.error('Delete use case error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    })
  }
}

// Actor controllers
export const getActors = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const actors = await prisma.actor.findMany({
      where: { projectId },
      orderBy: { name: 'asc' },
    })

    res.json({
      success: true,
      data: actors,
    })
  } catch (error) {
    console.error('Get actors error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const createActor = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { name, type, description } = req.body

    if (!name || !type) {
      return res.status(400).json({
        success: false,
        error: 'Name and type are required',
      })
    }

    const existing = await prisma.actor.findFirst({
      where: {
        projectId,
        name,
      },
    })

    if (existing) {
      return res.status(400).json({
        success: false,
        error: `Actor "${name}" already exists in this project`,
      })
    }

    const actor = await prisma.actor.create({
      data: {
        projectId,
        name,
        type,
        description: description || null,
      },
    })

    res.status(201).json({
      success: true,
      data: actor,
    })
  } catch (error: any) {
    console.error('Create actor error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    })
  }
}

export const updateActor = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, actorId } = req.params
    const { name, type, description } = req.body

    const actor = await prisma.actor.findFirst({
      where: {
        projectId,
        id: actorId,
      },
    })

    if (!actor) {
      return res.status(404).json({
        success: false,
        error: 'Actor not found',
      })
    }

    const updated = await prisma.actor.update({
      where: { id: actor.id },
      data: {
        name: name !== undefined ? name : undefined,
        type: type !== undefined ? type : undefined,
        description: description !== undefined ? description : undefined,
      },
    })

    res.json({
      success: true,
      data: updated,
    })
  } catch (error: any) {
    console.error('Update actor error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    })
  }
}

export const deleteActor = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, actorId } = req.params

    const actor = await prisma.actor.findFirst({
      where: {
        projectId,
        id: actorId,
      },
    })

    if (!actor) {
      return res.status(404).json({
        success: false,
        error: 'Actor not found',
      })
    }

    await prisma.actor.delete({
      where: { id: actor.id },
    })

    res.json({
      success: true,
      message: 'Actor deleted successfully',
    })
  } catch (error: any) {
    console.error('Delete actor error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    })
  }
}
