import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma'

const VIEW_KIND = 'traceability_matrix'
const VIEW_TYPE = 'project' // project-shared, per requirement
const MAX_PAGE_SIZE = 200

function safeJsonStringify(v: unknown): string {
  return JSON.stringify(v ?? null)
}

function safeJsonParse(v: any): any {
  if (v == null) return null
  if (typeof v !== 'string') return null
  try {
    return JSON.parse(v)
  } catch {
    return null
  }
}

async function ensureInitialRevision(projectId: string, view: any, performedByUserId?: string) {
  const revAny = (prisma as any).savedViewRevision
  if (!revAny) return
  const existing = await revAny.findFirst({
    where: { projectId, viewId: view.id, revisionNumber: 1 },
    select: { id: true },
  })
  if (existing) return
  await revAny.create({
    data: {
      projectId,
      viewId: view.id,
      revisionNumber: 1,
      nameSnapshot: view.name,
      folderIdSnapshot: view.folderId ?? null,
      definitionJsonSnapshot: view.definitionJson ?? null,
      createdByUserId: performedByUserId ?? null,
    },
  })
}

async function createRevisionAndAudit(params: {
  projectId: string
  viewId: string
  action: string
  oldView: any | null
  newView: any | null
  performedByUserId?: string
}) {
  const { projectId, viewId, action, oldView, newView, performedByUserId } = params
  const revAny = (prisma as any).savedViewRevision
  const auditAny = (prisma as any).savedViewAuditEvent
  const tx: any[] = []

  if (revAny && newView) {
    const maxRev = await revAny.findFirst({
      where: { projectId, viewId },
      orderBy: { revisionNumber: 'desc' },
      select: { revisionNumber: true },
    })
    const nextRev = (maxRev?.revisionNumber ?? 0) + 1
    tx.push(
      revAny.create({
        data: {
          projectId,
          viewId,
          revisionNumber: nextRev,
          nameSnapshot: newView.name,
          folderIdSnapshot: newView.folderId ?? null,
          definitionJsonSnapshot: newView.definitionJson ?? null,
          createdByUserId: performedByUserId ?? null,
        },
      })
    )
  }

  if (auditAny) {
    tx.push(
      auditAny.create({
        data: {
          projectId,
          viewId,
          action,
          oldValueJson: oldView
            ? {
                name: oldView.name,
                folderId: oldView.folderId ?? null,
                definition: safeJsonParse(oldView.definitionJson),
              }
            : null,
          newValueJson: newView
            ? {
                name: newView.name,
                folderId: newView.folderId ?? null,
                definition: safeJsonParse(newView.definitionJson),
              }
            : null,
          performedByUserId: performedByUserId ?? null,
        },
      })
    )
  }

  if (tx.length) {
    await prisma.$transaction(tx)
  }
}

function normType(t: string | undefined): string {
  return (t ?? '').toLowerCase().replace(/-/g, '_')
}

function isReqLike(t: string | undefined): boolean {
  const n = normType(t)
  return n === 'requirement' || n === 'hazard' || n === 'risk'
}

function edgeKey(l: { sourceType: string; sourceId: string; targetType: string; targetId: string; linkType?: string }) {
  return `${normType(l.sourceType)}:${l.sourceId}:${normType(l.targetType)}:${l.targetId}:${l.linkType ?? ''}`
}

function extractLinksFromBaselineSnapshot(snapshot: any): any[] {
  if (!snapshot) return []
  if (Array.isArray(snapshot)) return snapshot
  if (typeof snapshot === 'object' && Array.isArray(snapshot.links)) return snapshot.links
  return []
}

function computeCoverageStats(params: {
  rowIds: Set<string>
  links: any[]
  linkageTargetType: string
  pinnedTargetIds?: Set<string> | null
}): {
  rowCount: number
  targetCount: number
  totalLinks: number
  suspectLinks: number
  sourcesWithLinks: number
  targetsWithLinks: number
  sourceCoveragePct: number
  targetCoveragePct: number
} {
  const { rowIds, links, linkageTargetType, pinnedTargetIds } = params
  const targetTypeNorm = normType(linkageTargetType)

  let totalLinks = 0
  let suspectLinks = 0
  const linkedSources = new Set<string>()
  const linkedTargets = new Set<string>()

  for (const l of links) {
    const st = normType(l.sourceType)
    const tt = normType(l.targetType)
    const sId = String(l.sourceId ?? '')
    const tId = String(l.targetId ?? '')
    const suspect = !!(l.isSuspect || l.status === 'suspect')

    // only count edges between requirement-like rows and selected target type
    const forward = isReqLike(st) && tt === targetTypeNorm
    const reverse = st === targetTypeNorm && isReqLike(tt)
    if (!forward && !reverse) continue

    const reqId = forward ? sId : tId
    const targetId = forward ? tId : sId

    if (!rowIds.has(reqId)) continue
    if (pinnedTargetIds && pinnedTargetIds.size > 0 && !pinnedTargetIds.has(targetId)) continue

    totalLinks++
    if (suspect) suspectLinks++
    linkedSources.add(reqId)
    linkedTargets.add(targetId)
  }

  const rowCount = rowIds.size
  const targetCount = pinnedTargetIds?.size ?? linkedTargets.size
  const sourcesWithLinks = linkedSources.size
  const targetsWithLinks = linkedTargets.size

  return {
    rowCount,
    targetCount,
    totalLinks,
    suspectLinks,
    sourcesWithLinks,
    targetsWithLinks,
    sourceCoveragePct: rowCount > 0 ? Math.round((sourcesWithLinks / rowCount) * 100) : 0,
    targetCoveragePct: targetCount > 0 ? Math.round((targetsWithLinks / targetCount) * 100) : 0,
  }
}

async function assertFolderInProject(projectId: string, folderId: string) {
  const folder = await (prisma as any).savedViewFolder.findFirst({
    where: { id: folderId, projectId },
    select: { id: true },
  })
  if (!folder) throw new Error('Folder not found in this project')
}

async function wouldCreateCycle(projectId: string, folderId: string, newParentId: string) {
  // Walk up from newParentId and ensure we never reach folderId
  let cur: string | null = newParentId
  for (let i = 0; i < 100; i++) {
    if (!cur) return false
    if (cur === folderId) return true
    // eslint-disable-next-line no-await-in-loop
    const parent: { parentId: string | null } | null = await (prisma as any).savedViewFolder.findFirst({
      where: { id: cur, projectId },
      select: { parentId: true },
    })
    cur = parent?.parentId ?? null
  }
  return true
}

export async function listTraceabilityViewFolders(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const folders = await (prisma as any).savedViewFolder.findMany({
      where: { projectId },
      orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    })
    res.json({ success: true, data: folders })
  } catch (e) {
    console.error('TraceabilityViews list folders error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function createTraceabilityViewFolder(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const { name, description, parentId, sortOrder } = req.body ?? {}
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: 'name is required' })
    }
    let parentIdNorm: string | null = null
    if (parentId != null && parentId !== '') {
      if (typeof parentId !== 'string') return res.status(400).json({ success: false, error: 'parentId must be a string' })
      await assertFolderInProject(projectId, parentId)
      parentIdNorm = parentId
    }
    const folder = await (prisma as any).savedViewFolder.create({
      data: {
        projectId,
        parentId: parentIdNorm,
        name: name.trim(),
        description: typeof description === 'string' ? description.trim() || null : null,
        sortOrder: typeof sortOrder === 'number' && Number.isFinite(sortOrder) ? sortOrder : 0,
      },
    })
    res.status(201).json({ success: true, data: folder })
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : String(e)
    res.status(500).json({ success: false, error: msg || 'Internal server error' })
  }
}

export async function updateTraceabilityViewFolder(req: AuthRequest, res: Response) {
  try {
    const { projectId, folderId } = req.params
    const existing = await (prisma as any).savedViewFolder.findFirst({ where: { id: folderId, projectId } })
    if (!existing) return res.status(404).json({ success: false, error: 'Folder not found' })

    const { name, description, parentId, sortOrder } = req.body ?? {}
    const data: any = {}
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ success: false, error: 'name cannot be empty' })
      data.name = name.trim()
    }
    if (description !== undefined) data.description = typeof description === 'string' ? description.trim() || null : null
    if (sortOrder !== undefined) {
      if (typeof sortOrder !== 'number' || !Number.isFinite(sortOrder)) return res.status(400).json({ success: false, error: 'sortOrder must be a number' })
      data.sortOrder = sortOrder
    }
    if (parentId !== undefined) {
      if (parentId === folderId) return res.status(400).json({ success: false, error: 'Folder cannot be its own parent' })
      if (parentId === null || parentId === '') {
        data.parentId = null
      } else {
        if (typeof parentId !== 'string') return res.status(400).json({ success: false, error: 'parentId must be a string or null' })
        await assertFolderInProject(projectId, parentId)
        if (await wouldCreateCycle(projectId, folderId, parentId)) {
          return res.status(400).json({ success: false, error: 'Invalid parent: would create a cycle' })
        }
        data.parentId = parentId
      }
    }

    const folder = await (prisma as any).savedViewFolder.update({ where: { id: folderId }, data })
    res.json({ success: true, data: folder })
  } catch (e) {
    console.error('TraceabilityViews update folder error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function deleteTraceabilityViewFolder(req: AuthRequest, res: Response) {
  try {
    const { projectId, folderId } = req.params
    const existing = await (prisma as any).savedViewFolder.findFirst({ where: { id: folderId, projectId } })
    if (!existing) return res.status(404).json({ success: false, error: 'Folder not found' })

    // Deleting folder cascades children; views will be set to null folderId (FK ON DELETE SET NULL).
    await (prisma as any).savedViewFolder.delete({ where: { id: folderId } })
    res.json({ success: true, data: null })
  } catch (e) {
    console.error('TraceabilityViews delete folder error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function listTraceabilityViews(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const { folderId, q, targetType, suspectOnly, sort, dir, hasObjectives } = req.query as any
    const qStr = typeof q === 'string' ? q.trim() : ''
    const views = await prisma.savedView.findMany({
      where: {
        projectId,
        type: VIEW_TYPE,
        viewKind: VIEW_KIND,
        ...(folderId === undefined ? {} : folderId === '' ? { folderId: null } : { folderId }),
        ...(qStr ? { name: { contains: qStr, mode: 'insensitive' as any } } : {}),
      },
      orderBy: [
        sort === 'name'
          ? { name: (dir === 'asc' ? 'asc' : 'desc') as any }
          : { updatedAt: (dir === 'asc' ? 'asc' : 'desc') as any },
      ],
    })

    // Filter by definition-derived fields in-memory for now (keeps schema stable).
    // For large datasets we can denormalize into SavedView columns later.
    const filtered = views.filter((v: any) => {
      const def = safeJsonParse(v.definitionJson) ?? {}
      if (typeof targetType === 'string' && targetType.trim() && String(def.linkageTargetType ?? '') !== targetType.trim()) return false
      if (suspectOnly === '1' || suspectOnly === 'true') {
        if (!def.showSuspectOnly) return false
      }
      if (hasObjectives === '1' || hasObjectives === 'true') {
        if (!def.objectives || typeof def.objectives !== 'object') return false
      }
      return true
    })

    res.json({ success: true, data: filtered })
  } catch (e) {
    console.error('TraceabilityViews list views error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function getTraceabilityView(req: AuthRequest, res: Response) {
  try {
    const { projectId, viewId } = req.params
    const view = await prisma.savedView.findFirst({
      where: { id: viewId, projectId, type: VIEW_TYPE, viewKind: VIEW_KIND },
    })
    if (!view) return res.status(404).json({ success: false, error: 'View not found' })
    res.json({ success: true, data: view })
  } catch (e) {
    console.error('TraceabilityViews get view error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function createTraceabilityView(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const { name, folderId, definition } = req.body ?? {}
    const performedByUserId = req.user?.id
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: 'name is required' })
    }
    if (folderId != null && folderId !== '') {
      if (typeof folderId !== 'string') return res.status(400).json({ success: false, error: 'folderId must be a string' })
      await assertFolderInProject(projectId, folderId)
    }

    const created = await prisma.savedView.create({
      data: {
        projectId,
        name: name.trim(),
        type: VIEW_TYPE,
        viewKind: VIEW_KIND,
        folderId: folderId ? String(folderId) : null,
        definitionJson: definition ? safeJsonStringify(definition) : null,
      },
    })
    await ensureInitialRevision(projectId, created, performedByUserId)
    await createRevisionAndAudit({
      projectId,
      viewId: created.id,
      action: 'CREATE_VIEW',
      oldView: null,
      newView: created,
      performedByUserId,
    })
    res.status(201).json({ success: true, data: created })
  } catch (e) {
    console.error('TraceabilityViews create view error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function updateTraceabilityView(req: AuthRequest, res: Response) {
  try {
    const { projectId, viewId } = req.params
    const performedByUserId = req.user?.id
    const existing = await prisma.savedView.findFirst({
      where: { id: viewId, projectId, type: VIEW_TYPE, viewKind: VIEW_KIND },
    })
    if (!existing) return res.status(404).json({ success: false, error: 'View not found' })
    await ensureInitialRevision(projectId, existing, performedByUserId)

    const { name, folderId, definition } = req.body ?? {}
    const data: any = {}
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ success: false, error: 'name cannot be empty' })
      data.name = name.trim()
    }
    if (folderId !== undefined) {
      if (folderId === null || folderId === '') {
        data.folderId = null
      } else {
        if (typeof folderId !== 'string') return res.status(400).json({ success: false, error: 'folderId must be a string or null' })
        await assertFolderInProject(projectId, folderId)
        data.folderId = folderId
      }
    }
    if (definition !== undefined) {
      data.definitionJson = definition ? safeJsonStringify(definition) : null
    }

    const updated = await prisma.savedView.update({ where: { id: viewId }, data })
    const changed =
      (data.name !== undefined && data.name !== existing.name) ||
      (data.folderId !== undefined && (data.folderId ?? null) !== (existing.folderId ?? null)) ||
      (data.definitionJson !== undefined && (data.definitionJson ?? null) !== (existing.definitionJson ?? null))
    if (changed) {
      await createRevisionAndAudit({
        projectId,
        viewId,
        action: 'UPDATE_VIEW',
        oldView: existing,
        newView: updated,
        performedByUserId,
      })
    }
    res.json({ success: true, data: updated })
  } catch (e) {
    console.error('TraceabilityViews update view error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function deleteTraceabilityView(req: AuthRequest, res: Response) {
  try {
    const { projectId, viewId } = req.params
    const performedByUserId = req.user?.id
    const existing = await prisma.savedView.findFirst({
      where: { id: viewId, projectId, type: VIEW_TYPE, viewKind: VIEW_KIND },
    })
    if (!existing) return res.status(404).json({ success: false, error: 'View not found' })
    await ensureInitialRevision(projectId, existing, performedByUserId)
    await createRevisionAndAudit({
      projectId,
      viewId,
      action: 'DELETE_VIEW',
      oldView: existing,
      newView: null,
      performedByUserId,
    })
    await prisma.savedView.delete({ where: { id: viewId } })
    res.json({ success: true, data: null })
  } catch (e) {
    console.error('TraceabilityViews delete view error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function listTraceabilityViewRevisions(req: AuthRequest, res: Response) {
  try {
    const { projectId, viewId } = req.params
    const revAny = (prisma as any).savedViewRevision
    if (!revAny) return res.status(501).json({ success: false, error: 'Revisions not enabled' })

    const rows = await revAny.findMany({
      where: { projectId, viewId },
      orderBy: { revisionNumber: 'desc' },
      take: 200,
    })
    res.json({ success: true, data: rows })
  } catch (e) {
    console.error('TraceabilityViews list revisions error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function getTraceabilityViewRevision(req: AuthRequest, res: Response) {
  try {
    const { projectId, viewId, revisionNumber } = req.params as any
    const n = Number(revisionNumber)
    if (!Number.isFinite(n) || n <= 0) return res.status(400).json({ success: false, error: 'Invalid revisionNumber' })
    const revAny = (prisma as any).savedViewRevision
    if (!revAny) return res.status(501).json({ success: false, error: 'Revisions not enabled' })
    const row = await revAny.findFirst({
      where: { projectId, viewId, revisionNumber: n },
    })
    if (!row) return res.status(404).json({ success: false, error: 'Revision not found' })
    res.json({ success: true, data: row })
  } catch (e) {
    console.error('TraceabilityViews get revision error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function rollbackTraceabilityView(req: AuthRequest, res: Response) {
  try {
    const { projectId, viewId } = req.params
    const performedByUserId = req.user?.id
    const { targetRevisionNumber } = req.body ?? {}
    const n = Number(targetRevisionNumber)
    if (!Number.isFinite(n) || n <= 0) return res.status(400).json({ success: false, error: 'targetRevisionNumber must be a positive number' })

    const view = await prisma.savedView.findFirst({
      where: { id: viewId, projectId, type: VIEW_TYPE, viewKind: VIEW_KIND },
    })
    if (!view) return res.status(404).json({ success: false, error: 'View not found' })

    const revAny = (prisma as any).savedViewRevision
    if (!revAny) return res.status(501).json({ success: false, error: 'Revisions not enabled' })

    const rev = await revAny.findFirst({
      where: { projectId, viewId, revisionNumber: n },
    })
    if (!rev) return res.status(404).json({ success: false, error: 'Revision not found' })

    const updated = await prisma.savedView.update({
      where: { id: viewId },
      data: {
        name: rev.nameSnapshot,
        folderId: rev.folderIdSnapshot ?? null,
        definitionJson: rev.definitionJsonSnapshot ?? null,
      },
    })
    await createRevisionAndAudit({
      projectId,
      viewId,
      action: 'ROLLBACK_VIEW',
      oldView: view,
      newView: updated,
      performedByUserId,
    })
    res.json({ success: true, data: updated })
  } catch (e) {
    console.error('TraceabilityViews rollback error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function listTraceabilityViewAuditEvents(req: AuthRequest, res: Response) {
  try {
    const { projectId, viewId } = req.params
    const { cursor, limit } = req.query as any
    const pageSize = Math.max(1, Math.min(MAX_PAGE_SIZE, Number(limit) || 50))
    const auditAny = (prisma as any).savedViewAuditEvent
    if (!auditAny) return res.status(501).json({ success: false, error: 'Audit not enabled' })

    const where: any = { projectId, viewId }
    const rows = await auditAny.findMany({
      where,
      orderBy: { performedAt: 'desc' },
      take: pageSize,
      ...(cursor ? { skip: 1, cursor: { id: String(cursor) } } : {}),
    })
    const nextCursor = rows.length === pageSize ? rows[rows.length - 1]?.id : null
    res.json({ success: true, data: rows, nextCursor })
  } catch (e) {
    console.error('TraceabilityViews list audit error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function runTraceabilityViewAtBaseline(req: AuthRequest, res: Response) {
  try {
    const { projectId, viewId } = req.params
    const { baselineId } = req.query as any
    if (!baselineId || typeof baselineId !== 'string') {
      return res.status(400).json({ success: false, error: 'baselineId is required' })
    }
    const view = await prisma.savedView.findFirst({
      where: { id: viewId, projectId, type: VIEW_TYPE, viewKind: VIEW_KIND },
    })
    if (!view) return res.status(404).json({ success: false, error: 'View not found' })

    const baseline = await (prisma as any).baseline.findFirst({
      where: { id: baselineId, projectId },
      include: { items: true },
    })
    if (!baseline) return res.status(404).json({ success: false, error: 'Baseline not found' })

    const def = safeJsonParse(view.definitionJson) ?? {}
    const linkageTargetType = String(def.linkageTargetType ?? 'pbs_component')

    const rowIds = new Set<string>((baseline.items ?? []).map((i: any) => i.requirementId).filter(Boolean))
    const pinnedTargets = Array.isArray(def.pinnedTargetIds) ? new Set<string>(def.pinnedTargetIds.filter(Boolean)) : null

    const links = extractLinksFromBaselineSnapshot(baseline.linksSnapshot)
    const stats = computeCoverageStats({ rowIds, links, linkageTargetType, pinnedTargetIds: pinnedTargets })

    res.json({
      success: true,
      data: {
        baseline: { id: baseline.id, name: baseline.name },
        view: { id: view.id, name: view.name },
        linkageTargetType,
        stats,
      },
    })
  } catch (e) {
    console.error('TraceabilityViews run baseline error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function compareTraceabilityViewToCurrent(req: AuthRequest, res: Response) {
  try {
    const { projectId, viewId } = req.params
    const { baselineId } = req.query as any
    if (!baselineId || typeof baselineId !== 'string') {
      return res.status(400).json({ success: false, error: 'baselineId is required' })
    }

    const view = await prisma.savedView.findFirst({
      where: { id: viewId, projectId, type: VIEW_TYPE, viewKind: VIEW_KIND },
    })
    if (!view) return res.status(404).json({ success: false, error: 'View not found' })

    const baseline = await (prisma as any).baseline.findFirst({
      where: { id: baselineId, projectId },
      include: { items: true },
    })
    if (!baseline) return res.status(404).json({ success: false, error: 'Baseline not found' })

    const def = safeJsonParse(view.definitionJson) ?? {}
    const linkageTargetType = String(def.linkageTargetType ?? 'pbs_component')
    const rowIds = new Set<string>((baseline.items ?? []).map((i: any) => i.requirementId).filter(Boolean))
    const pinnedTargets = Array.isArray(def.pinnedTargetIds) ? new Set<string>(def.pinnedTargetIds.filter(Boolean)) : null

    const baselineLinks = extractLinksFromBaselineSnapshot(baseline.linksSnapshot)
    const currentLinks = await prisma.traceLink.findMany({ where: { projectId } })

    const baselineStats = computeCoverageStats({ rowIds, links: baselineLinks, linkageTargetType, pinnedTargetIds: pinnedTargets })
    const currentStats = computeCoverageStats({ rowIds, links: currentLinks as any[], linkageTargetType, pinnedTargetIds: pinnedTargets })

    // delta edges (scoped to rows/targets)
    const toScopedKeys = (links: any[]) => {
      const out = new Set<string>()
      const targetTypeNorm = normType(linkageTargetType)
      for (const l of links) {
        const st = normType(l.sourceType)
        const tt = normType(l.targetType)
        const sId = String(l.sourceId ?? '')
        const tId = String(l.targetId ?? '')
        const forward = isReqLike(st) && tt === targetTypeNorm
        const reverse = st === targetTypeNorm && isReqLike(tt)
        if (!forward && !reverse) continue
        const reqId = forward ? sId : tId
        const targetId = forward ? tId : sId
        if (!rowIds.has(reqId)) continue
        if (pinnedTargets && pinnedTargets.size > 0 && !pinnedTargets.has(targetId)) continue
        out.add(edgeKey({ sourceType: l.sourceType, sourceId: sId, targetType: l.targetType, targetId: tId, linkType: l.linkType }))
      }
      return out
    }

    const baseKeys = toScopedKeys(baselineLinks)
    const curKeys = toScopedKeys(currentLinks as any[])
    const added: string[] = []
    const removed: string[] = []
    for (const k of curKeys) if (!baseKeys.has(k)) added.push(k)
    for (const k of baseKeys) if (!curKeys.has(k)) removed.push(k)

    res.json({
      success: true,
      data: {
        baseline: { id: baseline.id, name: baseline.name },
        view: { id: view.id, name: view.name },
        linkageTargetType,
        stats: { baseline: baselineStats, current: currentStats },
        delta: {
          linksAdded: added.length,
          linksRemoved: removed.length,
          addedSample: added.slice(0, 50),
          removedSample: removed.slice(0, 50),
        },
      },
    })
  } catch (e) {
    console.error('TraceabilityViews compare baseline error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

