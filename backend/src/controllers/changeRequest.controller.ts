import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const createChangeRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { title, description, sourceType, sourceId, priority, requestedBy } = req.body

    if (!title || !description || !sourceType || !sourceId) {
      return res.status(400).json({
        success: false,
        error: 'Title, description, sourceType, and sourceId are required',
      })
    }

    if (!['function', 'issue', 'parameter'].includes(sourceType)) {
      return res.status(400).json({
        success: false,
        error: 'sourceType must be one of: function, issue, parameter',
      })
    }

    const changeRequest = await prisma.changeRequest.create({
      data: {
        projectId,
        title,
        description,
        sourceType,
        sourceId,
        priority: priority || 'medium',
        requestedBy: requestedBy || null,
      },
    })

    res.status(201).json({
      success: true,
      data: changeRequest,
    })
  } catch (error: any) {
    console.error('Create change request error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    })
  }
}

export const getChangeRequests = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params

    const changeRequests = await prisma.changeRequest.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })

    res.json({
      success: true,
      data: changeRequests,
    })
  } catch (error: any) {
    console.error('Get change requests error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const getChangeRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params

    const changeRequest = await prisma.changeRequest.findFirst({
      where: {
        id,
        projectId,
      },
    })

    if (!changeRequest) {
      return res.status(404).json({
        success: false,
        error: 'Change request not found',
      })
    }

    res.json({
      success: true,
      data: changeRequest,
    })
  } catch (error: any) {
    console.error('Get change request error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const updateChangeRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const { title, description, priority, status, reviewedBy, reviewComments } = req.body

    const changeRequest = await prisma.changeRequest.findFirst({
      where: {
        id,
        projectId,
      },
    })

    if (!changeRequest) {
      return res.status(404).json({
        success: false,
        error: 'Change request not found',
      })
    }

    const updated = await prisma.changeRequest.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(priority && { priority }),
        ...(status && { status }),
        ...(reviewedBy && { reviewedBy }),
        ...(reviewComments !== undefined && { reviewComments }),
      },
    })

    res.json({
      success: true,
      data: updated,
    })
  } catch (error: any) {
    console.error('Update change request error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const deleteChangeRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params

    const changeRequest = await prisma.changeRequest.findFirst({
      where: {
        id,
        projectId,
      },
    })

    if (!changeRequest) {
      return res.status(404).json({
        success: false,
        error: 'Change request not found',
      })
    }

    await prisma.changeRequest.delete({
      where: { id },
    })

    res.json({
      success: true,
      message: 'Change request deleted successfully',
    })
  } catch (error: any) {
    console.error('Delete change request error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}
