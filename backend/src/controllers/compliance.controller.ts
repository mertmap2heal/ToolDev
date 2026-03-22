import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma'
import * as complianceService from '../services/compliance.service'
import * as regulationFolders from '../services/complianceRegulationFolders.service'

export async function getRegulationFolders(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const folders = await prisma.complianceRegulationFolder.findMany({
      where: { projectId },
      orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    })
    res.json({ success: true, data: folders })
  } catch (e) {
    console.error('Compliance getRegulationFolders error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function createRegulationFolder(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const { name, description, purpose, parentId, sortOrder } = req.body ?? {}
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: 'name is required' })
    }
    let parentIdNorm: string | null = null
    if (parentId != null && parentId !== '') {
      if (typeof parentId !== 'string') {
        return res.status(400).json({ success: false, error: 'parentId must be a string' })
      }
      await regulationFolders.assertFolderInProject(projectId, parentId)
      parentIdNorm = parentId
    }
    const folder = await prisma.complianceRegulationFolder.create({
      data: {
        projectId,
        parentId: parentIdNorm,
        name: name.trim(),
        description: typeof description === 'string' ? description.trim() || null : null,
        purpose: typeof purpose === 'string' ? purpose.trim() || null : null,
        sortOrder: typeof sortOrder === 'number' && Number.isFinite(sortOrder) ? sortOrder : 0,
      },
    })
    res.status(201).json({ success: true, data: folder })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('not found') || msg.includes('does not belong')) {
      return res.status(400).json({ success: false, error: msg })
    }
    console.error('Compliance createRegulationFolder error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function updateRegulationFolder(req: AuthRequest, res: Response) {
  try {
    const { projectId, id } = req.params
    const existing = await prisma.complianceRegulationFolder.findFirst({
      where: { id, projectId },
    })
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Folder not found' })
    }
    const { name, description, purpose, parentId, sortOrder } = req.body ?? {}
    const data: {
      name?: string
      description?: string | null
      purpose?: string | null
      parentId?: string | null
      sortOrder?: number
    } = {}

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ success: false, error: 'name cannot be empty' })
      }
      data.name = name.trim()
    }
    if (description !== undefined) {
      data.description = typeof description === 'string' ? description.trim() || null : null
    }
    if (purpose !== undefined) {
      data.purpose = typeof purpose === 'string' ? purpose.trim() || null : null
    }
    if (sortOrder !== undefined) {
      if (typeof sortOrder !== 'number' || !Number.isFinite(sortOrder)) {
        return res.status(400).json({ success: false, error: 'sortOrder must be a number' })
      }
      data.sortOrder = sortOrder
    }
    if (parentId !== undefined) {
      if (parentId === id) {
        return res.status(400).json({ success: false, error: 'Folder cannot be its own parent' })
      }
      if (parentId === null || parentId === '') {
        data.parentId = null
      } else {
        if (typeof parentId !== 'string') {
          return res.status(400).json({ success: false, error: 'parentId must be a string or null' })
        }
        await regulationFolders.assertFolderInProject(projectId, parentId)
        const cycle = await regulationFolders.isAncestorOf(projectId, id, parentId)
        if (cycle) {
          return res.status(400).json({
            success: false,
            error: 'Invalid parent: would create a cycle in the folder hierarchy',
          })
        }
        data.parentId = parentId
      }
    }

    if (Object.keys(data).length === 0) {
      return res.json({ success: true, data: existing })
    }

    const folder = await prisma.complianceRegulationFolder.update({
      where: { id },
      data,
    })
    res.json({ success: true, data: folder })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('not found') || msg.includes('does not belong')) {
      return res.status(400).json({ success: false, error: msg })
    }
    console.error('Compliance updateRegulationFolder error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function deleteRegulationFolder(req: AuthRequest, res: Response) {
  try {
    const { projectId, id } = req.params
    const existing = await prisma.complianceRegulationFolder.findFirst({
      where: { id, projectId },
    })
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Folder not found' })
    }
    await regulationFolders.deleteRegulationFolder(projectId, id)
    res.json({ success: true, message: 'Folder deleted' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg === 'Folder not found') {
      return res.status(404).json({ success: false, error: msg })
    }
    console.error('Compliance deleteRegulationFolder error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function getRules(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const rules = await prisma.complianceRule.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ success: true, data: rules })
  } catch (e) {
    console.error('Compliance getRules error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function createRule(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const { name, standard, description, checkType, folderId: folderIdRaw } = req.body
    if (!name || !standard || !checkType) {
      return res.status(400).json({
        success: false,
        error: 'name, standard, and checkType are required',
      })
    }
    let folderId: string | null = null
    try {
      folderId = await regulationFolders.resolveRuleFolderId(projectId, folderIdRaw)
    } catch (fe) {
      const m = fe instanceof Error ? fe.message : String(fe)
      return res.status(400).json({ success: false, error: m })
    }
    const rule = await prisma.complianceRule.create({
      data: {
        projectId,
        folderId,
        name,
        standard,
        description: description ?? null,
        checkType,
        isActive: true,
      },
    })
    res.status(201).json({ success: true, data: rule })
  } catch (e) {
    console.error('Compliance createRule error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function getRule(req: AuthRequest, res: Response) {
  try {
    const { projectId, id } = req.params
    const rule = await prisma.complianceRule.findFirst({
      where: { id, projectId },
    })
    if (!rule) {
      return res.status(404).json({ success: false, error: 'Rule not found' })
    }
    res.json({ success: true, data: rule })
  } catch (e) {
    console.error('Compliance getRule error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function updateRule(req: AuthRequest, res: Response) {
  try {
    const { projectId, id } = req.params
    const { name, standard, description, checkType, isActive, folderId: folderIdRaw } = req.body
    const existing = await prisma.complianceRule.findFirst({
      where: { id, projectId },
    })
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Rule not found' })
    }
    let folderId: string | null | undefined
    if (folderIdRaw !== undefined) {
      try {
        folderId = await regulationFolders.resolveRuleFolderId(projectId, folderIdRaw)
      } catch (fe) {
        const m = fe instanceof Error ? fe.message : String(fe)
        return res.status(400).json({ success: false, error: m })
      }
    }
    const rule = await prisma.complianceRule.update({
      where: { id },
      data: {
        ...(name != null && { name }),
        ...(standard != null && { standard }),
        ...(description !== undefined && { description }),
        ...(checkType != null && { checkType }),
        ...(typeof isActive === 'boolean' && { isActive }),
        ...(folderId !== undefined && { folderId }),
      },
    })
    res.json({ success: true, data: rule })
  } catch (e) {
    console.error('Compliance updateRule error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function deleteRule(req: AuthRequest, res: Response) {
  try {
    const { projectId, id } = req.params
    const existing = await prisma.complianceRule.findFirst({
      where: { id, projectId },
    })
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Rule not found' })
    }
    await prisma.complianceRule.delete({ where: { id } })
    res.json({ success: true, message: 'Rule deleted' })
  } catch (e) {
    console.error('Compliance deleteRule error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function runChecks(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const { ruleIds, name } = req.body ?? {}
    const result = await complianceService.runComplianceChecks(projectId, {
      ruleIds: Array.isArray(ruleIds) ? ruleIds : undefined,
      name: typeof name === 'string' ? name : undefined,
    })
    if (result.error) {
      return res.status(400).json({ success: false, error: result.error })
    }
    res.status(201).json({
      success: true,
      data: { run: result.run, findings: result.findings },
    })
  } catch (e) {
    console.error('Compliance runChecks error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function getRuns(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const runs = await prisma.complianceCheckRun.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    res.json({ success: true, data: runs })
  } catch (e) {
    console.error('Compliance getRuns error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function getRun(req: AuthRequest, res: Response) {
  try {
    const { projectId, runId } = req.params
    const run = await prisma.complianceCheckRun.findFirst({
      where: { id: runId, projectId },
      include: { findings: { include: { rule: true } } },
    })
    if (!run) {
      return res.status(404).json({ success: false, error: 'Run not found' })
    }
    res.json({ success: true, data: run })
  } catch (e) {
    console.error('Compliance getRun error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export async function getFindings(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const runId = req.query.runId as string | undefined
    const ruleId = req.query.ruleId as string | undefined
    const where: { projectId: string; runId?: string; ruleId?: string } = { projectId }
    if (runId) where.runId = runId
    if (ruleId) where.ruleId = ruleId
    const findings = await prisma.complianceFinding.findMany({
      where,
      include: { rule: true },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 500,
    })
    res.json({ success: true, data: findings })
  } catch (e) {
    console.error('Compliance getFindings error:', e)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
