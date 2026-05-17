// NX-3 (#443) — Configuration Management: ConfigItem HTTP controllers.
//
// Controllers are thin: parse the request, call the service, shape the
// response, catch errors. Prisma is never touched here (per
// .claude/kb/backend-patterns.md).
import type { Response } from 'express'
import type { AuthRequest } from '../middleware/auth.middleware'
import * as svc from '../services/configItem.service'

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

export async function list(req: AuthRequest, res: Response) {
  try {
    const data = await svc.listConfigItems(req.params.projectId, {
      type: req.query.type as string | undefined,
      status: req.query.status as string | undefined,
      ownerUserId: req.query.ownerUserId as string | undefined,
      safetyOnly: req.query.safetyOnly === 'true',
      search: req.query.search as string | undefined,
      includeDeleted: req.query.includeDeleted === 'true',
    })
    res.json({ success: true, data })
  } catch (e) {
    err(res, e)
  }
}

export async function search(req: AuthRequest, res: Response) {
  try {
    const data = await svc.searchConfigItems(
      req.params.projectId,
      (req.query.q as string) ?? '',
    )
    res.json({ success: true, data })
  } catch (e) {
    err(res, e)
  }
}

export async function get(req: AuthRequest, res: Response) {
  try {
    const item = await svc.getConfigItem(req.params.projectId, req.params.id)
    if (!item) return fail(res, 404, 'Configuration item not found')
    res.json({ success: true, data: item })
  } catch (e) {
    err(res, e)
  }
}

export async function create(req: AuthRequest, res: Response) {
  try {
    const item = await svc.createConfigItem(req.params.projectId, userId(req), req.body ?? {})
    res.status(201).json({ success: true, data: item })
  } catch (e) {
    err(res, e)
  }
}

export async function update(req: AuthRequest, res: Response) {
  try {
    const item = await svc.updateConfigItem(
      req.params.projectId,
      req.params.id,
      userId(req),
      req.body ?? {},
    )
    if (!item) return fail(res, 404, 'Configuration item not found')
    res.json({ success: true, data: item })
  } catch (e) {
    err(res, e)
  }
}

export async function remove(req: AuthRequest, res: Response) {
  try {
    const item = await svc.softDeleteConfigItem(
      req.params.projectId,
      req.params.id,
      userId(req),
    )
    if (!item) return fail(res, 404, 'Configuration item not found')
    res.json({ success: true, data: item })
  } catch (e) {
    err(res, e)
  }
}

export async function lock(req: AuthRequest, res: Response) {
  try {
    const lockState = (req.body?.lockState as string) ?? 'FrozenByBaseline'
    const item = await svc.setConfigItemLock(
      req.params.projectId,
      req.params.id,
      userId(req),
      lockState,
    )
    if (!item) return fail(res, 404, 'Configuration item not found')
    res.json({ success: true, data: item })
  } catch (e) {
    err(res, e)
  }
}

export async function unlock(req: AuthRequest, res: Response) {
  try {
    const item = await svc.setConfigItemLock(
      req.params.projectId,
      req.params.id,
      userId(req),
      'Unlocked',
    )
    if (!item) return fail(res, 404, 'Configuration item not found')
    res.json({ success: true, data: item })
  } catch (e) {
    err(res, e)
  }
}

export async function linkSource(req: AuthRequest, res: Response) {
  try {
    const item = await svc.linkConfigItemSource(
      req.params.projectId,
      req.params.id,
      userId(req),
      (req.body?.refType as string) ?? '',
      (req.body?.refId as string) ?? '',
    )
    if (!item) return fail(res, 404, 'Configuration item not found')
    res.json({ success: true, data: item })
  } catch (e) {
    err(res, e)
  }
}
