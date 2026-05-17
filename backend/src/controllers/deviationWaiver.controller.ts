// NX-3 (#443) — Configuration Management: Deviation / Waiver HTTP controllers.
import type { Response } from 'express'
import type { AuthRequest } from '../middleware/auth.middleware'
import * as svc from '../services/deviationWaiver.service'

function userId(req: AuthRequest): string {
  const uid = req.userId ?? req.user?.userId
  if (!uid) throw new Error('Unauthenticated')
  return uid
}

function fail(res: Response, status: number, error: string) {
  return res.status(status).json({ success: false, error })
}

function err(res: Response, e: unknown) {
  const status = (e as Error & { statusCode?: number }).statusCode
  if (typeof status === 'number' && status >= 400 && status < 600) {
    return res.status(status).json({ success: false, error: (e as Error).message })
  }
  return res.status(500).json({ success: false, error: (e as Error).message })
}

export async function list(req: AuthRequest, res: Response) {
  try {
    const data = await svc.listDeviations(req.params.projectId, {
      type: req.query.type as string | undefined,
      status: req.query.status as string | undefined,
      riskLevel: req.query.riskLevel as string | undefined,
      search: req.query.search as string | undefined,
    })
    res.json({ success: true, data })
  } catch (e) {
    err(res, e)
  }
}

export async function get(req: AuthRequest, res: Response) {
  try {
    const item = await svc.getDeviation(req.params.projectId, req.params.id)
    if (!item) return fail(res, 404, 'Deviation/Waiver not found')
    res.json({ success: true, data: item })
  } catch (e) {
    err(res, e)
  }
}

export async function create(req: AuthRequest, res: Response) {
  try {
    const item = await svc.createDeviation(req.params.projectId, userId(req), req.body ?? {})
    res.status(201).json({ success: true, data: item })
  } catch (e) {
    err(res, e)
  }
}

export async function update(req: AuthRequest, res: Response) {
  try {
    const item = await svc.updateDeviation(
      req.params.projectId,
      req.params.id,
      userId(req),
      req.body ?? {},
    )
    if (!item) return fail(res, 404, 'Deviation/Waiver not found')
    res.json({ success: true, data: item })
  } catch (e) {
    err(res, e)
  }
}

export async function sign(req: AuthRequest, res: Response) {
  try {
    // NX-3 (CFR 21 Part 11): the route is gated by `requireReauth`. The
    // reauthentication timestamp recorded on the SignatureEvent is the
    // server's clock at sign time — never a client value.
    const item = await svc.signDeviation(
      req.params.projectId,
      req.params.id,
      userId(req),
      new Date(),
    )
    if (!item) return fail(res, 404, 'Deviation/Waiver not found')
    res.json({ success: true, data: item })
  } catch (e) {
    err(res, e)
  }
}

export async function close(req: AuthRequest, res: Response) {
  try {
    const item = await svc.closeDeviation(req.params.projectId, req.params.id, userId(req))
    if (!item) return fail(res, 404, 'Deviation/Waiver not found')
    res.json({ success: true, data: item })
  } catch (e) {
    err(res, e)
  }
}

export async function reject(req: AuthRequest, res: Response) {
  try {
    const item = await svc.rejectDeviation(
      req.params.projectId,
      req.params.id,
      userId(req),
      req.body?.reason as string | undefined,
    )
    if (!item) return fail(res, 404, 'Deviation/Waiver not found')
    res.json({ success: true, data: item })
  } catch (e) {
    err(res, e)
  }
}
