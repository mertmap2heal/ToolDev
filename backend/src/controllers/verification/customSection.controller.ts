import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import { PrismaClient } from '@prisma/client'
import { customSectionService } from '../../services/verification/customSection.service'
import { auditService } from '../../services/verification/audit.service'
import { AuditAction } from '../../types/verification.types'

const prisma = new PrismaClient()

export const getCustomSections = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, testCaseId } = req.params

    // Verify test case exists and belongs to project
    const testCase = await prisma.verTestCase.findFirst({
      where: { id: testCaseId, projectId },
    })

    if (!testCase) {
      return res.status(404).json({ success: false, error: 'Test case not found' })
    }

    const sections = await prisma.verTestCaseCustomSection.findMany({
      where: {
        testCaseId,
        projectId,
      },
      include: {
        images: true,
      },
      orderBy: {
        orderIndex: 'asc',
      },
    })

    res.json({ success: true, data: sections })
  } catch (error: any) {
    console.error('Get custom sections error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const createCustomSection = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, testCaseId } = req.params
    const { title, content, orderIndex } = req.body

    if (!title || !content) {
      return res.status(400).json({ success: false, error: 'Title and content are required' })
    }

    // Verify test case exists and belongs to project
    const testCase = await prisma.verTestCase.findFirst({
      where: { id: testCaseId, projectId },
    })

    if (!testCase) {
      return res.status(404).json({ success: false, error: 'Test case not found' })
    }

    // Get current max order index if not provided
    let finalOrderIndex = orderIndex
    if (finalOrderIndex === undefined || finalOrderIndex === null) {
      const maxSection = await prisma.verTestCaseCustomSection.findFirst({
        where: { testCaseId, projectId },
        orderBy: { orderIndex: 'desc' },
      })
      finalOrderIndex = maxSection ? maxSection.orderIndex + 1 : 0
    }

    const section = await prisma.verTestCaseCustomSection.create({
      data: {
        testCaseId,
        projectId,
        title,
        content,
        orderIndex: finalOrderIndex,
      },
      include: {
        images: true,
      },
    })

    await auditService.logEvent({
      projectId,
      entityType: 'TEST_CASE',
      entityId: testCaseId,
      action: AuditAction.UPDATE,
      newValue: { customSection: section },
      performedByUserId: req.userId,
    })

    res.status(201).json({ success: true, data: section })
  } catch (error: any) {
    console.error('Create custom section error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const updateCustomSection = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, sectionId } = req.params
    const { title, content, orderIndex } = req.body

    const existing = await prisma.verTestCaseCustomSection.findFirst({
      where: { id: sectionId, projectId },
    })

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Custom section not found' })
    }

    const updated = await prisma.verTestCaseCustomSection.update({
      where: { id: sectionId },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(orderIndex !== undefined && { orderIndex }),
      },
      include: {
        images: true,
      },
    })

    await auditService.logEvent({
      projectId,
      entityType: 'TEST_CASE',
      entityId: existing.testCaseId,
      action: AuditAction.UPDATE,
      oldValue: { customSection: existing },
      newValue: { customSection: updated },
      performedByUserId: req.userId,
    })

    res.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('Update custom section error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const deleteCustomSection = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, sectionId } = req.params

    const existing = await prisma.verTestCaseCustomSection.findFirst({
      where: { id: sectionId, projectId },
      include: {
        images: true,
      },
    })

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Custom section not found' })
    }

    // Delete associated images
    for (const image of existing.images) {
      await customSectionService.deleteImage(image.id)
    }

    // Delete the section
    await prisma.verTestCaseCustomSection.delete({
      where: { id: sectionId },
    })

    await auditService.logEvent({
      projectId,
      entityType: 'TEST_CASE',
      entityId: existing.testCaseId,
      action: AuditAction.UPDATE,
      oldValue: { customSection: existing },
      performedByUserId: req.userId,
    })

    res.json({ success: true })
  } catch (error: any) {
    console.error('Delete custom section error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const reorderSections = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, testCaseId } = req.params
    const { sectionIds } = req.body

    if (!Array.isArray(sectionIds)) {
      return res.status(400).json({ success: false, error: 'sectionIds must be an array' })
    }

    // Verify test case exists
    const testCase = await prisma.verTestCase.findFirst({
      where: { id: testCaseId, projectId },
    })

    if (!testCase) {
      return res.status(404).json({ success: false, error: 'Test case not found' })
    }

    // Update order indices
    const updatePromises = sectionIds.map((sectionId: string, index: number) =>
      prisma.verTestCaseCustomSection.updateMany({
        where: { id: sectionId, testCaseId, projectId },
        data: { orderIndex: index },
      })
    )

    await Promise.all(updatePromises)

    await auditService.logEvent({
      projectId,
      entityType: 'TEST_CASE',
      entityId: testCaseId,
      action: AuditAction.UPDATE,
      newValue: { reorderedCustomSections: sectionIds },
      performedByUserId: req.userId,
    })

    res.json({ success: true })
  } catch (error: any) {
    console.error('Reorder sections error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const uploadImage = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, sectionId } = req.params
    const { fileName, fileData, mimeType } = req.body

    if (!fileName || !fileData) {
      return res.status(400).json({ success: false, error: 'fileName and fileData are required' })
    }

    // Verify section exists
    const section = await prisma.verTestCaseCustomSection.findFirst({
      where: { id: sectionId, projectId },
    })

    if (!section) {
      return res.status(404).json({ success: false, error: 'Custom section not found' })
    }

    const image = await customSectionService.uploadImage(projectId, sectionId, fileData, fileName, mimeType)

    res.status(201).json({ success: true, data: image })
  } catch (error: any) {
    console.error('Upload image error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const deleteImage = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, imageId } = req.params

    const image = await prisma.verTestCaseSectionImage.findFirst({
      where: { id: imageId, projectId },
    })

    if (!image) {
      return res.status(404).json({ success: false, error: 'Image not found' })
    }

    await customSectionService.deleteImage(imageId)

    res.json({ success: true })
  } catch (error: any) {
    console.error('Delete image error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}
