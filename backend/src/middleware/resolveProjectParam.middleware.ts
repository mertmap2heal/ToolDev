import { Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { resolveIsAdmin } from '../lib/adminAuth'
import type { AuthRequest } from './auth.middleware'
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function resolveSlugOrIdToProjectId(
  idOrSlug: string
): Promise<string | null> {
  const isUuid = UUID_REGEX.test(idOrSlug)
  const project = isUuid
    ? await prisma.project.findUnique({ where: { id: idOrSlug }, select: { id: true } })
    : await prisma.project.findUnique({ where: { slug: idOrSlug }, select: { id: true } })
  return project?.id ?? null
}

/**
 * Verify the authenticated user is allowed to access the resolved project.
 * Accepts: accepted ProjectMember, legacy Project.userId owner, or platform
 * admin (role SUPERIOR_ADMIN | COMPANY_ADMIN, ADMIN_EMAILS, or first-user
 * fallback). Encapsulates the access rule so every param resolver shares it —
 * closes the IDOR gap tracked by #144 while matching the semantics of
 * requireProjectOwnerOrAdmin for admin bypass.
 */
async function userCanAccessProject(userId: string | undefined, projectId: string): Promise<boolean> {
  if (!userId) return false
  const member = await prisma.projectMember.findFirst({
    where: { projectId, userId, status: 'accepted' },
    select: { id: true },
  })
  if (member) return true

  const [project, user] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true, companyName: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, role: true, company: true },
    }),
  ])
  if (project?.userId === userId) return true
  // #281: SUPERIOR_ADMIN is platform-wide; COMPANY_ADMIN is tenant-scoped.
  // Before this fix, both bypassed unconditionally — a Company A admin
  // could reach Company B projects.
  if (user?.role === 'SUPERIOR_ADMIN') return true
  if (
    user?.role === 'COMPANY_ADMIN' &&
    project?.companyName != null &&
    user.company != null &&
    project.companyName === user.company
  ) {
    return true
  }
  if (user?.email && (await resolveIsAdmin(user.email))) return true
  return false
}

function createResolver(paramName: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const val = req.params[paramName]
    if (!val) {
      res.status(400).json({ success: false, error: 'Project id or slug required' })
      return
    }
    try {
      const projectId = await resolveSlugOrIdToProjectId(val)
      if (!projectId) {
        res.status(404).json({ success: false, error: 'Project not found' })
        return
      }
      const userId = req.userId ?? req.user?.userId
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' })
        return
      }
      if (!(await userCanAccessProject(userId, projectId))) {
        res.status(403).json({ success: false, error: 'Access denied: not a member of this project' })
        return
      }
      req.params[paramName] = projectId
      next()
    } catch (err) {
      console.error('resolveProjectParam error:', err)
      res.status(500).json({ success: false, error: 'Internal server error' })
    }
  }
}

/** Resolves req.params.id for /projects/:id routes */
export const resolveProjectParam = createResolver('id')

/** Resolves req.params.projectId for /projects/:projectId/... routes */
export const resolveProjectIdParam = createResolver('projectId')

/**
 * Express param middleware: use router.param('projectId', projectIdParam).
 *
 * Resolves slug/UUID to a canonical project id AND enforces that the
 * authenticated user is a member of that project. Routes that mount
 * authenticateToken before this param handler can rely on `req.params.projectId`
 * being both a valid UUID and access-checked (#144).
 */
export function projectIdParam(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
  projectIdVal: string
): void {
  resolveSlugOrIdToProjectId(projectIdVal)
    .then(async (resolved) => {
      if (!resolved) {
        res.status(404).json({ success: false, error: 'Project not found' })
        return
      }
      const userId = req.userId ?? req.user?.userId
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' })
        return
      }
      if (!(await userCanAccessProject(userId, resolved))) {
        res.status(403).json({ success: false, error: 'Access denied: not a member of this project' })
        return
      }
      req.params.projectId = resolved
      next()
    })
    .catch((err) => {
      console.error('projectIdParam error:', err)
      res.status(500).json({ success: false, error: 'Internal server error' })
    })
}
