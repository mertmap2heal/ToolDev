import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import { prisma } from '../../lib/prisma'
import { auditService } from '../../services/verification/audit.service'
import { statusTransitionService } from '../../services/verification/statusTransition.service'
import { AuditAction, EntityStatus } from '../../types/verification.types'
import { randomUUID } from 'crypto'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)


// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../../uploads/verification/manuals')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

export const getSetups = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const setups = await prisma.verTestSetup.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ success: true, data: setups })
  } catch (error: any) {
    console.error('Get setups error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const getSetup = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const setup = await prisma.verTestSetup.findFirst({ where: { id, projectId } })
    if (!setup) return res.status(404).json({ success: false, error: 'Setup not found' })
    res.json({ success: true, data: setup })
  } catch (error: any) {
    console.error('Get setup error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const createSetup = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { name, description, environmentType, components, interfaces, diagramData, photos, version } = req.body
    if (!name || !environmentType) {
      return res.status(400).json({ success: false, error: 'Name and environmentType are required' })
    }
    const setup = await prisma.verTestSetup.create({
      data: {
        projectId,
        name,
        description,
        environmentType,
        components: components || null,
        interfaces: interfaces || null,
        diagramData: diagramData || null,
        photos: photos || null,
        version: version || '1.0',
        status: EntityStatus.DRAFT,
      },
    })
    await auditService.logEvent({
      projectId,
      entityType: 'SETUP',
      entityId: setup.id,
      action: AuditAction.CREATE,
      newValue: setup,
      performedByUserId: req.userId,
    })
    res.status(201).json({ success: true, data: setup })
  } catch (error: any) {
    console.error('Create setup error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const updateSetup = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const existing = await prisma.verTestSetup.findFirst({ where: { id, projectId } })
    if (!existing) return res.status(404).json({ success: false, error: 'Setup not found' })
    const { name, description, environmentType, components, interfaces, diagramData, photos, version, status } = req.body
    if (status && status !== existing.status) {
      statusTransitionService.validateTransition('SETUP', existing.status, status)
    }
    const updated = await prisma.verTestSetup.update({
      where: { id },
      data: { name, description, environmentType, components, interfaces, diagramData, photos, version, status },
    })
    if (status && status !== existing.status) {
      await auditService.logStatusChange({
        projectId,
        entityType: 'SETUP',
        entityId: id,
        oldStatus: existing.status,
        newStatus: status,
        performedByUserId: req.userId,
      })
    } else {
      await auditService.logEvent({
        projectId,
        entityType: 'SETUP',
        entityId: id,
        action: AuditAction.UPDATE,
        oldValue: existing,
        newValue: updated,
        performedByUserId: req.userId,
      })
    }
    res.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('Update setup error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const approveSetup = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const existing = await prisma.verTestSetup.findFirst({ where: { id, projectId } })
    if (!existing) return res.status(404).json({ success: false, error: 'Setup not found' })
    statusTransitionService.validateTransition('SETUP', existing.status, EntityStatus.APPROVED)
    const updated = await prisma.verTestSetup.update({ where: { id }, data: { status: EntityStatus.APPROVED } })
    await auditService.logEvent({
      projectId,
      entityType: 'SETUP',
      entityId: id,
      action: AuditAction.APPROVE,
      oldValue: existing,
      newValue: updated,
      performedByUserId: req.userId,
    })
    res.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('Approve setup error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const deprecateSetup = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const existing = await prisma.verTestSetup.findFirst({ where: { id, projectId } })
    if (!existing) return res.status(404).json({ success: false, error: 'Setup not found' })
    statusTransitionService.validateTransition('SETUP', existing.status, EntityStatus.DEPRECATED)
    const updated = await prisma.verTestSetup.update({ where: { id }, data: { status: EntityStatus.DEPRECATED } })
    await auditService.logEvent({
      projectId,
      entityType: 'SETUP',
      entityId: id,
      action: AuditAction.DEPRECATE,
      oldValue: existing,
      newValue: updated,
      performedByUserId: req.userId,
    })
    res.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('Deprecate setup error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const exportSetupDiagram = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const setup = await prisma.verTestSetup.findFirst({ where: { id, projectId } })
    if (!setup) return res.status(404).json({ success: false, error: 'Setup not found' })
    // Return diagram data as JSON payload (frontend can render or export)
    res.json({
      success: true,
      data: {
        diagramData: setup.diagramData,
        exportPath: setup.diagramExportPath,
        format: 'JSON',
      },
    })
  } catch (error: any) {
    console.error('Export setup diagram error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const uploadComponentManual = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, setupId, componentId } = req.params
    const { fileName, fileData, mimeType } = req.body

    if (!fileName || !fileData) {
      return res.status(400).json({
        success: false,
        error: 'fileName and fileData are required',
      })
    }

    // Get the setup
    const setup = await prisma.verTestSetup.findFirst({
      where: { id: setupId, projectId },
    })

    if (!setup) {
      return res.status(404).json({
        success: false,
        error: 'Setup not found',
      })
    }

    // Parse components array
    const components: any[] = Array.isArray(setup.components) ? (setup.components as any[]) : []

    // Find the component
    const componentIndex = components.findIndex((c: any) => c.id === componentId)
    if (componentIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Component not found',
      })
    }

    // Handle base64 file data
    let fileUrl: string
    let fileSize: number

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
        fileUrl = `/uploads/verification/manuals/${uniqueFileName}`
      } else {
        // Store as data URL for small files
        fileUrl = fileData
      }
    } else {
      // Plain base64
      const buffer = Buffer.from(fileData, 'base64')
      fileSize = buffer.length
      const fileExtension = path.extname(fileName)
      const uniqueFileName = `${randomUUID()}${fileExtension}`
      const filePath = path.join(uploadsDir, uniqueFileName)
      fs.writeFileSync(filePath, buffer)
      fileUrl = `/uploads/verification/manuals/${uniqueFileName}`
    }

    // Update component with manual metadata
    const updatedComponent = {
      ...components[componentIndex],
      manual: {
        fileName,
        fileUrl,
        fileSize,
        mimeType: mimeType || null,
      },
    }

    components[componentIndex] = updatedComponent

    // Update setup with modified components
    const updated = await prisma.verTestSetup.update({
      where: { id: setupId },
      data: { components: components as any },
    })

    await auditService.logEvent({
      projectId,
      entityType: 'SETUP',
      entityId: setupId,
      action: AuditAction.UPDATE,
      oldValue: setup,
      newValue: updated,
      performedByUserId: req.userId,
    })

    res.json({
      success: true,
      data: {
        manual: updatedComponent.manual,
      },
    })
  } catch (error: any) {
    console.error('Upload component manual error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const deleteSetup = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params

    const setup = await prisma.verTestSetup.findFirst({
      where: { id, projectId },
    })

    if (!setup) {
      return res.status(404).json({ success: false, error: 'Test setup not found' })
    }

    // Delete test result links
    await prisma.verTestResultLink.deleteMany({
      where: {
        linkedEntityType: 'TEST_SETUP',
        linkedEntityId: id,
      },
    })

    // Delete test setup (testCaseSetups will cascade delete automatically)
    await prisma.verTestSetup.delete({
      where: { id },
    })

    await auditService.logEvent({
      projectId,
      entityType: 'SETUP',
      entityId: id,
      action: AuditAction.DELETE,
      oldValue: setup,
      performedByUserId: req.userId,
    })

    res.json({ success: true, message: 'Test setup deleted' })
  } catch (error: any) {
    console.error('Delete test setup error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}
