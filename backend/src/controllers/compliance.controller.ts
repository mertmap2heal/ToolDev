import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { PrismaClient } from '@prisma/client'
import * as complianceService from '../services/compliance.service'

const prisma = new PrismaClient()

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
    const { name, standard, description, checkType } = req.body
    if (!name || !standard || !checkType) {
      return res.status(400).json({
        success: false,
        error: 'name, standard, and checkType are required',
      })
    }
    const rule = await prisma.complianceRule.create({
      data: {
        projectId,
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
    const { name, standard, description, checkType, isActive } = req.body
    const existing = await prisma.complianceRule.findFirst({
      where: { id, projectId },
    })
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Rule not found' })
    }
    const rule = await prisma.complianceRule.update({
      where: { id },
      data: {
        ...(name != null && { name }),
        ...(standard != null && { standard }),
        ...(description !== undefined && { description }),
        ...(checkType != null && { checkType }),
        ...(typeof isActive === 'boolean' && { isActive }),
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
