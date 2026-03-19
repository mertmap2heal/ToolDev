import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma'


export const getSavedViews = async (req: AuthRequest, res: Response) => {
  try {
    const { project_id } = req.query

    const views = await prisma.taskSavedView.findMany({
      where: {
        projectId: project_id as string | undefined || null,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    res.json({
      success: true,
      data: views,
    })
  } catch (error: any) {
    console.error('Get saved views error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const createSavedView = async (req: AuthRequest, res: Response) => {
  try {
    const { project_id, name, view_type, query_json, columns_json, sort_json, group_json } = req.body

    if (!name || !view_type) {
      return res.status(400).json({
        success: false,
        error: 'name and view_type are required',
      })
    }

    const view = await prisma.taskSavedView.create({
      data: {
        projectId: project_id || null,
        name,
        viewType: view_type,
        queryJson: query_json || null,
        columnsJson: columns_json || null,
        sortJson: sort_json || null,
        groupJson: group_json || null,
      },
    })

    res.status(201).json({
      success: true,
      data: view,
    })
  } catch (error: any) {
    console.error('Create saved view error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const getSavedView = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const view = await prisma.taskSavedView.findUnique({
      where: { id },
    })

    if (!view) {
      return res.status(404).json({
        success: false,
        error: 'Saved view not found',
      })
    }

    res.json({
      success: true,
      data: view,
    })
  } catch (error: any) {
    console.error('Get saved view error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const updateSavedView = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { name, query_json, columns_json, sort_json, group_json } = req.body

    const view = await prisma.taskSavedView.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(query_json !== undefined && { queryJson: query_json }),
        ...(columns_json !== undefined && { columnsJson: columns_json }),
        ...(sort_json !== undefined && { sortJson: sort_json }),
        ...(group_json !== undefined && { groupJson: group_json }),
      },
    })

    res.json({
      success: true,
      data: view,
    })
  } catch (error: any) {
    console.error('Update saved view error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const deleteSavedView = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    await prisma.taskSavedView.delete({
      where: { id },
    })

    res.json({
      success: true,
      data: null,
    })
  } catch (error: any) {
    console.error('Delete saved view error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}
