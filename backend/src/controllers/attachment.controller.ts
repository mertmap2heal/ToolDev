import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma'
import { randomUUID } from 'crypto'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Canonical uploads root — all filesystem operations must stay within this directory
const UPLOADS_BASE = path.resolve(__dirname, '../../uploads')

// Permitted MIME types mapped to their canonical file extension.
// Executables, scripts, HTML, and SVG are deliberately excluded.
// Extension is derived from this map (not from client-supplied filename) to prevent
// double-extension attacks like "document.pdf.exe".
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'application/json': '.json',
  'application/msword': '.doc',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/zip': '.zip',
  'application/x-zip-compressed': '.zip',
}

const ALLOWED_MIME_TYPES = new Set(Object.keys(MIME_TO_EXT))

// Safe filename: letters, numbers, spaces, dots, hyphens, underscores, parens — max 255 chars
const SAFE_FILENAME_RE = /^[a-zA-Z0-9 ._\-()\[\]]+$/

// Ensure uploads directory exists
const uploadsDir = path.join(UPLOADS_BASE, 'tasks')
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

    // Validate MIME type against allowlist (client-supplied but defence-in-depth)
    if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
      return res.status(400).json({
        success: false,
        error: 'File type not permitted',
      })
    }

    // Validate filename — only safe characters, max 255 chars
    if (fileName.length > 255 || !SAFE_FILENAME_RE.test(fileName)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file name',
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
        const fileExtension = MIME_TO_EXT[mimeType] ?? '.bin'
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
      const fileExtension = MIME_TO_EXT[mimeType] ?? '.bin'
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
      // Strip the leading /uploads/ prefix so the remainder is relative to UPLOADS_BASE,
      // then resolve to an absolute path and verify it stays within UPLOADS_BASE
      // (defence-in-depth against traversal sequences stored in fileUrl)
      const relativePath = attachment.fileUrl.slice('/uploads/'.length)
      const filePath = path.resolve(UPLOADS_BASE, relativePath)
      if (!filePath.startsWith(UPLOADS_BASE + path.sep)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid attachment path',
        })
      }
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
