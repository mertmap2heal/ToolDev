/**
 * Tasks-domain project-membership middleware.
 *
 * SCOPE - This file is the canonical chokepoint for tenant scoping on the
 * tasks subsystem (Tasks, Automation Rules, Templates, Tags, Board, Time
 * Tracking, Analytics, Import/Export). Every deny-audit row it writes uses
 * the `tasks:tenant-scope-denied` action string under the R-8
 * `<module>:<kebab-verb>` convention.
 *
 * Non-tasks consumers must NOT reuse these middlewares. Build a parallel
 * module-specific file and pick a fresh action namespace
 * (`<your-module>:tenant-scope-denied`). The `resourceLabel` option on
 * `requireBodyProjectMember` lets each call site record what kind of
 * resource was probed (e.g. `automation-rule`, `task-tag`, `tasks-bulk`).
 */
import { Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { AuthRequest } from './auth.middleware'

/**
 * Enforces project membership for task-subsystem routes that identify a task by
 * `req.params.id` (e.g. `/tasks/:id`, `/tasks/:id/comments`, `/attachments/:id`,
 * `/relations/:id`).
 *
 * Resolves the task's projectId, then confirms the authenticated user has a
 * ProjectMember row for that project.
 *
 * Must be placed after authenticateToken.
 *
 * Responses:
 *  - 401 when no authenticated user
 *  - 404 when the task / attachment / relation does not exist
 *  - 403 when the user is not a project member (or the resource has no project)
 */
export function requireTaskProjectMember(
  resolver: 'task' | 'attachment' | 'relation' | 'column' = 'task'
) {
  return async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.userId
      const { id } = req.params

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' })
        return
      }

      if (!id) {
        res.status(400).json({ success: false, error: 'Resource id is required' })
        return
      }

      let projectId: string | null | undefined

      if (resolver === 'task') {
        const task = await prisma.task.findUnique({
          where: { id },
          select: { projectId: true },
        })
        if (!task) {
          res.status(404).json({ success: false, error: 'Task not found' })
          return
        }
        projectId = task.projectId
      } else if (resolver === 'attachment') {
        const attachment = await prisma.taskAttachment.findUnique({
          where: { id },
          select: { task: { select: { projectId: true } } },
        })
        if (!attachment) {
          res.status(404).json({ success: false, error: 'Attachment not found' })
          return
        }
        projectId = attachment.task?.projectId
      } else if (resolver === 'relation') {
        const relation = await prisma.taskRelation.findUnique({
          where: { id },
          select: { fromTask: { select: { projectId: true } } },
        })
        if (!relation) {
          res.status(404).json({ success: false, error: 'Relation not found' })
          return
        }
        projectId = relation.fromTask?.projectId
      } else if (resolver === 'column') {
        const column = await prisma.boardColumn.findUnique({
          where: { id },
          select: { projectId: true },
        })
        if (!column) {
          res.status(404).json({ success: false, error: 'Board column not found' })
          return
        }
        projectId = column.projectId
      }

      if (!projectId) {
        res
          .status(403)
          .json({ success: false, error: 'Access denied: resource has no project scope' })
        return
      }

      const member = await prisma.projectMember.findFirst({
        where: { projectId, userId },
        select: { id: true },
      })

      if (!member) {
        res
          .status(403)
          .json({ success: false, error: 'Access denied: not a member of this project' })
        return
      }

      next()
    } catch (err) {
      console.error('requireTaskProjectMember error:', err)
      res.status(500).json({ success: false, error: 'Internal server error' })
    }
  }
}

/**
 * Enforces project membership for TimeLog routes that identify the log by
 * `req.params.id` (PATCH / DELETE `/time-tracking/:id`). Walks timeLog ->
 * task -> projectId, then verifies ProjectMember. Issue #286.
 *
 * Attaches the resolved projectId to req.timeLogProjectId so the controller
 * can enforce ownership rules (log.userId === caller unless owner/admin).
 */
export function requireTimeLogProjectMember() {
  return async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.userId
      const { id } = req.params

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' })
        return
      }
      if (!id) {
        res.status(400).json({ success: false, error: 'TimeLog id is required' })
        return
      }

      const log = await prisma.timeLog.findUnique({
        where: { id },
        select: {
          userId: true,
          task: { select: { projectId: true } },
        },
      })
      if (!log) {
        res.status(404).json({ success: false, error: 'Time log not found' })
        return
      }

      const projectId = log.task?.projectId
      if (!projectId) {
        res.status(403).json({
          success: false,
          error: 'Access denied: time log has no project scope',
        })
        return
      }

      const member = await prisma.projectMember.findFirst({
        where: { projectId, userId },
        select: { id: true },
      })
      if (!member) {
        res
          .status(403)
          .json({ success: false, error: 'Access denied: not a member of this project' })
        return
      }

      // Stash on req for controller-level ownership enforcement.
      ;(req as AuthRequest & { timeLog?: { ownerUserId: string; projectId: string } }).timeLog = {
        ownerUserId: log.userId,
        projectId,
      }

      next()
    } catch (err) {
      console.error('requireTimeLogProjectMember error:', err)
      res.status(500).json({ success: false, error: 'Internal server error' })
    }
  }
}

/**
 * Enforces project membership using the task id in `req.body.task_id` (or
 * `req.body.taskId`). Used by `POST /board/move-task` where the task is
 * identified in the body rather than the URL.
 */
export function requireBodyTaskProjectMember(
  fields: string[] = ['task_id', 'taskId']
) {
  return async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.userId
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' })
        return
      }

      let taskId: string | undefined
      for (const f of fields) {
        const raw = req.body?.[f]
        if (typeof raw === 'string' && raw.length > 0) {
          taskId = raw
          break
        }
      }

      if (!taskId) {
        res.status(400).json({ success: false, error: 'task_id is required' })
        return
      }

      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { projectId: true },
      })
      if (!task) {
        res.status(404).json({ success: false, error: 'Task not found' })
        return
      }
      if (!task.projectId) {
        res
          .status(403)
          .json({ success: false, error: 'Access denied: task has no project scope' })
        return
      }

      const member = await prisma.projectMember.findFirst({
        where: { projectId: task.projectId, userId },
        select: { id: true },
      })

      if (!member) {
        res
          .status(403)
          .json({ success: false, error: 'Access denied: not a member of this project' })
        return
      }

      next()
    } catch (err) {
      console.error('requireBodyTaskProjectMember error:', err)
      res.status(500).json({ success: false, error: 'Internal server error' })
    }
  }
}

/**
 * Enforces project membership using `req.body.project_id` (or
 * `req.body.projectId`) — used for routes that create tasks / operate on a
 * project-scoped payload without a resource id (e.g. `POST /tasks`,
 * `GET /tasks?project_id=...`, board/calendar/analytics endpoints).
 *
 * `location` lets us read from query or body. When the project id is missing
 * the request is rejected with 400 — unscoped list/search across all projects
 * is the exact IDOR we are removing.
 *
 * `options.resourceLabel` (SEC-2 review MEDIUM-1) — string written to the
 * deny-audit row's `resource` field so each consumer's audit trail records
 * the actual resource type (e.g. `automation-rule`, `task-tag`,
 * `tasks-bulk`). Defaults to `'project-scope-body'` for backwards
 * compatibility; explicit per-consumer labels are required for any route
 * mounted in this PR.
 */
export function requireBodyProjectMember(
  location: 'body' | 'query' = 'body',
  fields: string[] = ['project_id', 'projectId'],
  options?: { resourceLabel?: string }
) {
  const resourceLabel = options?.resourceLabel ?? 'project-scope-body'
  return async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.userId
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' })
        return
      }

      const source = location === 'body' ? req.body : req.query
      let projectId: string | undefined
      for (const f of fields) {
        const raw = source?.[f]
        if (typeof raw === 'string' && raw.length > 0) {
          projectId = raw
          break
        }
      }

      if (!projectId) {
        res
          .status(400)
          .json({ success: false, error: 'project_id is required for project-scoped task routes' })
        return
      }

      const member = await prisma.projectMember.findFirst({
        where: { projectId, userId },
        select: { id: true },
      })

      if (!member) {
        await writeTenantScopeDenyAudit({
          projectId,
          userId,
          resource: resourceLabel,
          resourceId: null,
          attemptedAction: req.method,
        })
        res
          .status(403)
          .json({ success: false, error: 'Access denied: not a member of this project' })
        return
      }

      next()
    } catch (err) {
      console.error('requireBodyProjectMember error:', err)
      res.status(500).json({ success: false, error: 'Internal server error' })
    }
  }
}

/**
 * SEC-2 (#375) - shared inline audit-deny writer. Records each 403 with the
 * `tasks:tenant-scope-denied` action string (per the R-8 <module>:<kebab-verb>
 * convention) anchored on the protected resource's projectId so the audit
 * lands in the correct company's feed. Single function so the new
 * Rule / Template middlewares emit consistent rows without forcing the
 * pre-fix `withDenyAudit` wrapper extraction (deferred - see PR body).
 */
async function writeTenantScopeDenyAudit(params: {
  projectId: string | null
  userId: string
  resource: string
  resourceId: string | null
  attemptedAction: string
}): Promise<void> {
  try {
    if (!params.projectId) return
    await prisma.auditLog.create({
      data: {
        projectId: params.projectId,
        userId: params.userId,
        action: 'tasks:tenant-scope-denied',
        details: JSON.stringify({
          resource: params.resource,
          resourceId: params.resourceId,
          attemptedAction: params.attemptedAction,
        }),
      },
    })
  } catch (err) {
    console.error('writeTenantScopeDenyAudit error:', err)
  }
}

/**
 * SEC-2 (#375) - Enforces project membership for AutomationRule routes that
 * identify a rule by `req.params.id`. Resolves AutomationRule.projectId,
 * then verifies ProjectMember.
 *
 * Pre-fix automation.routes.ts applied authenticateToken only - every
 * authenticated user could test-run, modify, or inspect runs of any
 * customer's rules. After SEC-2, AutomationRule.projectId is nullable
 * (legacy orphans backfill to NULL + isActive=false); a rule with
 * projectId=NULL is treated as not-found for non-superior callers so it
 * cannot be enumerated.
 *
 * Responses:
 *  - 401 when no authenticated user
 *  - 404 when the rule does not exist OR projectId is NULL (orphan)
 *  - 403 when the caller is not a project member
 */
export function requireRuleProjectMember() {
  return async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.userId
      const { id } = req.params

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' })
        return
      }
      if (!id) {
        res.status(400).json({ success: false, error: 'Rule id is required' })
        return
      }

      const rule = await prisma.automationRule.findUnique({
        where: { id },
        select: { projectId: true },
      })
      if (!rule) {
        res.status(404).json({ success: false, error: 'Automation rule not found' })
        return
      }
      if (!rule.projectId) {
        // Orphan rule (legacy backfill). Hide from non-superior callers so
        // membership cannot be probed; SUPERIOR_ADMIN handles reconciliation
        // via a separate path (out of scope for SEC-2).
        res.status(404).json({ success: false, error: 'Automation rule not found' })
        return
      }

      const member = await prisma.projectMember.findFirst({
        where: { projectId: rule.projectId, userId },
        select: { id: true },
      })

      if (!member) {
        await writeTenantScopeDenyAudit({
          projectId: rule.projectId,
          userId,
          resource: 'automation-rule',
          resourceId: id,
          attemptedAction: req.method,
        })
        res
          .status(403)
          .json({ success: false, error: 'Access denied: not a member of this project' })
        return
      }

      next()
    } catch (err) {
      console.error('requireRuleProjectMember error:', err)
      res.status(500).json({ success: false, error: 'Internal server error' })
    }
  }
}

/**
 * SEC-2 (#375) - Enforces project membership for TaskTemplate routes that
 * identify a template by `req.params.id`. Resolves TaskTemplate.projectId
 * (or accepts isGlobal=true read access).
 *
 * Pre-fix taskTemplates.routes.ts gated only `POST /:id/create-task` via
 * `requireBodyProjectMember`; list / get / patch / delete were
 * authenticateToken-only. The template controller already enforces tenancy
 * inside each handler (see template.controller.ts), but layering a
 * route-level middleware closes the class systematically and writes a
 * deny-audit row when a foreign tenant probes a template id.
 *
 * Semantics:
 *  - Global templates (isGlobal=true): pass through; the controller still
 *    enforces SUPERIOR_ADMIN for mutations.
 *  - Project-scoped templates: caller must be a member of the template's
 *    project.
 *
 * Responses:
 *  - 401 when no authenticated user
 *  - 404 when the template does not exist OR has neither projectId nor
 *    isGlobal=true (defensive - should not occur in normal data)
 *  - 403 when caller is not a project member (and template is not global)
 */
export function requireTemplateProjectMember() {
  return async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.userId
      const { id } = req.params

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' })
        return
      }
      if (!id) {
        res.status(400).json({ success: false, error: 'Template id is required' })
        return
      }

      const tpl = await prisma.taskTemplate.findUnique({
        where: { id },
        select: { projectId: true, isGlobal: true },
      })
      if (!tpl) {
        res.status(404).json({ success: false, error: 'Template not found' })
        return
      }

      // Global templates pass the gate; the controller enforces
      // SUPERIOR_ADMIN for mutations.
      if (tpl.isGlobal) {
        next()
        return
      }

      if (!tpl.projectId) {
        res.status(404).json({ success: false, error: 'Template not found' })
        return
      }

      const member = await prisma.projectMember.findFirst({
        where: { projectId: tpl.projectId, userId },
        select: { id: true },
      })

      if (!member) {
        await writeTenantScopeDenyAudit({
          projectId: tpl.projectId,
          userId,
          resource: 'task-template',
          resourceId: id,
          attemptedAction: req.method,
        })
        // Return 404 (not 403) so foreign tenants cannot enumerate template
        // existence; matches the controller's own behaviour for cross-tenant
        // GETs.
        res.status(404).json({ success: false, error: 'Template not found' })
        return
      }

      next()
    } catch (err) {
      console.error('requireTemplateProjectMember error:', err)
      res.status(500).json({ success: false, error: 'Internal server error' })
    }
  }
}
