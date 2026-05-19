/**
 * Lifecycle definition controller (ROADMAP NX-11; issue #474).
 *
 * Thin HTTP layer over lifecycleDefinition.service.ts. Parses the request,
 * sends the standard `{ success, data }` shape, catches service errors.
 * Project membership is already enforced by projectIdParam + requireProjectMember
 * on the route, so `req.params.projectId` is a valid, access-checked UUID.
 *
 * Definition writes are audited to the central AuditLog with `lifecycle:*`
 * action strings (R-8 convention; kb/backend-patterns.md).
 */

import type { Response } from 'express'
import { Prisma } from '@prisma/client'
import type { AuthRequest } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma'
import {
  getLibrary,
  getApplicable,
  getTransitions,
  createLifecycle,
  updateLifecycle,
  deleteLifecycle,
  CatalogReadOnlyError,
  LifecycleNotFoundError,
} from '../services/lifecycleDefinition.service'
import type { CreateLifecycleInput } from '../services/lifecycleDefinition.service'

/** Map a service error to an HTTP response. */
function sendError(res: Response, err: unknown): void {
  if (err instanceof CatalogReadOnlyError) {
    res.status(403).json({ success: false, error: err.message })
    return
  }
  if (err instanceof LifecycleNotFoundError) {
    res.status(404).json({ success: false, error: err.message })
    return
  }
  const message = err instanceof Error ? err.message : 'Internal server error'
  res.status(500).json({ success: false, error: message })
}

async function audit(
  projectId: string,
  userId: string,
  action: string,
  detailsJson: Prisma.InputJsonValue
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: { projectId, userId, action, detailsJson },
    })
  } catch (e) {
    // Audit failure must not fail the request.
    console.error('lifecycle audit write failed:', e)
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function listLibrary(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { projectId } = req.params
    const itemType = typeof req.query.itemType === 'string' ? req.query.itemType : undefined
    const data = await getLibrary(projectId!, itemType)
    res.json({ success: true, data })
  } catch (err) {
    sendError(res, err)
  }
}

export async function getApplicableLifecycle(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { projectId } = req.params
    const itemType = typeof req.query.itemType === 'string' ? req.query.itemType : ''
    if (!itemType) {
      res.status(400).json({ success: false, error: 'itemType query parameter is required' })
      return
    }
    const data = await getApplicable(projectId!, itemType)
    res.json({ success: true, data })
  } catch (err) {
    sendError(res, err)
  }
}

export async function listTransitions(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { projectId } = req.params
    const lifecycleId = typeof req.query.lifecycleId === 'string' ? req.query.lifecycleId : ''
    const fromStatusId =
      typeof req.query.fromStatusId === 'string' ? req.query.fromStatusId : ''
    if (!lifecycleId || !fromStatusId) {
      res
        .status(400)
        .json({ success: false, error: 'lifecycleId and fromStatusId query parameters are required' })
      return
    }
    const transitions = await getTransitions(projectId!, lifecycleId, fromStatusId)
    res.json({ success: true, data: { transitions } })
  } catch (err) {
    sendError(res, err)
  }
}

// ---------------------------------------------------------------------------
// Writes (project-custom lifecycles)
// ---------------------------------------------------------------------------

export async function createLifecycleDefinition(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { projectId } = req.params
    const userId = req.userId ?? req.user?.userId
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }
    const data = await createLifecycle(projectId!, userId, req.body as CreateLifecycleInput)
    await audit(projectId!, userId, 'lifecycle:definition-create', {
      lifecycleId: data.id,
      name: data.name,
      phaseCount: data.phases.length,
    })
    res.status(201).json({ success: true, data })
  } catch (err) {
    sendError(res, err)
  }
}

export async function updateLifecycleDefinition(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { projectId, lifecycleId } = req.params
    const userId = req.userId ?? req.user?.userId
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }
    const data = await updateLifecycle(
      projectId!,
      userId,
      lifecycleId!,
      req.body as CreateLifecycleInput
    )
    await audit(projectId!, userId, 'lifecycle:definition-update', {
      lifecycleId: data.id,
      name: data.name,
      phaseCount: data.phases.length,
    })
    res.json({ success: true, data })
  } catch (err) {
    sendError(res, err)
  }
}

export async function deleteLifecycleDefinition(
  req: AuthRequest,
  res: Response
): Promise<void> {
  try {
    const { projectId, lifecycleId } = req.params
    const userId = req.userId ?? req.user?.userId
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }
    await deleteLifecycle(projectId!, lifecycleId!)
    await audit(projectId!, userId, 'lifecycle:definition-delete', { lifecycleId })
    res.json({ success: true, data: { id: lifecycleId } })
  } catch (err) {
    sendError(res, err)
  }
}
