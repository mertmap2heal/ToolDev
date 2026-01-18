import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const prisma = new PrismaClient()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const uploadsDir = path.join(__dirname, '../../uploads/change-requests')

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

export const createChangeRequest = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { title, description, sourceType, sourceId, priority, requestedBy, risk, effort, justification } = req.body

    if (!title || !description || !sourceType || !sourceId) {
      return res.status(400).json({
        success: false,
        error: 'Title, description, sourceType, and sourceId are required',
      })
    }

    if (!['function', 'issue', 'parameter', 'requirement'].includes(sourceType)) {
      return res.status(400).json({
        success: false,
        error: 'sourceType must be one of: function, issue, parameter, requirement',
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
        risk: risk || null,
        effort: effort || null,
        justification: justification || null,
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
      include: {
        attachments: true,
      },
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
      include: {
        attachments: true,
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
      include: {
        attachments: true,
      },
    })

    if (!changeRequest) {
      return res.status(404).json({
        success: false,
        error: 'Change request not found',
      })
    }

    // Delete associated files
    for (const attachment of changeRequest.attachments) {
      if (attachment.fileUrl && !attachment.fileUrl.startsWith('data:')) {
        const filePath = path.join(uploadsDir, path.basename(attachment.fileUrl))
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
      }
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

export const uploadAttachment = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, changeRequestId } = req.params
    const { fileName, fileData, mimeType } = req.body

    if (!fileName || !fileData) {
      return res.status(400).json({
        success: false,
        error: 'fileName and fileData are required',
      })
    }

    // Verify change request exists and belongs to project
    const changeRequest = await prisma.changeRequest.findFirst({
      where: {
        id: changeRequestId,
        projectId,
      },
    })

    if (!changeRequest) {
      return res.status(404).json({
        success: false,
        error: 'Change request not found',
      })
    }

    // Handle base64 file data
    let fileUrl: string
    let fileSize: number

    if (fileData.startsWith('data:')) {
      // Data URL format: data:mimeType;base64,data
      const base64Data = fileData.split(',')[1]
      const buffer = Buffer.from(base64Data, 'base64')
      fileSize = buffer.length

      // For files larger than 1MB, save to filesystem
      if (fileSize > 1024 * 1024) {
        const fileExtension = path.extname(fileName)
        const uniqueFileName = `${changeRequestId}-${Date.now()}${fileExtension}`
        const filePath = path.join(uploadsDir, uniqueFileName)
        fs.writeFileSync(filePath, buffer)
        fileUrl = `/uploads/change-requests/${uniqueFileName}`
      } else {
        // Store as data URL for small files
        fileUrl = fileData
      }
    } else {
      // Assume it's already base64 without data URL prefix
      const buffer = Buffer.from(fileData, 'base64')
      fileSize = buffer.length
      const fileExtension = path.extname(fileName)
      const uniqueFileName = `${changeRequestId}-${Date.now()}${fileExtension}`
      const filePath = path.join(uploadsDir, uniqueFileName)
      fs.writeFileSync(filePath, buffer)
      fileUrl = `/uploads/change-requests/${uniqueFileName}`
    }

    const attachment = await prisma.changeRequestAttachment.create({
      data: {
        changeRequestId,
        projectId,
        fileName,
        fileUrl,
        fileSize,
        mimeType: mimeType || 'application/octet-stream',
        uploadedBy: req.userId || null,
        uploadedByName: null, // Can be populated from user lookup if needed
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
      error: error.message || 'Internal server error',
    })
  }
}

export const getAttachments = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, changeRequestId } = req.params

    const attachments = await prisma.changeRequestAttachment.findMany({
      where: {
        changeRequestId,
        projectId,
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json({
      success: true,
      data: attachments,
    })
  } catch (error: any) {
    console.error('Get attachments error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const deleteAttachment = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, changeRequestId, attachmentId } = req.params

    const attachment = await prisma.changeRequestAttachment.findFirst({
      where: {
        id: attachmentId,
        changeRequestId,
        projectId,
      },
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

    await prisma.changeRequestAttachment.delete({
      where: { id: attachmentId },
    })

    res.json({
      success: true,
      message: 'Attachment deleted successfully',
    })
  } catch (error: any) {
    console.error('Delete attachment error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}
