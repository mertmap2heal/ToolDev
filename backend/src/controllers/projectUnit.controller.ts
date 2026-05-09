import { Request, Response } from 'express'
import * as svc from '../services/projectUnit.service'

export async function getProjectUnits(req: Request, res: Response) {
  try {
    const data = await svc.listProjectUnits(req.params.projectId)
    res.json({ success: true, data })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}

export async function createProjectUnitHandler(req: Request, res: Response) {
  try {
    const { name, symbol, description, category } = req.body
    if (!name || !symbol) {
      return res.status(400).json({ success: false, error: 'name and symbol are required' })
    }
    const data = await svc.createProjectUnit(req.params.projectId, { name, symbol, description, category })
    res.status(201).json({ success: true, data })
  } catch (e) {
    const msg = (e as Error).message
    if (msg.includes('Unique constraint')) {
      return res.status(409).json({ success: false, error: 'A unit with that symbol already exists in this project' })
    }
    res.status(500).json({ success: false, error: msg })
  }
}

export async function updateProjectUnitHandler(req: Request, res: Response) {
  try {
    const data = await svc.updateProjectUnit(req.params.id, req.params.projectId, req.body)
    res.json({ success: true, data })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}

export async function deleteProjectUnitHandler(req: Request, res: Response) {
  try {
    // BUG FIX: countUnitUsage takes the unit's symbol, not its row id.
    // Look up the unit first so the in-use guard actually fires.
    const unit = await svc.getProjectUnit(req.params.projectId, req.params.id)
    if (!unit) {
      return res.status(404).json({ success: false, error: 'Unit not found' })
    }
    const usage = await svc.countUnitUsage(req.params.projectId, unit.symbol)
    if (usage > 0) {
      // Return count so UI can warn but still allow forced delete
      return res.status(409).json({ success: false, error: 'Unit is in use', usageCount: usage })
    }
    await svc.deleteProjectUnit(req.params.id, req.params.projectId)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}

export async function getProjectUnitUsage(req: Request, res: Response) {
  try {
    const count = await svc.countUnitUsage(req.params.projectId, decodeURIComponent(req.params.symbol))
    res.json({ success: true, data: { count } })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}
