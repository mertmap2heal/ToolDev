import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma'

const VIEW_KIND = 'traceability_matrix'
const VIEW_TYPE = 'project' // project-shared, per requirement

function safeJsonStringify(v: unknown): string {
  return JSON.stringify(v ?? null)
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
    const parent = await (prisma as any).savedViewFolder.findFirst({
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
    const { folderId } = req.query as { folderId?: string }
    const views = await prisma.savedView.findMany({
      where: {
        projectId,
        type: VIEW_TYPE,
        viewKind: VIEW_KIND,
        ...(folderId === undefined ? {} : folderId === '' ? { folderId: null } : { folderId }),
      },
      orderBy: [{ createdAt: 'desc' }],
    })
    res.json({ success: true, data: views })
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
    res.status(201).json({ success: true, data: created })
  } catch (e) {
    console.error('TraceabilityViews create view error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function updateTraceabilityView(req: AuthRequest, res: Response) {
  try {
    const { projectId, viewId } = req.params
    const existing = await prisma.savedView.findFirst({
      where: { id: viewId, projectId, type: VIEW_TYPE, viewKind: VIEW_KIND },
    })
    if (!existing) return res.status(404).json({ success: false, error: 'View not found' })

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
    res.json({ success: true, data: updated })
  } catch (e) {
    console.error('TraceabilityViews update view error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function deleteTraceabilityView(req: AuthRequest, res: Response) {
  try {
    const { projectId, viewId } = req.params
    const existing = await prisma.savedView.findFirst({
      where: { id: viewId, projectId, type: VIEW_TYPE, viewKind: VIEW_KIND },
    })
    if (!existing) return res.status(404).json({ success: false, error: 'View not found' })
    await prisma.savedView.delete({ where: { id: viewId } })
    res.json({ success: true, data: null })
  } catch (e) {
    console.error('TraceabilityViews delete view error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

