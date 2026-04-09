import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import { auditService } from '../../services/verification/audit.service'

function summarizeAuditEvent(ev: {
  action: string
  oldValue: unknown
  newValue: unknown
}): string {
  const { action, oldValue, newValue } = ev
  const nv = newValue as Record<string, unknown> | null
  const ov = oldValue as Record<string, unknown> | null
  switch (action) {
    case 'CREATE':
      return 'Created'
    case 'DELETE':
      return 'Deleted'
    case 'APPROVE':
      return 'Approved'
    case 'CLOSE':
      return 'Closed'
    case 'STATUS_CHANGE':
      return `Status: ${String(ov?.status ?? '—')} → ${String(nv?.status ?? '—')}`
    case 'UPDATE':
      if (nv?.testCaseId != null && String(nv.testCaseId).length)
        return nv.orderIndex != null
          ? `Added or updated case in plan (test case ${String(nv.testCaseId)})`
          : `Plan composition update (test case ${String(nv.testCaseId)})`
      if (nv?.removedTestCaseId != null)
        return `Removed test case ${String(nv.removedTestCaseId)} from plan`
      if (nv?.caseOrders != null) return 'Reordered cases in plan'
      if (nv?.linkedSetupId != null) return `Linked setup ${String(nv.linkedSetupId)}`
      if (nv?.unlinkedSetupId != null) return `Unlinked setup ${String(nv.unlinkedSetupId)}`
      if (nv?.verificationLink != null) return 'Linked verification element'
      if (ov?.verificationLink != null && !nv?.verificationLink) return 'Unlinked verification element'
      return 'Updated'
    default:
      return action
  }
}

function mapEvent(
  ev: {
    id: string
    projectId: string
    entityType: string
    entityId: string
    action: string
    oldValue: unknown
    newValue: unknown
    performedByUserId: string | null
    performedAt: Date
  },
  includeRaw: boolean
) {
  const base = {
    id: ev.id,
    projectId: ev.projectId,
    entityType: ev.entityType,
    entityId: ev.entityId,
    action: ev.action,
    performedAt: ev.performedAt.toISOString(),
    performedByUserId: ev.performedByUserId,
    summary: summarizeAuditEvent({
      action: ev.action,
      oldValue: ev.oldValue,
      newValue: ev.newValue,
    }),
  }
  if (!includeRaw) return base
  return {
    ...base,
    oldValue: ev.oldValue,
    newValue: ev.newValue,
  }
}

/** GET /verification/audit/:projectId/entity/:entityType/:entityId */
export const getEntityAuditTrail = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, entityType, entityId } = req.params
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 100
    const offset = req.query.offset ? parseInt(String(req.query.offset), 10) : 0
    const includeRaw = String(req.query.includeRaw) === '1' || String(req.query.includeRaw) === 'true'
    const actionsParam = req.query.actions
    const actions =
      typeof actionsParam === 'string' && actionsParam.trim()
        ? actionsParam.split(',').map((a) => a.trim()).filter(Boolean)
        : undefined

    const rows = await auditService.listEntityAuditTrail({
      projectId,
      entityType,
      entityId,
      limit: Number.isFinite(limit) ? limit : 100,
      offset: Number.isFinite(offset) ? offset : 0,
      actions,
    })

    res.json({
      success: true,
      data: rows.map((e) => mapEvent(e as any, includeRaw)),
    })
  } catch (error: any) {
    console.error('getEntityAuditTrail error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

/** GET /verification/audit/:projectId */
export const getProjectAuditTrail = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 100
    const offset = req.query.offset ? parseInt(String(req.query.offset), 10) : 0
    const includeRaw = String(req.query.includeRaw) === '1' || String(req.query.includeRaw) === 'true'
    const entityType = typeof req.query.entityType === 'string' ? req.query.entityType : undefined
    const actionsParam = req.query.actions
    const actions =
      typeof actionsParam === 'string' && actionsParam.trim()
        ? actionsParam.split(',').map((a) => a.trim()).filter(Boolean)
        : undefined
    const from = typeof req.query.from === 'string' && req.query.from ? new Date(req.query.from) : undefined
    const to = typeof req.query.to === 'string' && req.query.to ? new Date(req.query.to) : undefined

    const rows = await auditService.listProjectAuditTrail({
      projectId,
      limit: Number.isFinite(limit) ? limit : 100,
      offset: Number.isFinite(offset) ? offset : 0,
      entityType,
      actions,
      performedAtGte: from && !Number.isNaN(from.getTime()) ? from : undefined,
      performedAtLte: to && !Number.isNaN(to.getTime()) ? to : undefined,
    })

    res.json({
      success: true,
      data: rows.map((e) => mapEvent(e as any, includeRaw)),
    })
  } catch (error: any) {
    console.error('getProjectAuditTrail error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}
