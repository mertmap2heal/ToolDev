import { Router, Response } from 'express'
import { prisma } from '../lib/prisma'
import { authenticateToken } from '../middleware/auth.middleware'
import type { AuthRequest } from '../middleware/auth.middleware'
import { isAdminUser } from '../lib/adminAuth'

const router = Router()

/**
 * GET /search?q=<query>&limit=<n>
 *
 * Searches across the major entity tables. Results are strictly scoped to
 * projects the caller is a member of — plus projects the caller owns via
 * the legacy Project.userId column (backwards-compat with #144). Admin
 * users (SUPERIOR_ADMIN / COMPANY_ADMIN / AdminRole with admin rights)
 * continue to see everything.
 *
 * Issue #296: the previous implementation ran twelve findMany queries with
 * no projectId filter, leaking every tenant's requirement / issue / task /
 * parameter / change-request / component / diagram / test-case / inventory
 * titles and ids to any authenticated user.
 */
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const q = String(req.query.q ?? '').trim()
    if (!q || q.length < 2) {
      return res.json({ success: true, data: { results: [], query: q } })
    }

    const perCategory = Math.min(Number(req.query.limit) || 5, 20)
    const mode = 'insensitive' as const

    // Build the set of project IDs the caller may search.
    // Admins get `null` (no scope filter). Everyone else gets their membership
    // list unioned with projects they own via Project.userId (legacy owner
    // column that pre-dates ProjectMember rows).
    const isAdmin = await isAdminUser(userId)
    let projectIds: string[] | null = null
    if (!isAdmin) {
      const [memberships, owned] = await Promise.all([
        prisma.projectMember.findMany({
          where: { userId },
          select: { projectId: true },
        }),
        prisma.project.findMany({
          where: { userId },
          select: { id: true },
        }),
      ])
      const ids = new Set<string>()
      memberships.forEach((m) => ids.add(m.projectId))
      owned.forEach((p) => ids.add(p.id))
      projectIds = Array.from(ids)
      if (projectIds.length === 0) {
        return res.json({ success: true, data: { results: [], query: q } })
      }
    }

    // Reused project-scope clause for every table that carries projectId.
    const projectScope = projectIds === null ? {} : { projectId: { in: projectIds } }

    const [
      projects,
      requirements,
      tasks,
      issues,
      functions,
      parameters,
      changeRequests,
      useCases,
      diagrams,
      components,
      testCases,
      items,
    ] = await Promise.all([
      // ── Projects ──
      prisma.project.findMany({
        where: {
          ...(projectIds === null ? {} : { id: { in: projectIds } }),
          OR: [
            { name: { contains: q, mode } },
            { description: { contains: q, mode } },
          ],
        },
        select: { id: true, slug: true, name: true, description: true, status: true },
        take: perCategory,
      }),

      // ── Requirements ──
      prisma.requirement.findMany({
        where: {
          ...projectScope,
          OR: [
            { requirementId: { contains: q, mode } },
            { title: { contains: q, mode } },
            { description: { contains: q, mode } },
          ],
        },
        select: {
          id: true,
          requirementId: true,
          title: true,
          status: true,
          projectId: true,
        },
        take: perCategory,
      }),

      // ── Tasks ──
      prisma.task.findMany({
        where: {
          ...projectScope,
          OR: [
            { title: { contains: q, mode } },
            { descriptionRich: { contains: q, mode } },
          ],
        },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          projectId: true,
        },
        take: perCategory,
      }),

      // ── Issues ──
      prisma.issue.findMany({
        where: {
          ...projectScope,
          OR: [
            { issueKey: { contains: q, mode } },
            { title: { contains: q, mode } },
            { description: { contains: q, mode } },
          ],
        },
        select: {
          id: true,
          issueKey: true,
          title: true,
          status: true,
          priority: true,
          projectId: true,
        },
        take: perCategory,
      }),

      // ── System Functions ──
      prisma.systemFunction.findMany({
        where: {
          ...projectScope,
          OR: [
            { functionId: { contains: q, mode } },
            { name: { contains: q, mode } },
            { description: { contains: q, mode } },
          ],
        },
        select: {
          id: true,
          functionId: true,
          name: true,
          status: true,
          projectId: true,
        },
        take: perCategory,
      }),

      // ── Parameters ──
      prisma.parameter.findMany({
        where: {
          ...projectScope,
          OR: [
            { name: { contains: q, mode } },
            { description: { contains: q, mode } },
          ],
        },
        select: {
          id: true,
          name: true,
          dataType: true,
          projectId: true,
        },
        take: perCategory,
      }),

      // ── Change Requests ──
      prisma.changeRequest.findMany({
        where: {
          ...projectScope,
          OR: [
            { crId: { contains: q, mode } },
            { title: { contains: q, mode } },
            { description: { contains: q, mode } },
          ],
        },
        select: {
          id: true,
          crId: true,
          title: true,
          status: true,
          priority: true,
          projectId: true,
        },
        take: perCategory,
      }),

      // ── Use Cases ──
      prisma.useCase.findMany({
        where: {
          ...projectScope,
          OR: [
            { useCaseId: { contains: q, mode } },
            { name: { contains: q, mode } },
            { description: { contains: q, mode } },
          ],
        },
        select: {
          id: true,
          useCaseId: true,
          name: true,
          status: true,
          projectId: true,
        },
        take: perCategory,
      }),

      // ── Diagrams ──
      prisma.diagram.findMany({
        where: {
          ...projectScope,
          OR: [
            { name: { contains: q, mode } },
            { description: { contains: q, mode } },
          ],
        },
        select: {
          id: true,
          name: true,
          diagramType: true,
          projectId: true,
        },
        take: perCategory,
      }),

      // ── Components (PBS) ──
      prisma.component.findMany({
        where: {
          ...projectScope,
          OR: [
            { name: { contains: q, mode } },
            { description: { contains: q, mode } },
          ],
        },
        select: {
          id: true,
          name: true,
          description: true,
          projectId: true,
        },
        take: perCategory,
      }),

      // ── Verification Test Cases ──
      prisma.verTestCase.findMany({
        where: {
          ...projectScope,
          OR: [
            { key: { contains: q, mode } },
            { title: { contains: q, mode } },
            { objective: { contains: q, mode } },
          ],
        },
        select: {
          id: true,
          key: true,
          title: true,
          status: true,
          projectId: true,
        },
        take: perCategory,
      }),

      // ── Inventory Items ──
      // Items can be globally shared (projectId null) OR project-scoped.
      // Non-admins see only the shared bucket plus items in projects they
      // belong to.
      prisma.item.findMany({
        where: {
          AND: [
            {
              OR: [
                { sku: { contains: q, mode } },
                { name: { contains: q, mode } },
                { description: { contains: q, mode } },
              ],
            },
            projectIds === null
              ? {}
              : {
                  OR: [
                    { projectId: { in: projectIds } },
                    { projectId: null },
                  ],
                },
          ],
        },
        select: {
          id: true,
          sku: true,
          name: true,
          isActive: true,
        },
        take: perCategory,
      }),
    ])

    // Normalize into a flat results array with category tags
    const results: any[] = []

    projects.forEach((p) =>
      results.push({
        category: 'project',
        id: p.id,
        title: p.name,
        subtitle: p.description?.slice(0, 120) ?? '',
        status: p.status,
        route: `/projects/${p.slug ?? p.id}`,
      }),
    )

    requirements.forEach((r) =>
      results.push({
        category: 'requirement',
        id: r.id,
        displayId: r.requirementId,
        title: r.title,
        status: r.status,
        projectId: r.projectId,
        route: `/projects/${r.projectId}/requirements?focusRequirementId=${r.id}`,
      }),
    )

    tasks.forEach((t) =>
      results.push({
        category: 'task',
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        projectId: t.projectId,
        route: t.projectId ? `/projects/${t.projectId}/tasks` : '/tasks',
      }),
    )

    issues.forEach((i) =>
      results.push({
        category: 'issue',
        id: i.id,
        displayId: i.issueKey,
        title: i.title,
        status: i.status,
        priority: i.priority,
        projectId: i.projectId,
        route: `/projects/${i.projectId}/issues/${i.id}`,
      }),
    )

    functions.forEach((f) =>
      results.push({
        category: 'function',
        id: f.id,
        displayId: f.functionId,
        title: f.name,
        status: f.status,
        projectId: f.projectId,
        route: `/projects/${f.projectId}/functions`,
      }),
    )

    parameters.forEach((p) =>
      results.push({
        category: 'parameter',
        id: p.id,
        title: p.name,
        subtitle: p.dataType ?? '',
        projectId: p.projectId,
        route: `/projects/${p.projectId}/parameters`,
      }),
    )

    changeRequests.forEach((c) =>
      results.push({
        category: 'change-request',
        id: c.id,
        displayId: c.crId,
        title: c.title,
        status: c.status,
        priority: c.priority,
        projectId: c.projectId,
        route: `/projects/${c.projectId}/change-requests`,
      }),
    )

    useCases.forEach((u) =>
      results.push({
        category: 'use-case',
        id: u.id,
        displayId: u.useCaseId,
        title: u.name,
        status: u.status,
        projectId: u.projectId,
        route: `/projects/${u.projectId}/stakeholder`,
      }),
    )

    diagrams.forEach((d) =>
      results.push({
        category: 'diagram',
        id: d.id,
        title: d.name,
        subtitle: d.diagramType ?? '',
        projectId: d.projectId,
        route: `/projects/${d.projectId}/mbse-models`,
      }),
    )

    components.forEach((c) =>
      results.push({
        category: 'component',
        id: c.id,
        title: c.name,
        subtitle: c.description?.slice(0, 120) ?? '',
        projectId: c.projectId,
        route: `/projects/${c.projectId}/product-breakdown-structure`,
      }),
    )

    testCases.forEach((t) =>
      results.push({
        category: 'test-case',
        id: t.id,
        displayId: t.key,
        title: t.title,
        status: t.status,
        projectId: t.projectId,
        route: `/projects/${t.projectId}/verification?tab=cases`,
      }),
    )

    items.forEach((i) =>
      results.push({
        category: 'inventory-item',
        id: i.id,
        displayId: i.sku,
        title: i.name,
        status: i.isActive ? 'Active' : 'Inactive',
        route: '/inventory/items',
      }),
    )

    res.json({ success: true, data: { results, query: q } })
  } catch (error) {
    const err = error as Error
    console.error('Search error:', err)
    res.status(500).json({
      success: false,
      error:
        process.env.NODE_ENV === 'development'
          ? err.message
          : 'Internal server error',
    })
  }
})

export default router
