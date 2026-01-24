import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import { PrismaClient } from '@prisma/client'
import { auditService } from '../../services/verification/audit.service'
import { statusTransitionService } from '../../services/verification/statusTransition.service'
import { AuditAction, ReviewStatus } from '../../types/verification.types'

const prisma = new PrismaClient()

export const getReviews = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const reviews = await prisma.verReview.findMany({
      where: { projectId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ success: true, data: reviews })
  } catch (error: any) {
    console.error('Get reviews error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const getReview = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const review = await prisma.verReview.findFirst({
      where: { id, projectId },
      include: { items: true },
    })
    if (!review) return res.status(404).json({ success: false, error: 'Review not found' })
    res.json({ success: true, data: review })
  } catch (error: any) {
    console.error('Get review error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const createReview = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { reviewType, title, description, datePlanned } = req.body
    if (!reviewType || !title || !datePlanned) {
      return res.status(400).json({ success: false, error: 'reviewType, title, and datePlanned are required' })
    }
    const review = await prisma.verReview.create({
      data: {
        projectId,
        reviewType,
        title,
        description,
        datePlanned: new Date(datePlanned),
        status: ReviewStatus.PLANNED,
        createdByUserId: req.userId,
      },
    })
    await auditService.logEvent({
      projectId,
      entityType: 'REVIEW',
      entityId: review.id,
      action: AuditAction.CREATE,
      newValue: review,
      performedByUserId: req.userId,
    })
    res.status(201).json({ success: true, data: review })
  } catch (error: any) {
    console.error('Create review error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const updateReview = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const existing = await prisma.verReview.findFirst({ where: { id, projectId } })
    if (!existing) return res.status(404).json({ success: false, error: 'Review not found' })
    const { reviewType, title, description, datePlanned, dateHeld, status } = req.body
    if (status && status !== existing.status) {
      statusTransitionService.validateTransition('REVIEW', existing.status, status)
    }
    const updated = await prisma.verReview.update({
      where: { id },
      data: {
        reviewType,
        title,
        description,
        datePlanned: datePlanned ? new Date(datePlanned) : undefined,
        dateHeld: dateHeld ? new Date(dateHeld) : undefined,
        status,
      },
    })
    if (status && status !== existing.status) {
      await auditService.logStatusChange({
        projectId,
        entityType: 'REVIEW',
        entityId: id,
        oldStatus: existing.status,
        newStatus: status,
        performedByUserId: req.userId,
      })
    }
    res.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('Update review error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const addReviewItem = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const { entityType, entityId, findingSeverity, findingText, actionOwnerUserId, dueDate } = req.body
    const review = await prisma.verReview.findFirst({ where: { id, projectId } })
    if (!review) return res.status(404).json({ success: false, error: 'Review not found' })
    const item = await prisma.verReviewItem.create({
      data: {
        reviewId: id,
        entityType,
        entityId,
        findingSeverity,
        findingText,
        actionOwnerUserId,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: 'OPEN',
      },
    })
    res.json({ success: true, data: item })
  } catch (error: any) {
    console.error('Add review item error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const updateReviewItem = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id, itemId } = req.params
    const { findingSeverity, findingText, actionOwnerUserId, dueDate, status } = req.body
    const item = await prisma.verReviewItem.findFirst({
      where: { id: itemId, review: { id, projectId } },
    })
    if (!item) return res.status(404).json({ success: false, error: 'Review item not found' })
    const updated = await prisma.verReviewItem.update({
      where: { id: itemId },
      data: {
        findingSeverity,
        findingText,
        actionOwnerUserId,
        dueDate: dueDate ? new Date(dueDate) : null,
        status,
      },
    })
    res.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('Update review item error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const closeReview = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const existing = await prisma.verReview.findFirst({ where: { id, projectId } })
    if (!existing) return res.status(404).json({ success: false, error: 'Review not found' })
    statusTransitionService.validateTransition('REVIEW', existing.status, ReviewStatus.CLOSED)
    const updated = await prisma.verReview.update({
      where: { id },
      data: { status: ReviewStatus.CLOSED, dateHeld: new Date() },
    })
    await auditService.logEvent({
      projectId,
      entityType: 'REVIEW',
      entityId: id,
      action: AuditAction.CLOSE,
      oldValue: existing,
      newValue: updated,
      performedByUserId: req.userId,
    })
    res.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('Close review error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}
