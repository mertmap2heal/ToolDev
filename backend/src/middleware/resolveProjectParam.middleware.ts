import { Request, Response, NextFunction } from 'express'
import { PrismaClient } from '@prisma/client'
import type { AuthRequest } from './auth.middleware'

const prisma = new PrismaClient()
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

/** Express param middleware: use router.param('projectId', projectIdParam) */
export function projectIdParam(
  req: Request,
  res: Response,
  next: NextFunction,
  projectIdVal: string
): void {
  resolveSlugOrIdToProjectId(projectIdVal)
    .then((resolved) => {
      if (!resolved) {
        res.status(404).json({ success: false, error: 'Project not found' })
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
