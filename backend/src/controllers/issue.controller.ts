import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const createIssue = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { title, description, priority, owner, relatedFunctionIds, relatedParameterIds } = req.body

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        error: 'Title and description are required',
      })
    }

    const issue = await prisma.issue.create({
      data: {
        projectId,
        title,
        description,
        priority: priority || 'medium',
        owner: owner || '',
        relatedFunctionIds: relatedFunctionIds || [],
        relatedParameterIds: relatedParameterIds || [],
      },
    })

    res.status(201).json({
      success: true,
      data: issue,
    })
  } catch (error: any) {
    console.error('Create issue error:', error)
    
    let errorMessage = 'Internal server error'
    if (error?.message) {
      errorMessage = error.message
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage,
    })
  }
}

export const getIssues = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params

    const issues = await prisma.issue.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })

    res.json({
      success: true,
      data: issues,
    })
  } catch (error) {
    console.error('Get issues error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const getIssue = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const issue = await prisma.issue.findUnique({
      where: { id },
    })

    if (!issue) {
      return res.status(404).json({
        success: false,
        error: 'Issue not found',
      })
    }

    res.json({
      success: true,
      data: issue,
    })
  } catch (error) {
    console.error('Get issue error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const updateIssue = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { title, description, priority, status, owner, relatedFunctionIds, relatedParameterIds } = req.body

    const issue = await prisma.issue.findUnique({
      where: { id },
    })

    if (!issue) {
      return res.status(404).json({
        success: false,
        error: 'Issue not found',
      })
    }

    const updatedIssue = await prisma.issue.update({
      where: { id },
      data: {
        title,
        description,
        priority,
        status,
        owner,
        relatedFunctionIds,
        relatedParameterIds,
      },
    })

    res.json({
      success: true,
      data: updatedIssue,
    })
  } catch (error) {
    console.error('Update issue error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const deleteIssue = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const issue = await prisma.issue.findUnique({
      where: { id },
    })

    if (!issue) {
      return res.status(404).json({
        success: false,
        error: 'Issue not found',
      })
    }

    await prisma.issue.delete({
      where: { id },
    })

    res.json({
      success: true,
      message: 'Issue deleted successfully',
    })
  } catch (error) {
    console.error('Delete issue error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}
