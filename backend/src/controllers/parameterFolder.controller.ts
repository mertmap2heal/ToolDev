import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma'

// GET /parameters/:projectId/folders
export const getFolders = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const folders = await prisma.parameterFolder.findMany({
      where: { projectId },
      include: {
        _count: { select: { parameters: true } },
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    })
    res.json({ success: true, data: folders })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}

// POST /parameters/:projectId/folders
export const createFolder = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { name, description, color, parentId, order } = req.body as {
      name: string
      description?: string
      color?: string
      parentId?: string | null
      order?: number
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Folder name is required' })
    }

    const folder = await prisma.parameterFolder.create({
      data: {
        name: name.trim(),
        description: description ?? null,
        color: color ?? null,
        parentId: parentId ?? null,
        order: order ?? 0,
        projectId,
      },
      include: {
        _count: { select: { parameters: true } },
      },
    })
    res.status(201).json({ success: true, data: folder })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}

// PATCH /parameters/:projectId/folders/:folderId
export const updateFolder = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, folderId } = req.params
    const { name, description, color, parentId, order } = req.body as {
      name?: string
      description?: string
      color?: string | null
      parentId?: string | null
      order?: number
    }

    const existing = await prisma.parameterFolder.findFirst({
      where: { id: folderId, projectId },
    })
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Folder not found' })
    }

    const updated = await prisma.parameterFolder.update({
      where: { id: folderId },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(color !== undefined ? { color } : {}),
        ...(parentId !== undefined ? { parentId } : {}),
        ...(order !== undefined ? { order } : {}),
      },
      include: {
        _count: { select: { parameters: true } },
      },
    })
    res.json({ success: true, data: updated })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}

// DELETE /parameters/:projectId/folders/:folderId
// Moves all parameters in the folder to root (folderId = null) before deleting
export const deleteFolder = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, folderId } = req.params

    const existing = await prisma.parameterFolder.findFirst({
      where: { id: folderId, projectId },
    })
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Folder not found' })
    }

    // Move parameters to root
    await prisma.parameter.updateMany({
      where: { folderId, projectId },
      data: { folderId: null },
    })

    // Move any child folders to root (parentId = null)
    await prisma.parameterFolder.updateMany({
      where: { parentId: folderId, projectId },
      data: { parentId: null },
    })

    await prisma.parameterFolder.delete({ where: { id: folderId } })
    res.json({ success: true, data: null })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}

// PATCH /parameters/:projectId/folders/reorder
// Accepts [{ id, order }] and updates all folder orders in one transaction
export const reorderFolders = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { items } = req.body as { items: Array<{ id: string; order: number }> }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'items array is required' })
    }

    await prisma.$transaction(
      items.map(({ id, order }) =>
        prisma.parameterFolder.updateMany({
          where: { id, projectId },
          data: { order },
        })
      )
    )

    res.json({ success: true, data: null })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}

// PATCH /parameters/:projectId/:id/folder
// Move a parameter to a folder (or root if folderId is null)
export const moveParameterToFolder = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const { folderId } = req.body as { folderId: string | null }

    const param = await prisma.parameter.findFirst({
      where: { id, projectId },
    })
    if (!param) {
      return res.status(404).json({ success: false, error: 'Parameter not found' })
    }

    // If folderId is provided, verify it belongs to the same project
    if (folderId) {
      const folder = await prisma.parameterFolder.findFirst({
        where: { id: folderId, projectId },
      })
      if (!folder) {
        return res.status(404).json({ success: false, error: 'Folder not found' })
      }
    }

    const updated = await prisma.parameter.update({
      where: { id },
      data: { folderId: folderId ?? null },
    })
    res.json({ success: true, data: updated })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}
