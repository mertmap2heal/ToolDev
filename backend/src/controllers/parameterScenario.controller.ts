import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import * as svc from '../services/parameterScenario.service'

export async function list(req: AuthRequest, res: Response) {
  try {
    const data = await svc.listScenarios(req.params.projectId)
    res.json({ success: true, data })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}

export async function get(req: AuthRequest, res: Response) {
  try {
    const scenario = await svc.getScenario(req.params.scenarioId, req.params.projectId)
    if (!scenario) {
      res.status(404).json({ success: false, error: 'scenario not found' })
      return
    }
    res.json({ success: true, data: scenario })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}

export async function create(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId
    if (!userId) {
      res.status(401).json({ success: false, error: 'unauthenticated' })
      return
    }
    const { name, description, overrides } = req.body as {
      name?: string
      description?: string
      overrides?: Array<{ parameterId: string; value: string }>
    }
    if (!name?.trim()) {
      res.status(400).json({ success: false, error: 'name required' })
      return
    }
    const data = await svc.createScenario({
      projectId: req.params.projectId,
      createdBy: userId,
      name: name.trim(),
      description: description?.trim() || undefined,
      overrides: overrides ?? [],
    })
    res.status(201).json({ success: true, data })
  } catch (e) {
    // Prisma unique-name violation surfaces as 400 with a clean message.
    const msg = (e as Error).message
    const code = msg.includes('Unique constraint') ? 400 : 500
    res
      .status(code)
      .json({ success: false, error: code === 400 ? 'name already exists' : msg })
  }
}

export async function update(req: AuthRequest, res: Response) {
  try {
    const { name, description, overrides } = req.body as {
      name?: string
      description?: string
      overrides?: Array<{ parameterId: string; value: string }>
    }
    const data = await svc.updateScenario({
      scenarioId: req.params.scenarioId,
      projectId: req.params.projectId,
      name: name?.trim(),
      description: description?.trim(),
      overrides,
    })
    res.json({ success: true, data })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}

export async function remove(req: AuthRequest, res: Response) {
  try {
    await svc.deleteScenario(req.params.scenarioId, req.params.projectId)
    res.json({ success: true, data: { id: req.params.scenarioId } })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}

export async function setOverride(req: AuthRequest, res: Response) {
  try {
    const { value } = req.body as { value?: string }
    if (typeof value !== 'string') {
      res.status(400).json({ success: false, error: 'value required (string)' })
      return
    }
    const data = await svc.setOverride({
      scenarioId: req.params.scenarioId,
      parameterId: req.params.parameterId,
      value,
    })
    res.json({ success: true, data })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}

export async function removeOverride(req: AuthRequest, res: Response) {
  try {
    await svc.removeOverride(req.params.scenarioId, req.params.parameterId)
    res.json({ success: true, data: { scenarioId: req.params.scenarioId } })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}
