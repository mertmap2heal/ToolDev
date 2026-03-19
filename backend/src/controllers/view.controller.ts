import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma'


export const getSavedViews = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const userId = req.user?.id

    const views = await prisma.savedView.findMany({
      where: {
        projectId,
        OR: [
          { userId },
          { type: 'project' },
          { type: 'organization' },
        ],
      },
      orderBy: [
        { type: 'asc' },
        { createdAt: 'desc' },
      ],
    })

    res.json({
      success: true,
      data: views,
    })
  } catch (error) {
    console.error('Get saved views error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const createSavedView = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { name, type, filters, columns, sortBy, sortOrder } = req.body

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'View name is required',
      })
    }

    const view = await prisma.savedView.create({
      data: {
        projectId,
        userId: type === 'personal' ? req.user?.id : undefined,
        name,
        type: type || 'personal',
        filters: filters ? JSON.stringify(filters) : null,
        columns: columns ? JSON.stringify(columns) : null,
        sortBy,
        sortOrder,
      },
    })

    res.status(201).json({
      success: true,
      data: view,
    })
  } catch (error) {
    console.error('Create saved view error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const updateSavedView = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, viewId } = req.params
    const { name, filters, columns, sortBy, sortOrder } = req.body

    const view = await prisma.savedView.findFirst({
      where: {
        id: viewId,
        projectId,
        OR: [
          { userId: req.user?.id },
          { type: 'project' },
          { type: 'organization' },
        ],
      },
    })

    if (!view) {
      return res.status(404).json({
        success: false,
        error: 'View not found',
      })
    }

    const updatedView = await prisma.savedView.update({
      where: { id: viewId },
      data: {
        name,
        filters: filters ? JSON.stringify(filters) : undefined,
        columns: columns ? JSON.stringify(columns) : undefined,
        sortBy,
        sortOrder,
      },
    })

    res.json({
      success: true,
      data: updatedView,
    })
  } catch (error) {
    console.error('Update saved view error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const deleteSavedView = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, viewId } = req.params

    const view = await prisma.savedView.findFirst({
      where: {
        id: viewId,
        projectId,
        OR: [
          { userId: req.user?.id },
          { type: 'project' },
          { type: 'organization' },
        ],
      },
    })

    if (!view) {
      return res.status(404).json({
        success: false,
        error: 'View not found',
      })
    }

    await prisma.savedView.delete({
      where: { id: viewId },
    })

    res.json({
      success: true,
      message: 'View deleted successfully',
    })
  } catch (error) {
    console.error('Delete saved view error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}
