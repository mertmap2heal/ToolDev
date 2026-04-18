import { Request, Response } from 'express'
import * as svc from '../services/comm.service'

// #289: all handlers now thread projectId through to the service layer so
// that every resource lookup is scoped to the caller's project. A mismatched
// projectId/resourceId pair returns 404, never mutates a row in a different
// project.

// ── Buses ────────────────────────────────────────────────────────────────────

export async function getBuses(req: Request, res: Response) {
  try {
    res.json({ success: true, data: await svc.listBuses(req.params.projectId) })
  } catch (e) { res.status(500).json({ success: false, error: (e as Error).message }) }
}

export async function createBus(req: Request, res: Response) {
  try {
    const { name, description, protocol, config } = req.body
    if (!name || !protocol) return res.status(400).json({ success: false, error: 'name and protocol are required' })
    res.status(201).json({ success: true, data: await svc.createBus(req.params.projectId, { name, description, protocol, config }) })
  } catch (e) { res.status(500).json({ success: false, error: (e as Error).message }) }
}

export async function updateBus(req: Request, res: Response) {
  try {
    res.json({ success: true, data: await svc.updateBus(req.params.id, req.params.projectId, req.body) })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'Not found') return res.status(404).json({ success: false, error: 'Bus not found' })
    res.status(500).json({ success: false, error: msg })
  }
}

export async function deleteBus(req: Request, res: Response) {
  try {
    await svc.deleteBus(req.params.id, req.params.projectId)
    res.json({ success: true })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'Not found') return res.status(404).json({ success: false, error: 'Bus not found' })
    res.status(500).json({ success: false, error: msg })
  }
}

// ── Messages ─────────────────────────────────────────────────────────────────

export async function getMessages(req: Request, res: Response) {
  try {
    res.json({
      success: true,
      data: await svc.listMessages(req.params.projectId, req.params.busId),
    })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'Not found') return res.status(404).json({ success: false, error: 'Bus not found' })
    res.status(500).json({ success: false, error: msg })
  }
}

export async function createMessage(req: Request, res: Response) {
  try {
    const { name, messageId, direction, description, metadata } = req.body
    if (!name) return res.status(400).json({ success: false, error: 'name is required' })
    res.status(201).json({
      success: true,
      data: await svc.createMessage(req.params.projectId, req.params.busId, {
        name, messageId, direction, description, metadata,
      }),
    })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'Not found') return res.status(404).json({ success: false, error: 'Bus not found' })
    res.status(500).json({ success: false, error: msg })
  }
}

export async function updateMessage(req: Request, res: Response) {
  try {
    res.json({
      success: true,
      data: await svc.updateMessage(req.params.projectId, req.params.id, req.body),
    })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'Not found') return res.status(404).json({ success: false, error: 'Message not found' })
    res.status(500).json({ success: false, error: msg })
  }
}

export async function deleteMessage(req: Request, res: Response) {
  try {
    await svc.deleteMessage(req.params.projectId, req.params.id)
    res.json({ success: true })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'Not found') return res.status(404).json({ success: false, error: 'Message not found' })
    res.status(500).json({ success: false, error: msg })
  }
}

// ── Fields ────────────────────────────────────────────────────────────────────

export async function getFields(req: Request, res: Response) {
  try {
    res.json({
      success: true,
      data: await svc.listFields(req.params.projectId, req.params.messageId),
    })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'Not found') return res.status(404).json({ success: false, error: 'Message not found' })
    res.status(500).json({ success: false, error: msg })
  }
}

export async function createField(req: Request, res: Response) {
  try {
    const { fieldName, parameterId, description, dataType, order, config } = req.body
    if (!fieldName) return res.status(400).json({ success: false, error: 'fieldName is required' })
    res.status(201).json({
      success: true,
      data: await svc.createField(req.params.projectId, req.params.messageId, {
        fieldName, parameterId, description, dataType, order, config,
      }),
    })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'Not found') return res.status(404).json({ success: false, error: 'Message not found' })
    res.status(500).json({ success: false, error: msg })
  }
}

export async function updateField(req: Request, res: Response) {
  try {
    res.json({
      success: true,
      data: await svc.updateField(req.params.projectId, req.params.id, req.body),
    })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'Not found') return res.status(404).json({ success: false, error: 'Field not found' })
    res.status(500).json({ success: false, error: msg })
  }
}

export async function deleteField(req: Request, res: Response) {
  try {
    await svc.deleteField(req.params.projectId, req.params.id)
    res.json({ success: true })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'Not found') return res.status(404).json({ success: false, error: 'Field not found' })
    res.status(500).json({ success: false, error: msg })
  }
}

export async function reorderFields(req: Request, res: Response) {
  try {
    const { orderedIds } = req.body
    if (!Array.isArray(orderedIds)) return res.status(400).json({ success: false, error: 'orderedIds must be an array' })
    await svc.reorderFields(req.params.projectId, req.params.messageId, orderedIds)
    res.json({ success: true })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'Not found') return res.status(404).json({ success: false, error: 'Message not found' })
    res.status(500).json({ success: false, error: msg })
  }
}
