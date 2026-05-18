// NX-9 (#466) — Safety Analysis: Hazard + FMEA HTTP controllers.
//
// Controllers are thin: parse the request, call the service, shape the
// response, catch errors. Prisma is never touched here; Zod validation lives
// in the service (per .claude/kb/backend-patterns.md).
import type { Response } from 'express'
import type { AuthRequest } from '../middleware/auth.middleware'
import * as svc from '../services/safety.service'

function userId(req: AuthRequest): string {
  const uid = req.userId ?? req.user?.userId
  if (!uid) throw new Error('Unauthenticated')
  return uid
}

function fail(res: Response, status: number, error: string) {
  return res.status(status).json({ success: false, error })
}

/** Map a thrown error to its HTTP status — SafetyError carries `statusCode`. */
function err(res: Response, e: unknown) {
  const status = (e as Error & { statusCode?: number }).statusCode
  if (typeof status === 'number' && status >= 400 && status < 600) {
    return res.status(status).json({ success: false, error: (e as Error).message })
  }
  return res.status(500).json({ success: false, error: (e as Error).message })
}

// --- Hazard -----------------------------------------------------------------

export async function listHazards(req: AuthRequest, res: Response) {
  try {
    const data = await svc.listHazards(req.params.projectId, {
      severity: req.query.severity as string | undefined,
      status: req.query.status as string | undefined,
      search: req.query.search as string | undefined,
      includeDeleted: req.query.includeDeleted === 'true',
    })
    res.json({ success: true, data })
  } catch (e) {
    err(res, e)
  }
}

export async function getHazard(req: AuthRequest, res: Response) {
  try {
    const item = await svc.getHazard(req.params.projectId, req.params.id)
    if (!item) return fail(res, 404, 'Hazard not found')
    res.json({ success: true, data: item })
  } catch (e) {
    err(res, e)
  }
}

export async function createHazard(req: AuthRequest, res: Response) {
  try {
    const item = await svc.createHazard(req.params.projectId, userId(req), req.body ?? {})
    res.status(201).json({ success: true, data: item })
  } catch (e) {
    err(res, e)
  }
}

export async function updateHazard(req: AuthRequest, res: Response) {
  try {
    const item = await svc.updateHazard(
      req.params.projectId,
      req.params.id,
      userId(req),
      req.body ?? {},
    )
    if (!item) return fail(res, 404, 'Hazard not found')
    res.json({ success: true, data: item })
  } catch (e) {
    err(res, e)
  }
}

export async function deleteHazard(req: AuthRequest, res: Response) {
  try {
    const item = await svc.deleteHazard(req.params.projectId, req.params.id, userId(req))
    if (!item) return fail(res, 404, 'Hazard not found')
    res.json({ success: true, data: item })
  } catch (e) {
    err(res, e)
  }
}

// --- FailureCondition -------------------------------------------------------

export async function listFailureConditions(req: AuthRequest, res: Response) {
  try {
    const data = await svc.listFailureConditions(
      req.params.projectId,
      req.params.hazardId,
      req.query.includeDeleted === 'true',
    )
    res.json({ success: true, data })
  } catch (e) {
    err(res, e)
  }
}

export async function getFailureCondition(req: AuthRequest, res: Response) {
  try {
    const item = await svc.getFailureCondition(
      req.params.projectId,
      req.params.hazardId,
      req.params.id,
    )
    if (!item) return fail(res, 404, 'Failure condition not found')
    res.json({ success: true, data: item })
  } catch (e) {
    err(res, e)
  }
}

export async function createFailureCondition(req: AuthRequest, res: Response) {
  try {
    const item = await svc.createFailureCondition(
      req.params.projectId,
      req.params.hazardId,
      userId(req),
      req.body ?? {},
    )
    res.status(201).json({ success: true, data: item })
  } catch (e) {
    err(res, e)
  }
}

export async function updateFailureCondition(req: AuthRequest, res: Response) {
  try {
    const item = await svc.updateFailureCondition(
      req.params.projectId,
      req.params.hazardId,
      req.params.id,
      userId(req),
      req.body ?? {},
    )
    if (!item) return fail(res, 404, 'Failure condition not found')
    res.json({ success: true, data: item })
  } catch (e) {
    err(res, e)
  }
}

export async function deleteFailureCondition(req: AuthRequest, res: Response) {
  try {
    const item = await svc.deleteFailureCondition(
      req.params.projectId,
      req.params.hazardId,
      req.params.id,
      userId(req),
    )
    if (!item) return fail(res, 404, 'Failure condition not found')
    res.json({ success: true, data: item })
  } catch (e) {
    err(res, e)
  }
}

// --- FMEA -------------------------------------------------------------------

export async function listFmeas(req: AuthRequest, res: Response) {
  try {
    const data = await svc.listFmeas(req.params.projectId, {
      status: req.query.status as string | undefined,
      search: req.query.search as string | undefined,
      includeDeleted: req.query.includeDeleted === 'true',
    })
    res.json({ success: true, data })
  } catch (e) {
    err(res, e)
  }
}

export async function getFmea(req: AuthRequest, res: Response) {
  try {
    const item = await svc.getFmea(req.params.projectId, req.params.id)
    if (!item) return fail(res, 404, 'FMEA worksheet not found')
    res.json({ success: true, data: item })
  } catch (e) {
    err(res, e)
  }
}

export async function createFmea(req: AuthRequest, res: Response) {
  try {
    const item = await svc.createFmea(req.params.projectId, userId(req), req.body ?? {})
    res.status(201).json({ success: true, data: item })
  } catch (e) {
    err(res, e)
  }
}

export async function updateFmea(req: AuthRequest, res: Response) {
  try {
    const item = await svc.updateFmea(
      req.params.projectId,
      req.params.id,
      userId(req),
      req.body ?? {},
    )
    if (!item) return fail(res, 404, 'FMEA worksheet not found')
    res.json({ success: true, data: item })
  } catch (e) {
    err(res, e)
  }
}

export async function deleteFmea(req: AuthRequest, res: Response) {
  try {
    const item = await svc.deleteFmea(req.params.projectId, req.params.id, userId(req))
    if (!item) return fail(res, 404, 'FMEA worksheet not found')
    res.json({ success: true, data: item })
  } catch (e) {
    err(res, e)
  }
}

// --- FmeaRow ----------------------------------------------------------------

export async function listFmeaRows(req: AuthRequest, res: Response) {
  try {
    const data = await svc.listFmeaRows(
      req.params.projectId,
      req.params.fmeaId,
      req.query.includeDeleted === 'true',
    )
    res.json({ success: true, data })
  } catch (e) {
    err(res, e)
  }
}

export async function getFmeaRow(req: AuthRequest, res: Response) {
  try {
    const item = await svc.getFmeaRow(req.params.projectId, req.params.fmeaId, req.params.id)
    if (!item) return fail(res, 404, 'FMEA row not found')
    res.json({ success: true, data: item })
  } catch (e) {
    err(res, e)
  }
}

export async function createFmeaRow(req: AuthRequest, res: Response) {
  try {
    const item = await svc.createFmeaRow(
      req.params.projectId,
      req.params.fmeaId,
      userId(req),
      req.body ?? {},
    )
    res.status(201).json({ success: true, data: item })
  } catch (e) {
    err(res, e)
  }
}

export async function updateFmeaRow(req: AuthRequest, res: Response) {
  try {
    const item = await svc.updateFmeaRow(
      req.params.projectId,
      req.params.fmeaId,
      req.params.id,
      userId(req),
      req.body ?? {},
    )
    if (!item) return fail(res, 404, 'FMEA row not found')
    res.json({ success: true, data: item })
  } catch (e) {
    err(res, e)
  }
}

export async function deleteFmeaRow(req: AuthRequest, res: Response) {
  try {
    const item = await svc.deleteFmeaRow(
      req.params.projectId,
      req.params.fmeaId,
      req.params.id,
      userId(req),
    )
    if (!item) return fail(res, 404, 'FMEA row not found')
    res.json({ success: true, data: item })
  } catch (e) {
    err(res, e)
  }
}
