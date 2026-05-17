// NX-3 (#443) — Configuration Management: CM baseline HTTP controllers (CM-N6).
//
// Controllers are thin: parse the request, call the service, shape the
// response, catch errors. Prisma is never touched here (per
// .claude/kb/backend-patterns.md).
import type { Response } from 'express'
import type { AuthRequest } from '../middleware/auth.middleware'
import * as svc from '../services/cmBaseline.service'

function userId(req: AuthRequest): string {
  const uid = req.userId ?? req.user?.userId
  if (!uid) throw new Error('Unauthenticated')
  return uid
}

function fail(res: Response, status: number, error: string) {
  return res.status(status).json({ success: false, error })
}

/** Map a thrown error to its HTTP status — CmError carries `statusCode`. */
function err(res: Response, e: unknown) {
  const status = (e as Error & { statusCode?: number }).statusCode
  if (typeof status === 'number' && status >= 400 && status < 600) {
    return res.status(status).json({ success: false, error: (e as Error).message })
  }
  return res.status(500).json({ success: false, error: (e as Error).message })
}

/** GET /:projectId/baselines — list the project's CM baselines. */
export async function list(req: AuthRequest, res: Response) {
  try {
    const data = await svc.listCmBaselines(req.params.projectId)
    res.json({ success: true, data })
  } catch (e) {
    err(res, e)
  }
}

/** GET /:projectId/baselines/:baselineId — one CM baseline with its items. */
export async function get(req: AuthRequest, res: Response) {
  try {
    const data = await svc.getCmBaseline(req.params.projectId, req.params.baselineId)
    if (!data) return fail(res, 404, 'CM baseline not found')
    res.json({ success: true, data })
  } catch (e) {
    err(res, e)
  }
}

/**
 * POST /:projectId/baselines — create a CM baseline snapshotting the project's
 * ConfigItems. Body: `{ name, description?, configItemIds? }`.
 */
export async function create(req: AuthRequest, res: Response) {
  try {
    const body = req.body ?? {}
    const data = await svc.createCmBaseline(req.params.projectId, userId(req), {
      name: body.name,
      description: body.description,
      configItemIds: Array.isArray(body.configItemIds) ? body.configItemIds : undefined,
    })
    res.status(201).json({ success: true, data })
  } catch (e) {
    err(res, e)
  }
}

/**
 * POST /:projectId/baselines/:baselineId/items — add one ConfigItem snapshot to
 * a draft CM baseline. Body: `{ configItemId }`.
 */
export async function addItem(req: AuthRequest, res: Response) {
  try {
    const configItemId = (req.body?.configItemId as string) ?? ''
    if (!configItemId.trim()) return fail(res, 400, 'configItemId is required')
    const data = await svc.addConfigItemToCmBaseline(
      req.params.projectId,
      userId(req),
      req.params.baselineId,
      configItemId,
    )
    res.status(201).json({ success: true, data })
  } catch (e) {
    err(res, e)
  }
}

/** POST /:projectId/baselines/:baselineId/freeze — freeze a CM baseline. */
export async function freeze(req: AuthRequest, res: Response) {
  try {
    const data = await svc.freezeCmBaseline(
      req.params.projectId,
      userId(req),
      req.params.baselineId,
    )
    res.json({ success: true, data })
  } catch (e) {
    err(res, e)
  }
}

/**
 * GET /:projectId/baselines/compare?aId=...&bId=... — diff two CM baselines.
 */
export async function compare(req: AuthRequest, res: Response) {
  try {
    const aId = (req.query.aId as string) ?? ''
    const bId = (req.query.bId as string) ?? ''
    if (!aId.trim() || !bId.trim()) {
      return fail(res, 400, 'aId and bId query parameters are required')
    }
    const data = await svc.compareCmBaselines(req.params.projectId, aId, bId)
    res.json({ success: true, data })
  } catch (e) {
    err(res, e)
  }
}
