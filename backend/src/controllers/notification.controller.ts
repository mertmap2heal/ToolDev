import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const getNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      })
    }

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    res.json({
      success: true,
      data: notifications,
    })
  } catch (error) {
    console.error('Get notifications error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const markNotificationRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId
    const { id } = req.params
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      })
    }

    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    })
    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found',
      })
    }

    await prisma.notification.update({
      where: { id },
      data: { read: true },
    })

    res.json({
      success: true,
      message: 'Marked as read',
    })
  } catch (error) {
    console.error('Mark notification read error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const markAllNotificationsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      })
    }

    await prisma.notification.updateMany({
      where: { userId },
      data: { read: true },
    })

    res.json({
      success: true,
      message: 'All marked as read',
    })
  } catch (error) {
    console.error('Mark all notifications read error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}
