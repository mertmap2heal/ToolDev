import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import * as svc from '../services/validation.service'

function userId(req: AuthRequest): string {
  const uid = req.userId ?? req.user?.userId
  if (!uid) throw new Error('Unauthenticated')
  return uid
}

function fail(res: Response, status: number, error: string) {
  return res.status(status).json({ success: false, error })
}

function err(res: Response, e: unknown) {
  return res.status(500).json({ success: false, error: (e as Error).message })
}

export async function listItems(req: AuthRequest, res: Response) {
  try {
    const data = await svc.listItems(req.params.projectId, {
      status: req.query.status as string | undefined,
      methodType: req.query.methodType as string | undefined,
      milestone: req.query.milestone as string | undefined,
      ownerId: req.query.ownerId as string | undefined,
      search: req.query.search as string | undefined,
      includeDeleted: req.query.includeDeleted === 'true',
    })
    res.json({ success: true, data })
  } catch (e) {
    err(res, e)
  }
}

export async function exportItemsCsv(req: AuthRequest, res: Response) {
  try {
    const csv = await svc.exportItemsCsv(req.params.projectId, {
      status: req.query.status as string | undefined,
      methodType: req.query.methodType as string | undefined,
      milestone: req.query.milestone as string | undefined,
      ownerId: req.query.ownerId as string | undefined,
      search: req.query.search as string | undefined,
    })
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="validation-items.csv"')
    res.send(csv)
  } catch (e) {
    err(res, e)
  }
}

export async function getItem(req: AuthRequest, res: Response) {
  try {
    const item = await svc.getItem(req.params.projectId, req.params.id)
    if (!item) return fail(res, 404, 'Validation item not found')
    res.json({ success: true, data: item })
  } catch (e) {
    err(res, e)
  }
}

export async function createItem(req: AuthRequest, res: Response) {
  try {
    const item = await svc.createItem(req.params.projectId, userId(req), req.body)
    res.status(201).json({ success: true, data: item })
  } catch (e) {
    return fail(res, 400, (e as Error).message)
  }
}

export async function updateItem(req: AuthRequest, res: Response) {
  try {
    const item = await svc.updateItem(
      req.params.projectId,
      req.params.id,
      userId(req),
      req.body,
    )
    if (!item) return fail(res, 404, 'Validation item not found')
    res.json({ success: true, data: item })
  } catch (e) {
    return fail(res, 400, (e as Error).message)
  }
}

export async function deleteItem(req: AuthRequest, res: Response) {
  try {
    const item = await svc.softDeleteItem(
      req.params.projectId,
      req.params.id,
      userId(req),
      req.body?.reason,
    )
    if (!item) return fail(res, 404, 'Validation item not found')
    res.json({ success: true, data: item })
  } catch (e) {
    err(res, e)
  }
}

export async function restoreItem(req: AuthRequest, res: Response) {
  try {
    const item = await svc.restoreItem(req.params.projectId, req.params.id, userId(req))
    if (!item) return fail(res, 404, 'Validation item not found')
    res.json({ success: true, data: item })
  } catch (e) {
    err(res, e)
  }
}

export async function createFromRequirements(req: AuthRequest, res: Response) {
  try {
    const data = await svc.createFromRequirements(
      req.params.projectId,
      userId(req),
      req.body ?? {},
    )
    res.status(201).json({ success: true, data })
  } catch (e) {
    return fail(res, 400, (e as Error).message)
  }
}

export async function signOffItem(req: AuthRequest, res: Response) {
  try {
    const data = await svc.signOff(
      req.params.projectId,
      req.params.id,
      userId(req),
      req.body ?? {},
    )
    if (!data) return fail(res, 404, 'Validation item not found')
    res.status(201).json({ success: true, data })
  } catch (e) {
    const msg = (e as Error).message
    if (
      msg.includes('signer cannot be the creator') ||
      msg.includes('item must be EXECUTED')
    ) {
      return fail(res, 403, msg)
    }
    return fail(res, 400, msg)
  }
}

export async function revokeSignOff(req: AuthRequest, res: Response) {
  try {
    const data = await svc.revokeSignOff(
      req.params.projectId,
      req.params.id,
      req.params.signOffId,
      userId(req),
    )
    if (!data) return fail(res, 404, 'Sign-off not found')
    res.json({ success: true, data })
  } catch (e) {
    return fail(res, 400, (e as Error).message)
  }
}

export async function listSignOffs(req: AuthRequest, res: Response) {
  try {
    const data = await svc.listSignOffs(req.params.projectId, req.params.id)
    if (data == null) return fail(res, 404, 'Validation item not found')
    res.json({ success: true, data })
  } catch (e) {
    err(res, e)
  }
}

export async function listEvidence(req: AuthRequest, res: Response) {
  try {
    const data = await svc.listEvidence(req.params.projectId, req.params.id)
    if (data == null) return fail(res, 404, 'Validation item not found')
    res.json({ success: true, data })
  } catch (e) {
    err(res, e)
  }
}

export async function attachEvidence(req: AuthRequest, res: Response) {
  try {
    const data = await svc.attachEvidence(
      req.params.projectId,
      req.params.id,
      userId(req),
      req.body ?? {},
    )
    if (!data) return fail(res, 404, 'Validation item not found')
    res.status(201).json({ success: true, data })
  } catch (e) {
    return fail(res, 400, (e as Error).message)
  }
}

export async function detachEvidence(req: AuthRequest, res: Response) {
  try {
    const data = await svc.detachEvidence(
      req.params.projectId,
      req.params.id,
      req.params.linkId,
      userId(req),
    )
    if (!data) return fail(res, 404, 'Evidence link not found')
    res.json({ success: true, data })
  } catch (e) {
    err(res, e)
  }
}
