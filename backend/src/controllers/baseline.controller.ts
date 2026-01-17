import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Get all baselines for a project
 */
export const getBaselines = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params

    const baselines = await prisma.baseline.findMany({
      where: { projectId },
      include: {
        _count: {
          select: { items: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const formattedBaselines = baselines.map((baseline) => ({
      id: baseline.id,
      projectId: baseline.projectId,
      name: baseline.name,
      description: baseline.description,
      status: baseline.status,
      createdBy: baseline.createdBy,
      createdByName: baseline.createdByName,
      lockedAt: baseline.lockedAt?.toISOString(),
      itemCount: baseline._count.items,
      createdAt: baseline.createdAt.toISOString(),
      updatedAt: baseline.updatedAt.toISOString(),
    }))

    res.json({
      success: true,
      data: formattedBaselines,
    })
  } catch (error) {
    console.error('Get baselines error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

/**
 * Get a specific baseline with its items
 */
export const getBaseline = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, baselineId } = req.params

    const baseline = await prisma.baseline.findFirst({
      where: { id: baselineId, projectId },
      include: {
        items: true,
        _count: {
          select: { items: true },
        },
      },
    })

    if (!baseline) {
      return res.status(404).json({
        success: false,
        error: 'Baseline not found',
      })
    }

    res.json({
      success: true,
      data: {
        ...baseline,
        lockedAt: baseline.lockedAt?.toISOString(),
        itemCount: baseline._count.items,
        createdAt: baseline.createdAt.toISOString(),
        updatedAt: baseline.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Get baseline error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

/**
 * Create a new baseline by snapshotting all current requirements
 */
export const createBaseline = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { name, description } = req.body

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Baseline name is required',
      })
    }

    // Get all requirements for the project
    const requirements = await prisma.requirement.findMany({
      where: { projectId },
      include: {
        comments: true,
        attachments: true,
      },
    })

    // Create baseline and items in a transaction
    const baseline = await prisma.$transaction(async (tx) => {
      // Create the baseline
      const newBaseline = await tx.baseline.create({
        data: {
          projectId,
          name,
          description: description || null,
          status: 'active',
          createdBy: req.user?.id,
          createdByName: req.user?.name,
        },
      })

      // Create baseline items for each requirement
      if (requirements.length > 0) {
        await tx.baselineItem.createMany({
          data: requirements.map((req) => ({
            baselineId: newBaseline.id,
            requirementId: req.id,
            snapshot: JSON.stringify(req),
          })),
        })
      }

      return newBaseline
    })

    res.status(201).json({
      success: true,
      data: {
        ...baseline,
        itemCount: requirements.length,
        createdAt: baseline.createdAt.toISOString(),
        updatedAt: baseline.updatedAt.toISOString(),
      },
      message: `Baseline created with ${requirements.length} requirement(s)`,
    })
  } catch (error) {
    console.error('Create baseline error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

/**
 * Lock a baseline to prevent further changes
 */
export const lockBaseline = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, baselineId } = req.params

    const baseline = await prisma.baseline.findFirst({
      where: { id: baselineId, projectId },
    })

    if (!baseline) {
      return res.status(404).json({
        success: false,
        error: 'Baseline not found',
      })
    }

    if (baseline.status === 'locked') {
      return res.status(400).json({
        success: false,
        error: 'Baseline is already locked',
      })
    }

    const updatedBaseline = await prisma.baseline.update({
      where: { id: baselineId },
      data: {
        status: 'locked',
        lockedAt: new Date(),
      },
    })

    res.json({
      success: true,
      data: {
        ...updatedBaseline,
        lockedAt: updatedBaseline.lockedAt?.toISOString(),
        createdAt: updatedBaseline.createdAt.toISOString(),
        updatedAt: updatedBaseline.updatedAt.toISOString(),
      },
      message: 'Baseline locked successfully',
    })
  } catch (error) {
    console.error('Lock baseline error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

/**
 * Delete a baseline
 */
export const deleteBaseline = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, baselineId } = req.params

    const baseline = await prisma.baseline.findFirst({
      where: { id: baselineId, projectId },
    })

    if (!baseline) {
      return res.status(404).json({
        success: false,
        error: 'Baseline not found',
      })
    }

    if (baseline.status === 'locked') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete a locked baseline',
      })
    }

    await prisma.baseline.delete({
      where: { id: baselineId },
    })

    res.json({
      success: true,
      message: 'Baseline deleted successfully',
    })
  } catch (error) {
    console.error('Delete baseline error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

/**
 * Compare two baselines
 */
export const compareBaselines = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { baselineAId, baselineBId } = req.query

    if (!baselineAId || !baselineBId) {
      return res.status(400).json({
        success: false,
        error: 'Both baselineAId and baselineBId are required',
      })
    }

    const [baselineA, baselineB] = await Promise.all([
      prisma.baseline.findFirst({
        where: { id: baselineAId as string, projectId },
        include: { items: true },
      }),
      prisma.baseline.findFirst({
        where: { id: baselineBId as string, projectId },
        include: { items: true },
      }),
    ])

    if (!baselineA || !baselineB) {
      return res.status(404).json({
        success: false,
        error: 'One or both baselines not found',
      })
    }

    // Build maps of requirement IDs to snapshots
    const mapA = new Map(baselineA.items.map((item) => [item.requirementId, item.snapshot]))
    const mapB = new Map(baselineB.items.map((item) => [item.requirementId, item.snapshot]))

    const added: string[] = []
    const removed: string[] = []
    const modified: string[] = []

    // Find added and modified
    mapB.forEach((snapshotB, reqId) => {
      const snapshotA = mapA.get(reqId)
      if (!snapshotA) {
        added.push(reqId)
      } else if (snapshotA !== snapshotB) {
        modified.push(reqId)
      }
    })

    // Find removed
    mapA.forEach((_, reqId) => {
      if (!mapB.has(reqId)) {
        removed.push(reqId)
      }
    })

    res.json({
      success: true,
      data: {
        baselineA: {
          id: baselineA.id,
          name: baselineA.name,
          createdAt: baselineA.createdAt.toISOString(),
        },
        baselineB: {
          id: baselineB.id,
          name: baselineB.name,
          createdAt: baselineB.createdAt.toISOString(),
        },
        added,
        removed,
        modified,
        summary: {
          addedCount: added.length,
          removedCount: removed.length,
          modifiedCount: modified.length,
        },
      },
    })
  } catch (error) {
    console.error('Compare baselines error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}
