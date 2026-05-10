import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import * as svc from '../services/parameterBaseline.service'

export async function create(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId
    if (!userId) {
      res.status(401).json({ success: false, error: 'unauthenticated' })
      return
    }
    const { name, description } = req.body as { name?: string; description?: string }
    if (!name?.trim()) {
      res.status(400).json({ success: false, error: 'name required' })
      return
    }
    const baseline = await svc.createBaseline({
      projectId: req.params.projectId,
      createdBy: userId,
      name: name.trim(),
      description: description?.trim() || undefined,
    })
    res.status(201).json({ success: true, data: baseline })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}

export async function list(req: AuthRequest, res: Response) {
  try {
    const data = await svc.listBaselines(req.params.projectId)
    res.json({ success: true, data })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}

export async function get(req: AuthRequest, res: Response) {
  try {
    const baseline = await svc.getBaseline(req.params.baselineId, req.params.projectId)
    if (!baseline) {
      res.status(404).json({ success: false, error: 'baseline not found' })
      return
    }
    res.json({ success: true, data: baseline })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}

export async function compare(req: AuthRequest, res: Response) {
  try {
    const { fromId, toId } = req.query as { fromId?: string; toId?: string }
    if (!fromId) {
      res.status(400).json({ success: false, error: 'fromId required' })
      return
    }
    let diffs
    if (toId) {
      diffs = await svc.compareBaselines({
        projectId: req.params.projectId,
        fromId,
        toId,
      })
    } else {
      // No `toId` -> compare baseline to live state.
      diffs = await svc.compareBaselineToLive(fromId, req.params.projectId)
    }
    res.json({ success: true, data: diffs })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}

export async function restore(req: AuthRequest, res: Response) {
  try {
    const { prune } = req.body as { prune?: boolean }
    const result = await svc.restoreFromBaseline({
      baselineId: req.params.baselineId,
      projectId: req.params.projectId,
      prune: !!prune,
    })
    res.json({ success: true, data: result })
  } catch (e) {
    res.status(400).json({ success: false, error: (e as Error).message })
  }
}

export async function remove(req: AuthRequest, res: Response) {
  try {
    await svc.deleteBaseline(req.params.baselineId, req.params.projectId)
    res.json({ success: true, data: { id: req.params.baselineId } })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}
