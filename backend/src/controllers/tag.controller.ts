import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const getTags = async (req: AuthRequest, res: Response) => {
  try {
    const tags = await prisma.taskTag.findMany({
      orderBy: {
        name: 'asc',
      },
    })

    res.json({
      success: true,
      data: tags,
    })
  } catch (error: any) {
    console.error('Get tags error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const createTag = async (req: AuthRequest, res: Response) => {
  try {
    const { name, color } = req.body

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Tag name is required',
      })
    }

    const tag = await prisma.taskTag.create({
      data: {
        name: name.trim(),
        color: color || null,
      },
    })

    res.status(201).json({
      success: true,
      data: tag,
    })
  } catch (error: any) {
    console.error('Create tag error:', error)
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        error: 'Tag with this name already exists',
      })
    }
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const linkTagToTask = async (req: AuthRequest, res: Response) => {
  try {
    const { id, tagId } = req.params

    await prisma.taskTagLink.create({
      data: {
        taskId: id,
        tagId,
      },
    })

    res.json({
      success: true,
      data: null,
    })
  } catch (error: any) {
    console.error('Link tag to task error:', error)
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        error: 'Tag is already linked to this task',
      })
    }
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const unlinkTagFromTask = async (req: AuthRequest, res: Response) => {
  try {
    const { id, tagId } = req.params

    await prisma.taskTagLink.delete({
      where: {
        taskId_tagId: {
          taskId: id,
          tagId,
        },
      },
    })

    res.json({
      success: true,
      data: null,
    })
  } catch (error: any) {
    console.error('Unlink tag from task error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}
