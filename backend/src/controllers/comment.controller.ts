import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma'
import { randomUUID } from 'crypto'


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
    const { body_rich } = req.body
    const idempotencyKey = req.headers['idempotency-key'] as string
    const correlationId = idempotencyKey || randomUUID()

    if (!body_rich || body_rich.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Comment body is required',
      })
    }

    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    // Authorship is derived from the authenticated session, never from the
    // request body — client-supplied author_name is ignored to prevent
    // impersonation (#160).
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    })
    const authorName = user?.name?.trim() || user?.email?.trim() || 'Unknown'

    const comment = await prisma.taskComment.create({
      data: {
        taskId: id,
        bodyRich: body_rich,
        authorId: userId,
        authorName,
      },
    })

    // Write activity feed
    await prisma.activityFeed.create({
      data: {
        taskId: id,
        eventType: 'comment_added',
        payloadJson: JSON.stringify({
          commentId: comment.id,
          authorId: userId,
          authorName,
        }),
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
