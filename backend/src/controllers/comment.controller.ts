import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

export const getComments = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const comments = await prisma.taskComment.findMany({
      where: { taskId: id },
      orderBy: {
        createdAt: 'desc',
      },
    })

    res.json({
      success: true,
      data: comments,
    })
  } catch (error: any) {
    console.error('Get comments error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const createComment = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { body_rich, author_name } = req.body
    const idempotencyKey = req.headers['idempotency-key'] as string
    const correlationId = idempotencyKey || randomUUID()

    if (!body_rich || body_rich.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Comment body is required',
      })
    }

    const comment = await prisma.taskComment.create({
      data: {
        taskId: id,
        bodyRich: body_rich,
        authorName: author_name || null,
      },
    })

    // Write activity feed
    await prisma.activityFeed.create({
      data: {
        taskId: id,
        eventType: 'comment_added',
        payloadJson: JSON.stringify({ commentId: comment.id, authorName: author_name }),
        correlationId,
      },
    })

    res.status(201).json({
      success: true,
      data: comment,
    })
  } catch (error: any) {
    console.error('Create comment error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}
