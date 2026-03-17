import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const prisma = new PrismaClient()

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads/tasks')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

export const getAttachments = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const attachments = await prisma.taskAttachment.findMany({
      where: { taskId: id },
      orderBy: {
        createdAt: 'desc',
      },
    })

    res.json({
      success: true,
      data: attachments,
    })
  } catch (error: any) {
    console.error('Get attachments error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const uploadAttachment = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { fileName, fileData, mimeType } = req.body

    if (!fileName || !fileData) {
      return res.status(400).json({
        success: false,
        error: 'fileName and fileData are required',
      })
    }

    const correlationId = randomUUID()

    // Handle base64 file data
    let fileUrl: string
    let fileSize: number
    let storageKey: string

    if (fileData.startsWith('data:')) {
      // Base64 data URL
      const base64Data = fileData.split(',')[1]
      const buffer = Buffer.from(base64Data, 'base64')
      fileSize = buffer.length

      // For files larger than 1MB, save to filesystem
      if (fileSize > 1024 * 1024) {
        const fileExtension = path.extname(fileName)
        const uniqueFileName = `${randomUUID()}${fileExtension}`
        const filePath = path.join(uploadsDir, uniqueFileName)
        fs.writeFileSync(filePath, buffer)
        fileUrl = `/uploads/tasks/${uniqueFileName}`
        storageKey = `tasks/${uniqueFileName}`
      } else {
        // Store as data URL for small files
        fileUrl = fileData
        storageKey = `data:${fileName}`
      }
    } else {
      // Plain base64
      const buffer = Buffer.from(fileData, 'base64')
      fileSize = buffer.length
      const fileExtension = path.extname(fileName)
      const uniqueFileName = `${randomUUID()}${fileExtension}`
      const filePath = path.join(uploadsDir, uniqueFileName)
      fs.writeFileSync(filePath, buffer)
      fileUrl = `/uploads/tasks/${uniqueFileName}`
      storageKey = `tasks/${uniqueFileName}`
    }

    // Create attachment record
    const attachment = await prisma.taskAttachment.create({
      data: {
        taskId: id,
        fileName,
        storageKey,
        fileUrl,
        sizeBytes: fileSize,
        mimeType: mimeType || null,
      },
    })

    // Write activity feed
    await prisma.activityFeed.create({
      data: {
        taskId: id,
        eventType: 'attachment_added',
        payloadJson: JSON.stringify({ attachmentId: attachment.id, fileName }),
        correlationId,
      },
    })

    res.status(201).json({
      success: true,
      data: attachment,
    })
  } catch (error: any) {
    console.error('Upload attachment error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const deleteAttachment = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const attachment = await prisma.taskAttachment.findUnique({
      where: { id },
    })

    if (!attachment) {
      return res.status(404).json({
        success: false,
        error: 'Attachment not found',
      })
    }

    // Delete file if it's stored on filesystem
    if (attachment.fileUrl && !attachment.fileUrl.startsWith('data:') && attachment.fileUrl.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, '../..', attachment.fileUrl)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    }

    // Delete record
    await prisma.taskAttachment.delete({
      where: { id },
    })

    res.json({
      success: true,
      data: null,
    })
  } catch (error: any) {
    console.error('Delete attachment error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}
