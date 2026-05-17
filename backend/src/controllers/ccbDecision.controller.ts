// NX-3 (#443) — Configuration Management: CCB decision HTTP controllers.
import type { Response } from 'express'
import type { AuthRequest } from '../middleware/auth.middleware'
import * as svc from '../services/ccbDecision.service'

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
    const data = await svc.listCcbDecisions(req.params.projectId)
    res.json({ success: true, data })
  } catch (e) {
    err(res, e)
  }
}

export async function listByChangeRequest(req: AuthRequest, res: Response) {
  try {
    const data = await svc.listCcbDecisionsForChangeRequest(
      req.params.projectId,
      req.params.changeRequestId,
    )
    res.json({ success: true, data })
  } catch (e) {
    err(res, e)
  }
}

export async function create(req: AuthRequest, res: Response) {
  try {
    const item = await svc.createCcbDecision(req.params.projectId, userId(req), req.body ?? {})
    res.status(201).json({ success: true, data: item })
  } catch (e) {
    err(res, e)
  }
}

export async function sign(req: AuthRequest, res: Response) {
  try {
    // NX-3 (CFR 21 Part 11): the route is gated by `requireReauth`. The
    // reauthentication timestamp is the server's clock at sign time. The
    // body may carry either a `decisionId` (sign an existing decision) or a
    // full decision payload (create-and-sign in one ceremony).
    const body = req.body ?? {}
    const args = body.decisionId
      ? { decisionId: String(body.decisionId) }
      : { input: body }
    const item = await svc.signCcbDecision(
      req.params.projectId,
      userId(req),
      new Date(),
      args,
    )
    if (!item) return fail(res, 404, 'CCB decision not found')
    res.status(body.decisionId ? 200 : 201).json({ success: true, data: item })
  } catch (e) {
    err(res, e)
  }
}

export async function reject(req: AuthRequest, res: Response) {
  try {
    const item = await svc.rejectCcbDecision(req.params.projectId, userId(req), req.body ?? {})
    res.status(201).json({ success: true, data: item })
  } catch (e) {
    err(res, e)
  }
}
