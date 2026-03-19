import { Router, Response } from 'express'
import { prisma } from '../lib/prisma'
import { authenticateToken } from '../middleware/auth.middleware'
import type { AuthRequest } from '../middleware/auth.middleware'

const router = Router()

/**
 * GET /search?q=<query>&limit=<n>
 *
 * Searches across all major entity tables (projects, requirements, tasks,
 * issues, functions, parameters, change-requests, use-cases, diagrams,
 * components, verification test-cases, inventory items).
 *
 * Returns grouped results by category, limited per category.
 */
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const q = String(req.query.q ?? '').trim()
    if (!q || q.length < 2) {
      return res.json({ success: true, data: { results: [], query: q } })
    }

    const perCategory = Math.min(Number(req.query.limit) || 5, 20)
    const pattern = `%${q}%`

    // Run all queries in parallel for speed
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
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, slug: true, name: true, description: true, status: true },
        take: perCategory,
      }),

      // ── Requirements ──
      prisma.requirement.findMany({
        where: {
          OR: [
            { requirementId: { contains: q, mode: 'insensitive' } },
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
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
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { descriptionRich: { contains: q, mode: 'insensitive' } },
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
          OR: [
            { issueKey: { contains: q, mode: 'insensitive' } },
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
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
          OR: [
            { functionId: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
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
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
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
          OR: [
            { crId: { contains: q, mode: 'insensitive' } },
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
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
          OR: [
            { useCaseId: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
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
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
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
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
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
          OR: [
            { key: { contains: q, mode: 'insensitive' } },
            { title: { contains: q, mode: 'insensitive' } },
            { objective: { contains: q, mode: 'insensitive' } },
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
      prisma.item.findMany({
        where: {
          OR: [
            { sku: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
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
