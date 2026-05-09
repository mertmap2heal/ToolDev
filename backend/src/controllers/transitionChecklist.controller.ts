import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { transitionChecklistService } from '../services/transitionChecklist.service'

export async function listChecklists(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const data = await transitionChecklistService.listByProject(projectId)
    res.json({ success: true, data })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}

export async function getChecklist(req: AuthRequest, res: Response) {
  try {
    const { projectId, checklistId } = req.params
    // #297: scope by projectId so cross-project checklist ids return 404.
    const data = await transitionChecklistService.getById(projectId, checklistId)
    if (!data) return res.status(404).json({ success: false, error: 'Checklist not found' })
    res.json({ success: true, data })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}

export async function createChecklist(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const { name, description, items } = req.body
    if (!name?.trim()) {
      return res.status(400).json({ success: false, error: 'Name is required' })
    }
    const data = await transitionChecklistService.create({
      projectId,
      name: name.trim(),
      description,
      createdBy: req.userId,
      items,
    })
    res.status(201).json({ success: true, data })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}

export async function updateChecklist(req: AuthRequest, res: Response) {
  try {
    const { projectId, checklistId } = req.params
    const { name, description, isActive, items } = req.body
    // #297: scope by projectId — cross-project updates throw 'Checklist not found'.
    const data = await transitionChecklistService.update(projectId, checklistId, {
      name,
      description,
      isActive,
      items,
    })
    res.json({ success: true, data })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'Checklist not found') return res.status(404).json({ success: false, error: msg })
    res.status(500).json({ success: false, error: msg })
  }
}

export async function deleteChecklist(req: AuthRequest, res: Response) {
  try {
    const { projectId, checklistId } = req.params
    // #297: cross-project hard-delete must 404 rather than destroy the row.
    await transitionChecklistService.deleteChecklist(projectId, checklistId)
    res.json({ success: true, message: 'Checklist deleted' })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'Checklist not found') return res.status(404).json({ success: false, error: msg })
    res.status(500).json({ success: false, error: msg })
  }
}

export async function getChecklistsForTransition(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const { lifecycleId, fromStatusId, toStatusId, itemType } = req.query as Record<string, string>
    if (!lifecycleId || !fromStatusId || !toStatusId) {
      return res.status(400).json({
        success: false,
        error: 'lifecycleId, fromStatusId, and toStatusId are required',
      })
    }
    const data = await transitionChecklistService.getChecklistsForTransition(
      projectId,
      lifecycleId,
      fromStatusId,
      toStatusId,
      itemType || 'Requirement'
    )
    res.json({ success: true, data })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}

export async function createAssignment(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const { checklistId, lifecycleId, fromStatusId, toStatusId, itemType } = req.body
    if (!checklistId || !lifecycleId || !fromStatusId || !toStatusId) {
      return res.status(400).json({
        success: false,
        error: 'checklistId, lifecycleId, fromStatusId, and toStatusId are required',
      })
    }
    const data = await transitionChecklistService.createAssignment({
      checklistId,
      projectId,
      lifecycleId,
      fromStatusId,
      toStatusId,
      itemType,
    })
    res.status(201).json({ success: true, data })
  } catch (e: any) {
    if (e.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'This checklist is already assigned to this transition' })
    }
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}

export async function deleteAssignment(req: AuthRequest, res: Response) {
  try {
    const { projectId, assignmentId } = req.params
    // #297: scope assignment delete to caller's project.
    await transitionChecklistService.deleteAssignment(projectId, assignmentId)
    res.json({ success: true, message: 'Assignment removed' })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'Assignment not found') return res.status(404).json({ success: false, error: msg })
    res.status(500).json({ success: false, error: msg })
  }
}

export async function submitCompletion(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const { checklistAssignmentId, entityType, entityId, responses, overriddenById } = req.body
    if (!checklistAssignmentId || !entityId || !responses?.length) {
      return res.status(400).json({
        success: false,
        error: 'checklistAssignmentId, entityId, and responses are required',
      })
    }
    const data = await transitionChecklistService.submitCompletion({
      checklistAssignmentId,
      entityType: entityType || 'Requirement',
      entityId,
      projectId,
      completedById: req.userId || '',
      overriddenById,
      responses,
    })
    res.status(201).json({ success: true, data })
  } catch (e) {
    const msg = (e as Error).message || ''
    if (msg.startsWith('[ChecklistValidation]')) {
      return res.status(400).json({
        success: false,
        error: msg.replace('[ChecklistValidation]', '').trim(),
      })
    }
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}

export async function getCompletionHistory(req: AuthRequest, res: Response) {
  try {
    const { projectId, entityId } = req.params
    const data = await transitionChecklistService.getCompletionHistory(projectId, entityId)
    res.json({ success: true, data })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}

export async function evaluateChecklist(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const { entityType, entityId, checklistItems } = req.body
    if (!entityId || !checklistItems?.length) {
      return res.status(400).json({ success: false, error: 'entityId and checklistItems are required' })
    }
    // SECURITY (HIGH-4): pass projectId so the service scopes the entity
    // lookup. Without this, a project-A member could probe project-B
    // requirements via this endpoint.
    const data = await transitionChecklistService.evaluateChecklistForEntity(
      checklistItems,
      entityType || 'Requirement',
      entityId,
      projectId,
    )
    res.json({ success: true, data })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}

export async function createChecklistItemIssue(req: AuthRequest, res: Response) {
  try {
    const { projectId, checklistItemId } = req.params
    const { entityType, entityId, title, description, priority, responseId } = req.body
    if (!title?.trim() || !description?.trim()) {
      return res.status(400).json({ success: false, error: 'Title and description are required' })
    }
    if (!entityId) {
      return res.status(400).json({ success: false, error: 'entityId is required' })
    }
    const data = await transitionChecklistService.createChecklistItemIssue({
      checklistItemId,
      responseId,
      entityType: entityType || 'Requirement',
      entityId,
      projectId,
      createdBy: req.userId,
      title: title.trim(),
      description: description.trim(),
      priority,
    })
    res.status(201).json({ success: true, data })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}

export async function getChecklistItemIssues(req: AuthRequest, res: Response) {
  try {
    const { projectId, checklistItemId } = req.params
    const entityId = req.query.entityId as string | undefined
    // #297: scope by projectId via checklist -> item relation walk.
    const data = await transitionChecklistService.getChecklistItemIssues(projectId, checklistItemId, entityId)
    res.json({ success: true, data })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'Checklist item not found') return res.status(404).json({ success: false, error: msg })
    res.status(500).json({ success: false, error: msg })
  }
}

export async function addChecklistItemComment(req: AuthRequest, res: Response) {
  try {
    const { projectId, responseId } = req.params
    const { content } = req.body
    if (!content?.trim()) {
      return res.status(400).json({ success: false, error: 'Content is required' })
    }
    const userName = req.userId
      ? (await import('../lib/prisma').then(m => m.prisma.user.findUnique({ where: { id: req.userId }, select: { name: true } })))?.name ?? 'Unknown'
      : 'Unknown'
    const data = await transitionChecklistService.addChecklistItemComment(
      responseId,
      projectId,
      content.trim(),
      req.userId || '',
      userName
    )
    res.status(201).json({ success: true, data })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}

export async function getChecklistItemComments(req: AuthRequest, res: Response) {
  try {
    const { projectId, responseId } = req.params
    // #297: scope by projectId through response -> completion chain.
    const data = await transitionChecklistService.getChecklistItemComments(projectId, responseId)
    res.json({ success: true, data })
  } catch (e) {
    const msg = (e as Error).message
    if (msg === 'Response not found') return res.status(404).json({ success: false, error: msg })
    res.status(500).json({ success: false, error: msg })
  }
}

export async function deleteChecklistItemComment(req: AuthRequest, res: Response) {
  try {
    const { projectId, commentId } = req.params
    const isAdmin = !!(req as any).isAdmin || !!(req as any).isSuperiorAdmin
    // #297: scope by projectId before the author-or-admin gate.
    await transitionChecklistService.deleteChecklistItemComment(projectId, commentId, req.userId || '', isAdmin)
    res.json({ success: true, message: 'Comment deleted' })
  } catch (e: any) {
    if (e.message === 'Comment not found') return res.status(404).json({ success: false, error: e.message })
    if (e.message === 'Not authorized to delete this comment') return res.status(403).json({ success: false, error: e.message })
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}
