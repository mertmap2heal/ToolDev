import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma'
import { linkageAuditService } from '../services/linkageAudit.service'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'


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
    const {
      title,
      description,
      sourceType,
      sourceId,
      impactedRequirementIds,
      priority,
      requestedBy,
      owner,
      risk,
      effort,
      justification
    } = req.body

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

    // Generate a simple CR ID
    const count = await prisma.changeRequest.count({ where: { projectId } })
    const crId = `CR-${(count + 1).toString().padStart(4, '0')}`

    // Auto-populate requestedBy if not provided
    let finalRequestedBy = requestedBy
    if (!finalRequestedBy && req.userId) {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { name: true }
      })
      if (user) {
        finalRequestedBy = user.name
      }
    }

    const requirementIdsToLink = new Set<string>()
    if (sourceType === 'requirement' && sourceId) {
      requirementIdsToLink.add(sourceId)
    }
    if (Array.isArray(impactedRequirementIds)) {
      impactedRequirementIds.forEach((id: string) => requirementIdsToLink.add(id))
    }

    const changeRequest = await prisma.changeRequest.create({
      data: {
        projectId,
        crId,
        title,
        description,
        sourceType,
        sourceId,
        priority: priority || 'medium',
        requestedBy: finalRequestedBy || 'system',
        owner: owner || null,
        risk: risk || null,
        effort: effort || null,
        justification: justification || null,
        createdBy: req.userId || 'system',
        updatedBy: req.userId || 'system',
        requirementLinks: requirementIdsToLink.size > 0 ? {
          create: Array.from(requirementIdsToLink).map((reqId) => ({
            requirementId: reqId,
            relationshipType: reqId === sourceId ? 'originates_from' : 'relates_to',
            createdBy: req.userId || null,
          }))
        } : undefined,
      },
      include: {
        attachments: true,
        requirementLinks: {
          include: {
            requirement: {
              select: {
                id: true,
                requirementId: true,
                title: true,
              }
            }
          }
        },
      },
    })

    // Log linkage for Requirement version history
    if (sourceType === 'requirement') {
      await linkageAuditService.log({
        projectId,
        entityType: 'REQUIREMENT',
        entityId: sourceId,
        action: 'CHANGE_REQUEST_LINKED',
        newValue: {
          crId: changeRequest.crId,
          title: changeRequest.title,
          id: changeRequest.id
        },
        performedByUserId: req.userId || undefined,
      })
    }

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
        requirementLinks: {
          include: {
            requirement: {
              select: {
                id: true,
                requirementId: true,
                title: true,
              }
            }
          }
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // For CRs with sourceType=requirement where source isn't in requirementLinks, fetch display ID
    const sourceIdsToResolve = changeRequests
      .filter(
        (cr) =>
          cr.sourceType === 'requirement' &&
          cr.sourceId &&
          !cr.requirementLinks?.some((l) => l.requirement.id === cr.sourceId)
      )
      .map((cr) => cr.sourceId)
    const uniqueSourceIds = [...new Set(sourceIdsToResolve)]
    let sourceDisplayIdMap: Record<string, string> = {}
    if (uniqueSourceIds.length > 0) {
      const sourceReqs = await prisma.requirement.findMany({
        where: { id: { in: uniqueSourceIds }, projectId, deletedAt: null },
        select: { id: true, requirementId: true },
      })
      sourceDisplayIdMap = Object.fromEntries(
        sourceReqs.map((r) => [r.id, r.requirementId || r.id.substring(0, 8)])
      )
    }

    const data = changeRequests.map((cr) => {
      const base = { ...cr }
      if (cr.sourceType === 'requirement' && cr.sourceId && sourceDisplayIdMap[cr.sourceId]) {
        ;(base as any).sourceDisplayId = sourceDisplayIdMap[cr.sourceId]
      }
      return base
    })

    res.json({
      success: true,
      data,
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
        requirementLinks: {
          include: {
            requirement: {
              select: {
                id: true,
                requirementId: true,
                title: true,
              }
            }
          }
        },
      },
    })

    if (!changeRequest) {
      return res.status(404).json({
        success: false,
        error: 'Change request not found',
      })
    }

    let sourceDisplayId: string | undefined
    if (
      changeRequest.sourceType === 'requirement' &&
      changeRequest.sourceId &&
      !changeRequest.requirementLinks?.some((l) => l.requirement.id === changeRequest.sourceId)
    ) {
      const reqEntity = await prisma.requirement.findFirst({
        where: { id: changeRequest.sourceId, projectId, deletedAt: null },
        select: { requirementId: true },
      })
      sourceDisplayId = reqEntity?.requirementId || changeRequest.sourceId.substring(0, 8)
    }

    const data = { ...changeRequest, ...(sourceDisplayId && { sourceDisplayId }) }

    res.json({
      success: true,
      data,
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
    const {
      title,
      description,
      priority,
      status,
      reviewedBy,
      reviewComments,
      owner,
      requestedBy,
      risk,
      effort,
      justification
    } = req.body

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
        ...(owner && { owner }),
        ...(requestedBy && { requestedBy }),
        ...(risk && { risk }),
        ...(effort && { effort }),
        ...(justification && { justification }),
        updatedBy: req.userId || 'system',
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
