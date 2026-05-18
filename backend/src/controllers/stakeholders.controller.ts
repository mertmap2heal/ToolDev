// NX-8 (#463) — Stakeholders backend build-out: HTTP controllers.
//
// Controllers are thin: parse the request, call the service, shape the
// response, catch errors. Prisma is never touched here (per
// .claude/kb/backend-patterns.md). A StakeholderError carries `statusCode`.
import type { Response } from 'express'
import type { AuthRequest } from '../middleware/auth.middleware'
import * as svc from '../services/stakeholders.service'

function userId(req: AuthRequest): string {
  const uid = req.userId ?? req.user?.userId
  if (!uid) throw new Error('Unauthenticated')
  return uid
}

function fail(res: Response, status: number, error: string) {
  return res.status(status).json({ success: false, error })
}

/** Map a thrown error to its HTTP status — StakeholderError carries `statusCode`. */
function err(res: Response, e: unknown) {
  const status = (e as Error & { statusCode?: number }).statusCode
  if (typeof status === 'number' && status >= 400 && status < 600) {
    return res.status(status).json({ success: false, error: (e as Error).message })
  }
  return res.status(500).json({ success: false, error: (e as Error).message })
}

// --- Committee --------------------------------------------------------------

export async function listCommittees(req: AuthRequest, res: Response) {
  try {
    const data = await svc.listCommittees(req.params.projectId)
    res.json({ success: true, data })
  } catch (e) {
    err(res, e)
  }
}

export async function getCommittee(req: AuthRequest, res: Response) {
  try {
    const row = await svc.getCommittee(req.params.projectId, req.params.committeeId)
    if (!row) return fail(res, 404, 'Committee not found')
    res.json({ success: true, data: row })
  } catch (e) {
    err(res, e)
  }
}

export async function createCommittee(req: AuthRequest, res: Response) {
  try {
    const row = await svc.createCommittee(req.params.projectId, userId(req), req.body ?? {})
    res.status(201).json({ success: true, data: row })
  } catch (e) {
    err(res, e)
  }
}

export async function updateCommittee(req: AuthRequest, res: Response) {
  try {
    const row = await svc.updateCommittee(
      req.params.projectId,
      req.params.committeeId,
      userId(req),
      req.body ?? {},
    )
    if (!row) return fail(res, 404, 'Committee not found')
    res.json({ success: true, data: row })
  } catch (e) {
    err(res, e)
  }
}

export async function deleteCommittee(req: AuthRequest, res: Response) {
  try {
    const row = await svc.deleteCommittee(req.params.projectId, req.params.committeeId, userId(req))
    if (!row) return fail(res, 404, 'Committee not found')
    res.json({ success: true, data: row, message: 'Committee deleted' })
  } catch (e) {
    err(res, e)
  }
}

// --- CommitteeMember --------------------------------------------------------

export async function addCommitteeMember(req: AuthRequest, res: Response) {
  try {
    const row = await svc.addCommitteeMember(
      req.params.projectId,
      req.params.committeeId,
      userId(req),
      req.body ?? {},
    )
    res.status(201).json({ success: true, data: row })
  } catch (e) {
    err(res, e)
  }
}

export async function updateCommitteeMember(req: AuthRequest, res: Response) {
  try {
    const row = await svc.updateCommitteeMember(
      req.params.projectId,
      req.params.committeeId,
      req.params.memberId,
      userId(req),
      req.body ?? {},
    )
    if (!row) return fail(res, 404, 'Committee member not found')
    res.json({ success: true, data: row })
  } catch (e) {
    err(res, e)
  }
}

export async function removeCommitteeMember(req: AuthRequest, res: Response) {
  try {
    const row = await svc.removeCommitteeMember(
      req.params.projectId,
      req.params.committeeId,
      req.params.memberId,
      userId(req),
    )
    if (!row) return fail(res, 404, 'Committee member not found')
    res.json({ success: true, data: row, message: 'Member removed' })
  } catch (e) {
    err(res, e)
  }
}

// --- CommitteeDefaultReviewer ----------------------------------------------

export async function setDefaultReviewer(req: AuthRequest, res: Response) {
  try {
    const row = await svc.setDefaultReviewer(
      req.params.projectId,
      req.params.committeeId,
      userId(req),
      (req.body?.baselineKind as string) ?? '',
    )
    res.status(201).json({ success: true, data: row })
  } catch (e) {
    err(res, e)
  }
}

export async function unsetDefaultReviewer(req: AuthRequest, res: Response) {
  try {
    const row = await svc.unsetDefaultReviewer(
      req.params.projectId,
      req.params.committeeId,
      req.params.reviewerId,
      userId(req),
    )
    if (!row) return fail(res, 404, 'Default reviewer mapping not found')
    res.json({ success: true, data: row, message: 'Default reviewer removed' })
  } catch (e) {
    err(res, e)
  }
}

// --- RaciEntry / RaciAssignment ---------------------------------------------

export async function listRaciEntries(req: AuthRequest, res: Response) {
  try {
    const data = await svc.listRaciEntries(req.params.projectId)
    res.json({ success: true, data })
  } catch (e) {
    err(res, e)
  }
}

export async function getRaciEntry(req: AuthRequest, res: Response) {
  try {
    const row = await svc.getRaciEntry(req.params.projectId, req.params.raciId)
    if (!row) return fail(res, 404, 'RACI entry not found')
    res.json({ success: true, data: row })
  } catch (e) {
    err(res, e)
  }
}

export async function createRaciEntry(req: AuthRequest, res: Response) {
  try {
    const body = req.body ?? {}
    const result = await svc.createRaciEntry(
      req.params.projectId,
      userId(req),
      body,
      Array.isArray(body.assignments) ? body.assignments : [],
    )
    res.status(201).json({ success: true, data: result.entry, warnings: result.warnings })
  } catch (e) {
    err(res, e)
  }
}

export async function updateRaciEntry(req: AuthRequest, res: Response) {
  try {
    const row = await svc.updateRaciEntry(
      req.params.projectId,
      req.params.raciId,
      userId(req),
      req.body ?? {},
    )
    if (!row) return fail(res, 404, 'RACI entry not found')
    res.json({ success: true, data: row })
  } catch (e) {
    err(res, e)
  }
}

export async function deleteRaciEntry(req: AuthRequest, res: Response) {
  try {
    const row = await svc.deleteRaciEntry(req.params.projectId, req.params.raciId, userId(req))
    if (!row) return fail(res, 404, 'RACI entry not found')
    res.json({ success: true, data: row, message: 'RACI entry deleted' })
  } catch (e) {
    err(res, e)
  }
}

export async function setRaciAssignments(req: AuthRequest, res: Response) {
  try {
    const body = req.body ?? {}
    const result = await svc.setRaciAssignments(
      req.params.projectId,
      req.params.raciId,
      userId(req),
      Array.isArray(body.assignments) ? body.assignments : [],
    )
    if (result === null) return fail(res, 404, 'RACI entry not found')
    res.json({ success: true, data: result.entry, warnings: result.warnings })
  } catch (e) {
    err(res, e)
  }
}
