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
    const uid = req.userId ?? req.user?.userId
    const sortByRaw = req.query.sortBy as string | undefined
    const sortDirRaw = req.query.sortDir as string | undefined
    const validSortBy = ['key', 'updatedAt', 'createdAt', 'status', 'milestone'] as const
    type ValidSortBy = (typeof validSortBy)[number]
    const sortBy: ValidSortBy | undefined =
      sortByRaw && (validSortBy as readonly string[]).includes(sortByRaw)
        ? (sortByRaw as ValidSortBy)
        : undefined
    const sortDir: 'asc' | 'desc' | undefined =
      sortDirRaw === 'asc' || sortDirRaw === 'desc' ? sortDirRaw : undefined
    const data = await svc.listItems(req.params.projectId, {
      status: req.query.status as string | undefined,
      methodType: req.query.methodType as string | undefined,
      milestone: req.query.milestone as string | undefined,
      ownerId: req.query.ownerId as string | undefined,
      search: req.query.search as string | undefined,
      includeDeleted: req.query.includeDeleted === 'true',
      starredOnly: req.query.starredOnly === 'true',
      starredByUserId: uid,
      sortBy,
      sortDir,
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

export async function listLinkedRequirements(req: AuthRequest, res: Response) {
  try {
    const data = await svc.listLinkedRequirements(req.params.projectId, req.params.id)
    if (data == null) return fail(res, 404, 'Validation item not found')
    res.json({ success: true, data })
  } catch (e) {
    err(res, e)
  }
}

export async function linkRequirement(req: AuthRequest, res: Response) {
  try {
    const data = await svc.linkRequirement(
      req.params.projectId,
      req.params.id,
      req.body?.requirementId,
      userId(req),
      req.body?.rationale,
    )
    if (!data) return fail(res, 404, 'Validation item or requirement not found')
    res.status(201).json({ success: true, data })
  } catch (e) {
    return fail(res, 400, (e as Error).message)
  }
}

export async function unlinkRequirement(req: AuthRequest, res: Response) {
  try {
    const data = await svc.unlinkRequirement(
      req.params.projectId,
      req.params.id,
      req.params.traceLinkId,
      userId(req),
    )
    if (!data) return fail(res, 404, 'Trace link not found')
    res.json({ success: true, data })
  } catch (e) {
    err(res, e)
  }
}

export async function bulkUpdate(req: AuthRequest, res: Response) {
  try {
    const data = await svc.bulkUpdate(req.params.projectId, userId(req), req.body ?? {})
    res.json({ success: true, data })
  } catch (e) {
    return fail(res, 400, (e as Error).message)
  }
}

export async function getCoverage(req: AuthRequest, res: Response) {
  try {
    const data = await svc.coverage(req.params.projectId)
    res.json({ success: true, data })
  } catch (e) {
    err(res, e)
  }
}

export async function listComments(req: AuthRequest, res: Response) {
  try {
    const data = await svc.listComments(req.params.projectId, req.params.id)
    if (data == null) return fail(res, 404, 'Validation item not found')
    res.json({ success: true, data })
  } catch (e) {
    err(res, e)
  }
}

export async function createComment(req: AuthRequest, res: Response) {
  try {
    const data = await svc.createComment(
      req.params.projectId,
      req.params.id,
      userId(req),
      req.body ?? {},
    )
    if (data == null) return fail(res, 404, 'Validation item not found')
    res.status(201).json({ success: true, data })
  } catch (e) {
    return fail(res, 400, (e as Error).message)
  }
}

export async function updateComment(req: AuthRequest, res: Response) {
  try {
    const data = await svc.updateComment(
      req.params.projectId,
      req.params.id,
      req.params.commentId,
      userId(req),
      req.body ?? {},
    )
    if (data == null) return fail(res, 404, 'Comment not found')
    res.json({ success: true, data })
  } catch (e) {
    return fail(res, 400, (e as Error).message)
  }
}

export async function deleteComment(req: AuthRequest, res: Response) {
  try {
    // For now, "admin" privilege is the project owner. Stricter role gating
    // will land in the Settings slice.
    const data = await svc.softDeleteComment(
      req.params.projectId,
      req.params.id,
      req.params.commentId,
      userId(req),
      false,
    )
    if (data == null) return fail(res, 404, 'Comment not found')
    res.json({ success: true, data })
  } catch (e) {
    return fail(res, 400, (e as Error).message)
  }
}

export async function star(req: AuthRequest, res: Response) {
  try {
    const data = await svc.star(req.params.projectId, req.params.id, userId(req))
    if (!data) return fail(res, 404, 'Validation item not found')
    res.json({ success: true, data })
  } catch (e) {
    err(res, e)
  }
}

export async function unstar(req: AuthRequest, res: Response) {
  try {
    const data = await svc.unstar(req.params.projectId, req.params.id, userId(req))
    if (!data) return fail(res, 404, 'Validation item not found')
    res.json({ success: true, data })
  } catch (e) {
    err(res, e)
  }
}

export async function listUncoveredRequirements(req: AuthRequest, res: Response) {
  try {
    const data = await svc.uncoveredRequirements(req.params.projectId)
    res.json({ success: true, data })
  } catch (e) {
    err(res, e)
  }
}
