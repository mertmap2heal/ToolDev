import { Response } from 'express'
import { Prisma } from '@prisma/client'
import { AuthRequest } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma'
import { createVersionSnapshot } from './version.controller'
import { traceabilityService } from '../services/traceability.service'
import { linkageAuditService } from '../services/linkageAudit.service'
import { requirementValidationService } from '../services/requirementValidation.service'
import { transitionChecklistService } from '../services/transitionChecklist.service'
import { requirementSubscriptionService } from '../services/requirementSubscription.service'
import { buildRequirementChangeSummary, notifyRequirementSubscribers } from '../services/requirementNotification.service'
import { extractParameterIds } from '../utils/parameterPlaceholder'
import { parseReqIF } from '../services/reqifParser'
import { collectComponentIdAndDescendants } from '../utils/componentHelpers'
import { filterIdsExcluding } from '../utils/requirementScopeMerge'
import { htmlToPlainText, truncatePlainText } from '../utils/htmlToPlainText'
import {
  validateRequirementText,
  stripToPlainText,
  type RequirementQualityReport,
} from '../../../shared/incoseEars/_compiled/index.js'
import {
  validateCreateRow,
  validateUpdateRow,
  type CreateRowContext,
  type CreateRowInput,
  type RowError,
  type UpdateRowContext,
  type UpdateRowInput,
  type ValidatedCreate,
  type ValidatedUpdate,
} from '../services/requirementBulkImport.helpers'
import fs from 'fs'
import path from 'path'


/** True when `s` is a present, non-blank string. */
function isNonBlank(s: unknown): s is string {
  return typeof s === 'string' && s.trim().length > 0
}

/**
 * N-2.3 (#428) — record an INCOSE/EARS quality-override in the central
 * `AuditLog`. Fired when an author saves a requirement whose description has
 * `error`-severity findings, supplying a non-blank `qualityOverrideReason`.
 * Audit failure must never fail the save (matches `baseline.controller.ts`).
 */
async function logQualityOverride(
  projectId: string,
  userId: string | undefined,
  detailsJson: Prisma.InputJsonObject
): Promise<void> {
  if (!userId) return
  try {
    await prisma.auditLog.create({
      data: { projectId, userId, action: 'requirements:quality-override', detailsJson },
    })
  } catch (e) {
    console.warn('Requirement quality-override audit log failed:', e)
  }
}

/** INCOSE-aligned: sync TraceLinks requirement -> parameter (constrained_by) from {{param:id}} in title/description. */
async function syncRequirementParameterLinks(
  projectId: string,
  requirementId: string,
  title: string,
  description: string,
  userId: string | undefined
): Promise<void> {
  const text = [title ?? '', description ?? ''].filter(Boolean).join(' ')
  const paramIdsLower = extractParameterIds(text)
  if (paramIdsLower.length === 0) {
    const existing = await prisma.traceLink.findMany({
      where: {
        projectId,
        sourceType: 'requirement',
        sourceId: requirementId,
        targetType: 'parameter',
        linkType: 'constrained_by',
      },
    })
    for (const link of existing) {
      await traceabilityService.deleteTraceLink(projectId, link.id, userId)
    }
    return
  }
  const parameters = await prisma.parameter.findMany({
    where: { projectId },
    select: { id: true },
  })
  const paramIdToRealId = new Map(parameters.map((p) => [p.id.toLowerCase(), p.id]))
  const existingLinks = await prisma.traceLink.findMany({
    where: {
      projectId,
      sourceType: 'requirement',
      sourceId: requirementId,
      targetType: 'parameter',
      linkType: 'constrained_by',
    },
  })
  const existingTargetIds = new Set(existingLinks.map((l) => l.targetId.toLowerCase()))
  for (const link of existingLinks) {
    if (!paramIdsLower.includes(link.targetId.toLowerCase())) {
      await traceabilityService.deleteTraceLink(projectId, link.id, userId)
      existingTargetIds.delete(link.targetId.toLowerCase())
    }
  }
  for (const paramIdLower of paramIdsLower) {
    const realId = paramIdToRealId.get(paramIdLower)
    if (!realId || existingTargetIds.has(paramIdLower)) continue
    await traceabilityService.createTraceLink(
      projectId,
      'requirement',
      requirementId,
      'parameter',
      realId,
      'constrained_by',
      undefined,
      'Referenced in requirement text (INCOSE traceability)',
      userId
    )
    existingTargetIds.add(paramIdLower)
  }
}

const MEANINGFUL_FIELDS = [
  'title',
  'description',
  'acceptanceCriteria',
  'verificationMethod',
  'parentId',
  'requirementType',
  'requirementLevel',
  'risk',
  'complexity',
  'source',
  'owner',
  'rationale',
  'assumptions',
  'linkedMocCode',
  'thresholdValue',
  'objectiveValue',
  'customAttributes',
  'isLocked', // Added for completeness, though handled separately
  'lockedByUserId',
  'lockedAt'
]

// Helper to check if a requirement is locked by another user
// Helper to check if a requirement is locked
const checkLock = (requirement: any, userId: string | undefined): boolean => {
  // If locked, no one can edit (must explicitly unlock first)
  return !!requirement.isLocked
}



// Helper function to generate requirement ID based on classification
async function generateRequirementId(projectId: string): Promise<string> {
  // Single O(1) query — avoids the full-table-scan + JS iteration that caused the
  // race condition documented in GitHub issue #91.
  const rows = await prisma.$queryRaw<Array<{ max: number | null }>>`
    SELECT MAX(
      CAST(SUBSTRING("requirementId" FROM 'REQ-([0-9]+)$') AS INTEGER)
    ) AS max
    FROM "Requirement"
    WHERE "projectId" = ${projectId}
      AND "requirementId" ~ '^REQ-[0-9]+$'
  `
  const raw = rows[0]?.max
  const current = raw == null ? 0 : (typeof raw === 'bigint' ? Number(raw) : Number(raw))
  return `REQ-${(current + 1).toString().padStart(3, '0')}`
}

// Helper function to check for circular references
async function checkCircularReference(
  requirementId: string,
  newParentId: string | null | undefined
): Promise<boolean> {
  if (!newParentId) return false

  let currentParentId: string | null = newParentId
  const visited = new Set<string>()

  while (currentParentId) {
    if (currentParentId === requirementId) {
      return true // Circular reference detected
    }
    if (visited.has(currentParentId)) {
      break // Prevent infinite loop
    }
    visited.add(currentParentId)

    const parent: { parentId: string | null } | null = await prisma.requirement.findUnique({
      where: { id: currentParentId },
      select: { parentId: true },
    })

    currentParentId = parent?.parentId || null
  }

  return false
}

// Helper function to update requirementId references across the system
// when a requirement's ID changes (e.g., when type changes)
async function updateRequirementIdReferences(
  projectId: string,
  oldRequirementId: string,
  newRequirementId: string,
  requirementUuid: string
) {
  try {
    // Update dependencies arrays in other requirements
    const requirementsWithDeps = await prisma.requirement.findMany({
      where: {
        projectId,
        dependencies: { has: oldRequirementId },
      },
    })

    for (const req of requirementsWithDeps) {
      await prisma.requirement.update({
        where: { id: req.id },
        data: {
          dependencies: req.dependencies.map(dep =>
            dep === oldRequirementId ? newRequirementId : dep
          ),
        },
      })
    }

    // Update conflicts arrays
    const requirementsWithConflicts = await prisma.requirement.findMany({
      where: {
        projectId,
        conflicts: { has: oldRequirementId },
      },
    })

    for (const req of requirementsWithConflicts) {
      await prisma.requirement.update({
        where: { id: req.id },
        data: {
          conflicts: req.conflicts.map(conf =>
            conf === oldRequirementId ? newRequirementId : conf
          ),
        },
      })
    }

    // Update UseCase relatedRequirementIds
    const useCasesWithRefs = await prisma.useCase.findMany({
      where: {
        projectId,
        relatedRequirementIds: { has: oldRequirementId },
      },
    })

    for (const useCase of useCasesWithRefs) {
      await prisma.useCase.update({
        where: { id: useCase.id },
        data: {
          relatedRequirementIds: useCase.relatedRequirementIds.map(id =>
            id === oldRequirementId ? newRequirementId : id
          ),
        },
      })
    }

    // Update baseline snapshots (parse JSON, update, re-stringify)
    const baselineItems = await prisma.baselineItem.findMany({
      where: {
        baseline: { projectId },
      },
      include: { baseline: true },
    })

    for (const item of baselineItems) {
      try {
        const snapshot = JSON.parse(item.snapshot)
        if (snapshot.requirementId === oldRequirementId) {
          snapshot.requirementId = newRequirementId
          await prisma.baselineItem.update({
            where: { id: item.id },
            data: {
              snapshot: JSON.stringify(snapshot),
            },
          })
        }
      } catch (e) {
        // Skip invalid JSON snapshots
        console.warn(`Invalid snapshot JSON for baseline item ${item.id}:`, e)
      }
    }

    console.log(`[Requirement ID Update] Updated references from "${oldRequirementId}" to "${newRequirementId}"`)
  } catch (error) {
    // Log error but don't throw - we don't want to fail the main update if reference updates fail
    console.error('Error updating requirement ID references:', error)
  }
}

/**
 * List filters use TraceLink as canonical storage (frontend link.service wraps traceability API).
 */
async function getRequirementIdsAllocatedToFunction(projectId: string, functionId: string): Promise<string[]> {
  const links = await prisma.traceLink.findMany({
    where: {
      projectId,
      sourceType: 'requirement',
      targetType: 'function',
      targetId: functionId,
      linkType: 'allocated_to',
    },
    select: { sourceId: true },
  })
  return [...new Set(links.map((l) => l.sourceId))]
}

async function getRequirementIdsLinkedToTestCasesVerifies(projectId: string, testCaseIds: string[]): Promise<string[]> {
  if (testCaseIds.length === 0) return []
  const ids = new Set<string>()
  const forward = await prisma.traceLink.findMany({
    where: {
      projectId,
      sourceType: 'requirement',
      targetId: { in: testCaseIds },
      linkType: 'verifies',
      OR: [{ targetType: 'test_case' }, { targetType: 'testcase' }],
    },
    select: { sourceId: true },
  })
  forward.forEach((l) => ids.add(l.sourceId))
  const reverse = await prisma.traceLink.findMany({
    where: {
      projectId,
      targetType: 'requirement',
      sourceId: { in: testCaseIds },
      linkType: 'verifies',
      OR: [{ sourceType: 'test_case' }, { sourceType: 'testcase' }],
    },
    select: { targetId: true },
  })
  reverse.forEach((l) => ids.add(l.targetId))
  return [...ids]
}

/** Requirement IDs that have any `verifies` link to a test case (req→case or case→req). */
async function getRequirementIdsLinkedToAnyTestCaseVerifies(projectId: string): Promise<string[]> {
  const ids = new Set<string>()
  const forward = await prisma.traceLink.findMany({
    where: {
      projectId,
      sourceType: 'requirement',
      linkType: 'verifies',
      OR: [{ targetType: 'test_case' }, { targetType: 'testcase' }],
    },
    select: { sourceId: true },
  })
  forward.forEach((l) => ids.add(l.sourceId))
  const reverse = await prisma.traceLink.findMany({
    where: {
      projectId,
      targetType: 'requirement',
      linkType: 'verifies',
      OR: [{ sourceType: 'test_case' }, { sourceType: 'testcase' }],
    },
    select: { targetId: true },
  })
  reverse.forEach((l) => ids.add(l.targetId))
  return [...ids]
}

async function getTestCaseIdsForPlan(projectId: string, testPlanId: string): Promise<string[]> {
  const plan = await prisma.verTestPlan.findFirst({
    where: { id: testPlanId, projectId },
    select: { id: true },
  })
  if (!plan) return []
  const rows = await prisma.verTestPlanCase.findMany({
    where: { testPlanId },
    select: { testCaseId: true },
  })
  return [...new Set(rows.map((r) => r.testCaseId))]
}

/** Walk parentId chain so list pagination (roots only) includes roots of linked child requirements. */
async function expandRequirementIdsToRootIds(projectId: string, requirementIds: string[]): Promise<string[]> {
  const unique = [...new Set(requirementIds)].filter(Boolean)
  if (unique.length === 0) return []
  const roots = new Set<string>()
  const visited = new Set<string>()
  let frontier = [...unique]
  let iter = 0
  while (frontier.length > 0 && iter < 200) {
    iter += 1
    const rows = await prisma.requirement.findMany({
      where: { id: { in: frontier }, projectId, deletedAt: null },
      select: { id: true, parentId: true },
    })
    const byId = new Map(rows.map((r) => [r.id, r]))
    const next: string[] = []
    for (const id of frontier) {
      if (visited.has(id)) continue
      visited.add(id)
      const r = byId.get(id)
      if (!r) continue
      if (!r.parentId) {
        roots.add(r.id)
      } else if (visited.has(r.parentId)) {
        roots.add(r.id)
      } else {
        next.push(r.parentId)
      }
    }
    frontier = [...new Set(next)]
  }
  return [...roots]
}

function intersectIds(a: string[], b: string[]): string[] {
  const bs = new Set(b)
  return a.filter((id) => bs.has(id))
}

export const getRequirements = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params

    // Parse pagination params
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize as string) || 50))
    const sortBy = (req.query.sortBy as string) || 'createdAt'
    const sortOrder = (req.query.sortOrder as string) === 'asc' ? 'asc' : 'desc'

    // Parse filter params
    const search = req.query.search as string | undefined
    const status = req.query.status as string | undefined
    const priority = req.query.priority as string | undefined
    const owner = req.query.owner as string | undefined
    const requirementType = req.query.requirementType as string | undefined
    const category = req.query.category as string | undefined
    const source = req.query.source as string | undefined
    const componentId = req.query.componentId as string | undefined
    const componentIdIncludeDescendants = (req.query.componentIdIncludeDescendants as string) !== 'false' // default true
    const verificationStatus = req.query.verificationStatus as string | undefined
    const reviewStatus = req.query.reviewStatus as string | undefined
    const functionId = req.query.functionId as string | undefined
    const testCaseId = req.query.testCaseId as string | undefined
    const testPlanId = req.query.testPlanId as string | undefined
    const noTestCaseVerifiesLinkRaw = req.query.noTestCaseVerifiesLink as string | undefined
    const noTestCaseVerifiesLink =
      noTestCaseVerifiesLinkRaw === '1' ||
      String(noTestCaseVerifiesLinkRaw || '').toLowerCase() === 'true'

    // Resolve componentId filter: when include-descendants, show requirements for selected component + all children
    let componentIdsFilter: string[] | string | undefined
    if (componentId) {
      if (componentIdIncludeDescendants) {
        const allIds = await collectComponentIdAndDescendants(projectId, componentId)
        componentIdsFilter = allIds
      } else {
        componentIdsFilter = componentId
      }
    }

    // Build where clause — paginate only root-level requirements
    const where: any = {
      projectId,
      deletedAt: null,
      parentId: null, // Only root-level for pagination
    }

    // Filter conditions
    if (status) where.status = status
    if (priority) where.priority = priority
    if (owner === 'unassigned') {
      where.owner = null
    } else if (owner) {
      where.owner = owner
    }
    if (requirementType === 'unassigned') {
      where.requirementType = null
    } else if (requirementType) {
      where.requirementType = requirementType
    }
    if (category === 'unassigned') {
      where.category = null
    } else if (category) {
      where.category = category
    }
    if (source === 'unassigned') {
      where.source = null
    } else if (source) {
      where.source = source
    }
    if (componentIdsFilter && (Array.isArray(componentIdsFilter) ? componentIdsFilter.length > 0 : true)) {
      where.componentId = Array.isArray(componentIdsFilter)
        ? { in: componentIdsFilter }
        : componentIdsFilter
    }
    if (verificationStatus) where.verificationStatus = verificationStatus
    if (reviewStatus) where.reviewStatus = reviewStatus

    // Side-panel scope: function allocation + verification (TraceLink); intersect if multiple params
    const scopeRootSets: string[][] = []
    if (functionId) {
      const linked = await getRequirementIdsAllocatedToFunction(projectId, functionId)
      scopeRootSets.push(await expandRequirementIdsToRootIds(projectId, linked))
    }
    let caseIdsForVerifies: string[] = []
    if (testCaseId) caseIdsForVerifies.push(testCaseId)
    if (testPlanId) {
      const planCases = await getTestCaseIdsForPlan(projectId, testPlanId)
      if (testCaseId) {
        caseIdsForVerifies = caseIdsForVerifies.filter((id) => planCases.includes(id))
      } else {
        caseIdsForVerifies = planCases
      }
    }
    if (caseIdsForVerifies.length > 0) {
      const linked = await getRequirementIdsLinkedToTestCasesVerifies(projectId, caseIdsForVerifies)
      scopeRootSets.push(await expandRequirementIdsToRootIds(projectId, linked))
    }

    let excludeRootIdsWithTestCaseVerifies: string[] = []
    if (noTestCaseVerifiesLink) {
      const linkedReqIds = await getRequirementIdsLinkedToAnyTestCaseVerifies(projectId)
      excludeRootIdsWithTestCaseVerifies = await expandRequirementIdsToRootIds(projectId, linkedReqIds)
    }

    if (scopeRootSets.length > 0) {
      let merged = scopeRootSets[0]
      for (let i = 1; i < scopeRootSets.length; i++) {
        merged = intersectIds(merged, scopeRootSets[i])
      }
      if (excludeRootIdsWithTestCaseVerifies.length > 0) {
        merged = filterIdsExcluding(merged, excludeRootIdsWithTestCaseVerifies)
      }
      where.id = merged.length === 0 ? { in: [] } : { in: merged }
    } else if (excludeRootIdsWithTestCaseVerifies.length > 0) {
      where.id = { notIn: excludeRootIdsWithTestCaseVerifies }
    }

    // Full-text search across multiple fields
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { requirementId: { contains: search, mode: 'insensitive' } },
        { owner: { contains: search, mode: 'insensitive' } },
        { source: { contains: search, mode: 'insensitive' } },
        { acceptanceCriteria: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } },
      ]
    }

    // Validate sortBy against allowed columns
    const allowedSortColumns = [
      'createdAt', 'updatedAt', 'title', 'requirementId',
      'priority', 'status', 'owner', 'requirementType', 'category', 'source', 'stage',
      'requirementLevel', 'risk', 'complexity', 'verificationStatus', 'verificationDate', 'linkedMocCode', 'componentId',
    ]
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'createdAt'

    // Count total matching root requirements
    const total = await prisma.requirement.count({ where })

    // Fetch paginated root requirements with children included
    const requirements = await prisma.requirement.findMany({
      where,
      include: {
        parent: {
          select: {
            id: true,
            requirementId: true,
            title: true,
          },
        },
        children: {
          where: { deletedAt: null },
          include: {
            parent: {
              select: { id: true, requirementId: true, title: true },
            },
            children: {
              where: { deletedAt: null },
              select: {
                id: true,
                requirementId: true,
                title: true,
                priority: true,
                status: true,
              },
            },
            component: {
              select: { id: true, name: true },
            },
            comments: { orderBy: { createdAt: 'desc' } },
            attachments: { orderBy: { createdAt: 'desc' } },
            _count: { select: { changeRequestLinks: true } },
          },
          orderBy: [
            { requirementId: 'asc' },
            { createdAt: 'desc' },
          ],
        },
        component: {
          select: {
            id: true,
            name: true,
          },
        },
        comments: {
          orderBy: { createdAt: 'desc' },
        },
        attachments: {
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            changeRequestLinks: true,
          },
        },
      },
      orderBy: { [safeSortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })

    const totalPages = Math.ceil(total / pageSize)

    res.json({
      success: true,
      data: {
        items: requirements,
        total,
        page,
        pageSize,
        totalPages,
      },
    })
  } catch (error) {
    console.error('Get requirements error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

/**
 * Get ALL requirements for a project without pagination.
 * Used by Export, Diagram, Traceability Matrix, etc.
 */
export const getAllRequirements = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params

    const requirements = await prisma.requirement.findMany({
      where: {
        projectId,
        deletedAt: null,
      },
      include: {
        parent: {
          select: {
            id: true,
            requirementId: true,
            title: true,
          },
        },
        children: {
          select: {
            id: true,
            requirementId: true,
            title: true,
            priority: true,
            status: true,
          },
        },
        component: {
          select: {
            id: true,
            name: true,
          },
        },
        comments: {
          orderBy: { createdAt: 'desc' },
        },
        attachments: {
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            changeRequestLinks: true,
          },
        },
      },
      orderBy: [
        { parentId: 'asc' },
        { requirementId: 'asc' },
        { createdAt: 'desc' },
      ],
    })

    res.json({
      success: true,
      data: requirements,
    })
  } catch (error) {
    console.error('Get all requirements error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const getRequirement = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, requirementId } = req.params

    const requirement = await prisma.requirement.findFirst({
      where: {
        projectId,
        OR: [
          { id: requirementId },
          { requirementId: requirementId },
        ],
      },
      include: {
        parent: {
          select: {
            id: true,
            requirementId: true,
            title: true,
            description: true,
          },
        },
        children: {
          select: {
            id: true,
            requirementId: true,
            title: true,
            priority: true,
            status: true,
            description: true,
          },
        },
        comments: {
          orderBy: { createdAt: 'desc' },
        },
        attachments: {
          orderBy: { createdAt: 'desc' },
        },
        changeRequestLinks: {
          include: {
            changeRequest: {
              select: {
                id: true,
                crId: true,
                title: true,
                status: true,
                priority: true,
              },
            },
          },
        },
      },
    })

    if (!requirement) {
      return res.status(404).json({
        success: false,
        error: 'Requirement not found',
      })
    }

    res.json({
      success: true,
      data: requirement,
    })
  } catch (error) {
    console.error('Get requirement error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const getRequirementSubscription = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, requirementId } = req.params
    const userId = req.userId

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const requirement = await prisma.requirement.findFirst({
      where: {
        projectId,
        OR: [{ id: requirementId }, { requirementId: requirementId }],
      },
    })

    if (!requirement) {
      return res.status(404).json({ success: false, error: 'Requirement not found' })
    }

    const snapshot = await requirementSubscriptionService.getSubscriptionSnapshot(
      requirement.id,
      userId
    )

    res.json({
      success: true,
      data: snapshot,
    })
  } catch (error) {
    console.error('Get requirement subscription error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const subscribeToRequirement = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, requirementId } = req.params
    const userId = req.userId

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const requirement = await prisma.requirement.findFirst({
      where: {
        projectId,
        OR: [{ id: requirementId }, { requirementId: requirementId }],
      },
    })

    if (!requirement) {
      return res.status(404).json({ success: false, error: 'Requirement not found' })
    }

    await requirementSubscriptionService.subscribe(requirement.id, userId)
    const snapshot = await requirementSubscriptionService.getSubscriptionSnapshot(
      requirement.id,
      userId
    )

    res.json({
      success: true,
      data: snapshot,
    })
  } catch (error) {
    console.error('Subscribe requirement error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const unsubscribeFromRequirement = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, requirementId } = req.params
    const userId = req.userId

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const requirement = await prisma.requirement.findFirst({
      where: {
        projectId,
        OR: [{ id: requirementId }, { requirementId: requirementId }],
      },
    })

    if (!requirement) {
      return res.status(404).json({ success: false, error: 'Requirement not found' })
    }

    await requirementSubscriptionService.unsubscribe(requirement.id, userId)
    const snapshot = await requirementSubscriptionService.getSubscriptionSnapshot(
      requirement.id,
      userId
    )

    res.json({
      success: true,
      data: snapshot,
    })
  } catch (error) {
    console.error('Unsubscribe requirement error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const getRequirementChildren = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, requirementId } = req.params

    const requirement = await prisma.requirement.findFirst({
      where: {
        projectId,
        OR: [
          { id: requirementId },
          { requirementId: requirementId },
        ],
      },
    })

    if (!requirement) {
      return res.status(404).json({
        success: false,
        error: 'Requirement not found',
      })
    }

    const children = await prisma.requirement.findMany({
      where: {
        projectId,
        parentId: requirement.id,
      },
      orderBy: { requirementId: 'asc' },
    })

    res.json({
      success: true,
      data: children,
    })
  } catch (error) {
    console.error('Get requirement children error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

/** GET /requirements/:projectId/audit?entityType=&entityId= - audit events for an entity */
export const getAuditEvents = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { entityType, entityId } = req.query
    if (!entityType || !entityId) {
      return res.status(400).json({
        success: false,
        error: 'entityType and entityId query params are required',
      })
    }
    const events = await prisma.verAuditEvent.findMany({
      where: {
        projectId,
        entityType: String(entityType),
        entityId: String(entityId),
      },
      orderBy: { performedAt: 'desc' },
      take: 100,
    })
    const actorIds = [...new Set(events.map((e) => e.performedByUserId).filter((id): id is string => !!id))]
    const actors =
      actorIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: actorIds } },
            select: { id: true, name: true, email: true },
          })
        : []
    const actorById = new Map(actors.map((u) => [u.id, u]))
    const data = events.map((e) => ({
      ...e,
      performedBy: e.performedByUserId ? actorById.get(e.performedByUserId) ?? null : null,
    }))
    res.json({ success: true, data })
  } catch (error) {
    console.error('Get audit events error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

function parseCsvList(value: unknown): string[] {
  if (typeof value !== 'string') return []
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function clampInt(value: unknown, def: number, min: number, max: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return def
  return Math.max(min, Math.min(max, Math.floor(n)))
}

function buildActionPrefixesForCategories(categories: string[]): string[] {
  const set = new Set<string>()
  for (const c of categories) {
    switch (String(c).toLowerCase()) {
      case 'requirement':
        set.add('REQUIREMENT_')
        break
      case 'links':
        set.add('LINK_')
        // requirement linkage actions also include trace-link actions
        set.add('REQUIREMENT_TRACE_LINK_')
        set.add('ISSUE_')
        set.add('CHANGE_REQUEST_')
        set.add('TEST_CASE_')
        set.add('TEST_PLAN_')
        break
      case 'comments':
        set.add('REQUIREMENT_COMMENT_')
        break
      case 'baselines':
        set.add('BASELINE_')
        break
      case 'imports_exports':
        set.add('REQUIREMENTS_IMPORT_')
        set.add('REQUIREMENTS_EXPORT_')
        break
    }
  }
  return Array.from(set.values())
}

/** GET /requirements/:projectId/audit/project - project-wide audit log with filters + pagination */
export const getProjectAuditEvents = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { page, pageSize, from, to, categories, actor, search } = req.query as any

    const pageNum = clampInt(page, 1, 1, 1000000)
    const sizeNum = clampInt(pageSize, 50, 1, 200)
    const skip = (pageNum - 1) * sizeNum

    const fromDate = typeof from === 'string' && from.trim() ? new Date(from) : null
    const toDate = typeof to === 'string' && to.trim() ? new Date(to) : null
    if (fromDate && isNaN(fromDate.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid from date' })
    }
    if (toDate && isNaN(toDate.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid to date' })
    }

    const categoryList = Array.isArray(categories)
      ? (categories as any[]).map(String)
      : parseCsvList(categories)
    const prefixes = categoryList.length ? buildActionPrefixesForCategories(categoryList) : []

    const actorQ = typeof actor === 'string' ? actor.trim() : ''
    const searchQ = typeof search === 'string' ? search.trim() : ''

    const actorIds =
      actorQ.length > 0
        ? (
            await prisma.user.findMany({
              where: {
                OR: [
                  { name: { contains: actorQ, mode: 'insensitive' } },
                  { email: { contains: actorQ, mode: 'insensitive' } },
                ],
              },
              select: { id: true },
              take: 50,
            })
          ).map((u) => u.id)
        : []

    const where: any = {
      projectId,
      ...(fromDate || toDate
        ? {
            performedAt: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
      ...(actorQ ? { performedByUserId: { in: actorIds.length ? actorIds : ['__none__'] } } : {}),
      ...(prefixes.length
        ? {
            OR: prefixes.map((p) => ({ action: { startsWith: p } })),
          }
        : {}),
      ...(searchQ
        ? {
            AND: [
              {
                OR: [
                  { entityId: { contains: searchQ, mode: 'insensitive' } },
                  { entityType: { contains: searchQ, mode: 'insensitive' } },
                  { action: { contains: searchQ, mode: 'insensitive' } },
                ],
              },
            ],
          }
        : {}),
    }

    const [total, events] = await Promise.all([
      prisma.verAuditEvent.count({ where }),
      prisma.verAuditEvent.findMany({
        where,
        orderBy: { performedAt: 'desc' },
        skip,
        take: sizeNum,
      }),
    ])

    const actorIdsForPage = [...new Set(events.map((e) => e.performedByUserId).filter((id): id is string => !!id))]
    const actors =
      actorIdsForPage.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: actorIdsForPage } },
            select: { id: true, name: true, email: true },
          })
        : []
    const actorById = new Map(actors.map((u) => [u.id, u]))

    const normType = (t: any) => String(t ?? '').toLowerCase().replace(/-/g, '_')
    type LinkLike = { sourceType?: string; sourceId?: string; targetType?: string; targetId?: string; linkType?: string }
    const linkPayloadFor = (e: any): LinkLike | null => {
      const v = (e.newValue ?? e.oldValue) as any
      if (!v || typeof v !== 'object') return null
      const st = v.sourceType
      const sid = v.sourceId
      const tt = v.targetType
      const tid = v.targetId
      if (!st || !sid || !tt || !tid) return null
      return { sourceType: String(st), sourceId: String(sid), targetType: String(tt), targetId: String(tid), linkType: v.linkType ? String(v.linkType) : undefined }
    }

    // Enrich link-like audit payloads with display IDs / titles (so UI can avoid UUID fragments)
    const reqIds = new Set<string>()
    const paramIds = new Set<string>()
    for (const e of events as any[]) {
      const p = linkPayloadFor(e)
      if (!p) continue
      if (normType(p.sourceType) === 'requirement') reqIds.add(p.sourceId!)
      if (normType(p.targetType) === 'requirement') reqIds.add(p.targetId!)
      if (normType(p.sourceType) === 'parameter') paramIds.add(p.sourceId!)
      if (normType(p.targetType) === 'parameter') paramIds.add(p.targetId!)
    }

    const [reqs, params] = await Promise.all([
      reqIds.size
        ? prisma.requirement.findMany({
            where: { id: { in: Array.from(reqIds) }, projectId },
            select: { id: true, requirementId: true, title: true },
          })
        : Promise.resolve([]),
      paramIds.size
        ? prisma.parameter.findMany({
            where: { id: { in: Array.from(paramIds) }, projectId },
            select: { id: true, parameterId: true, name: true },
          })
        : Promise.resolve([]),
    ])

    const reqById = new Map(reqs.map((r) => [r.id, r]))
    const paramById = new Map(params.map((p) => [p.id, p]))

    const enrichSide = (t: string | undefined, id: string | undefined) => {
      const nt = normType(t)
      if (!id) return null
      if (nt === 'requirement') {
        const r = reqById.get(id)
        if (!r) return { displayId: id.slice(0, 8), label: null }
        return { displayId: r.requirementId || r.id.slice(0, 8), label: r.title || null }
      }
      if (nt === 'parameter') {
        const p = paramById.get(id)
        if (!p) return { displayId: id.slice(0, 8), label: null }
        return { displayId: p.parameterId || p.id.slice(0, 8), label: p.name || null }
      }
      return { displayId: id.slice(0, 8), label: null }
    }

    const items = events.map((e: any) => {
      const payload = linkPayloadFor(e)
      if (payload) {
        const s = enrichSide(payload.sourceType, payload.sourceId)
        const t = enrichSide(payload.targetType, payload.targetId)
        const into = (v: any) =>
          v && typeof v === 'object'
            ? {
                ...v,
                sourceDisplayId: s?.displayId ?? null,
                sourceLabel: s?.label ?? null,
                targetDisplayId: t?.displayId ?? null,
                targetLabel: t?.label ?? null,
              }
            : v
        e = { ...e, newValue: into(e.newValue), oldValue: into(e.oldValue) }
      }
      return {
        ...e,
        performedBy: e.performedByUserId ? actorById.get(e.performedByUserId) ?? null : null,
        correlationId: null as any, // reserved for future (not on VerAuditEvent schema yet)
      }
    })

    res.json({
      success: true,
      data: {
        items,
        total,
        page: pageNum,
        pageSize: sizeNum,
      },
    })
  } catch (error) {
    console.error('Get project audit events error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const createRequirement = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const {
      requirementId: providedRequirementId,
      title,
      description,
      parentId,
      priority,
      status,
      stage,
      owner,
      verificationMethod,
      acceptanceCriteria,
      source,
      category,
      relatedDocuments,
      tags,
      requirementType,
      requirementLevel,
      risk,
      complexity,
      rationale,
      linkedMocCode,
      lifecycleId,
      statusId,
      componentId,
      thresholdValue,
      objectiveValue,
      customAttributes,
      links,
      qualityOverrideReason,
    } = req.body

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Title is required',
      })
    }

    if (!description) {
      return res.status(400).json({
        success: false,
        error: 'Description is required',
      })
    }

    // N-2.3 (#428): INCOSE/EARS write-time quality gate. A description with an
    // `error`-severity finding is rejected 422 with the qualityReport, UNLESS
    // a non-blank `qualityOverrideReason` is supplied (-> save proceeds + an
    // AuditLog row). The validator runs the same code the editor pre-check runs.
    const qualityReport: RequirementQualityReport = validateRequirementText(
      stripToPlainText(description)
    )
    if (qualityReport.hasErrors && !isNonBlank(qualityOverrideReason)) {
      return res.status(422).json({
        success: false,
        error:
          'Requirement text has quality findings that must be resolved or overridden',
        qualityReport,
      })
    }

    // Validate user-provided requirementId for conflicts before proceeding
    let finalRequirementId = providedRequirementId
    if (finalRequirementId) {
      const existingRequirement = await prisma.requirement.findFirst({
        where: { projectId, requirementId: finalRequirementId },
      })
      if (existingRequirement) {
        if (existingRequirement.deletedAt) {
          return res.status(400).json({
            success: false,
            error: `This Requirement ID "${finalRequirementId}" is reserved until the deleted item is restored or permanently deleted.`,
          })
        }
        return res.status(400).json({
          success: false,
          error: `Requirement ID "${finalRequirementId}" already exists in this project`,
        })
      }
    } else {
      // Auto-generate — use SQL MAX for O(1) read; retry on the rare concurrent collision
      finalRequirementId = await generateRequirementId(projectId)
    }

    // Validate parent if provided
    if (parentId) {
      const parent = await prisma.requirement.findFirst({
        where: {
          projectId,
          OR: [
            { id: parentId },
            { requirementId: parentId },
          ],
        },
      })

      if (!parent) {
        return res.status(400).json({
          success: false,
          error: 'Parent requirement not found',
        })
      }
    }

    // Retry loop handles the rare concurrent-create collision on the auto-generated ID.
    // User-provided IDs are not retried (collision is a user error, not a race).
    let requirement: Awaited<ReturnType<typeof prisma.requirement.create>> | null = null
    let lastIdError: unknown
    const maxAttempts = providedRequirementId ? 1 : 5
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) finalRequirementId = await generateRequirementId(projectId)
      try {
        requirement = await prisma.requirement.create({
          data: {
            projectId,
            requirementId: finalRequirementId,
            title,
            description,
            parentId: parentId || null,
            priority: priority || 'medium',
            status: status || 'draft',
            stage: stage || '',
            owner: owner || null,
            verificationMethod: verificationMethod || null,
            acceptanceCriteria: acceptanceCriteria || null,
            source: source || null,
            category: category || null,
            relatedDocuments: relatedDocuments || [],
            tags: tags || [],
            requirementType: requirementType || null,
            requirementLevel: requirementLevel || null,
            risk: risk || null,
            complexity: complexity || null,
            rationale: rationale || null,
            linkedMocCode: linkedMocCode ? parseInt(linkedMocCode, 10) : null,
            componentId: componentId || null,
            lifecycleId: lifecycleId || null,
            statusId: statusId || null,
            thresholdValue: thresholdValue || null,
            objectiveValue: objectiveValue || null,
            customAttributes: customAttributes || null,
          },
          include: {
            parent: { select: { id: true, requirementId: true, title: true } },
            moc: true,
          },
        })
        break
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          lastIdError = e
          continue
        }
        throw e
      }
    }
    if (!requirement) throw lastIdError ?? new Error('Could not allocate a unique requirement ID')

    // Create additional trace links if provided
    if (links && Array.isArray(links) && links.length > 0) {
      for (const link of links) {
        await traceabilityService.createTraceLink(
          projectId,
          'requirement',
          requirement.id,
          link.targetType,
          link.targetId,
          link.linkType,
          undefined,
          link.rationale,
          req.userId
        )
      }
    }

    await syncRequirementParameterLinks(projectId, requirement.id, title, description, req.userId)

    await linkageAuditService.log({
      projectId,
      entityType: 'REQUIREMENT',
      entityId: requirement.id,
      action: 'REQUIREMENT_CREATED',
      newValue: { requirementId: requirement.requirementId, title: requirement.title },
      performedByUserId: req.userId,
    })

    // N-2.3 (#428): record the quality-override when one was applied.
    if (qualityReport.hasErrors && isNonBlank(qualityOverrideReason)) {
      await logQualityOverride(projectId, req.userId, {
        requirementId: requirement.id,
        requirementKey: requirement.requirementId,
        mode: 'create',
        overrideReason: qualityOverrideReason.trim(),
        score: qualityReport.score,
        earsPattern: qualityReport.earsPattern,
        findingRuleIds: qualityReport.findings
          .filter((f) => f.severity === 'error')
          .map((f) => f.ruleId),
      })
    }

    res.status(201).json({
      success: true,
      data: requirement,
      qualityReport,
    })
  } catch (error: any) {
    console.error('Create requirement error:', error)

    let errorMessage = 'Internal server error'
    if (error?.message) {
      errorMessage = error.message
      if (error.message.includes('Unique constraint')) {
        errorMessage = 'Requirement ID already exists'
      } else if (error.message.includes('Foreign key constraint')) {
        errorMessage = 'Invalid project or parent requirement ID'
      }
    }

    res.status(500).json({
      success: false,
      error: errorMessage,
    })
  }
}

export const lockRequirement = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, requirementId } = req.params
    const userId = req.userId

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const requirement = await prisma.requirement.findFirst({
      where: { projectId, id: requirementId },
    })

    if (!requirement) {
      return res.status(404).json({ success: false, error: 'Requirement not found' })
    }

    if (requirement.isLocked) {
      if (requirement.lockedByUserId === userId) {
        return res.json({ success: true, data: requirement }) // Idempotent success
      }
      return res.status(409).json({
        success: false,
        error: 'Requirement is already locked by another user',
        lockedByUserId: requirement.lockedByUserId,
      })
    }

    const lockedRequirement = await prisma.requirement.update({
      where: { id: requirement.id },
      data: {
        isLocked: true,
        lockedByUserId: userId,
        lockedAt: new Date(),
      },
    })

    await linkageAuditService.log({
      projectId,
      entityType: 'REQUIREMENT',
      entityId: requirement.id,
      action: 'REQUIREMENT_LOCKED',
      newValue: { lockedByUserId: userId },
      performedByUserId: userId,
    })

    res.json({ success: true, data: lockedRequirement })
  } catch (error) {
    console.error('Lock requirement error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const unlockRequirement = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, requirementId } = req.params
    const userId = req.userId

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const requirement = await prisma.requirement.findFirst({
      where: { projectId, id: requirementId },
    })

    if (!requirement) {
      return res.status(404).json({ success: false, error: 'Requirement not found' })
    }

    if (!requirement.isLocked) {
      return res.json({ success: true, data: requirement })
    }

    // Allow admins to force-unlock any requirement (prevents lock-based DoS)
    const isAdmin = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    }).then(u => u?.role === 'SUPERIOR_ADMIN' || u?.role === 'COMPANY_ADMIN').catch(() => false)

    if (requirement.lockedByUserId !== userId && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only the user who locked the requirement can unlock it',
      })
    }

    const unlockedRequirement = await prisma.requirement.update({
      where: { id: requirement.id },
      data: {
        isLocked: false,
        lockedByUserId: null,
        lockedAt: null,
      },
    })

    await linkageAuditService.log({
      projectId,
      entityType: 'REQUIREMENT',
      entityId: requirement.id,
      action: 'REQUIREMENT_UNLOCKED',
      newValue: { unlockedByUserId: userId },
      performedByUserId: userId,
    })

    res.json({ success: true, data: unlockedRequirement })
  } catch (error) {
    console.error('Unlock requirement error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const updateRequirement = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, requirementId } = req.params
    const {
      requirementId: newRequirementId,
      title,
      description,
      parentId,
      priority,
      status,
      stage,
      owner,
      verificationMethod,
      acceptanceCriteria,
      source,
      category,
      relatedDocuments,
      tags,
      requirementType,
      requirementLevel,
      risk,
      complexity,
      rationale,
      assumptions,
      dependencies,
      conflicts,
      stakeholders,
      verificationStatus,
      verificationDate,
      verificationNotes,
      linkedMocCode,
      lifecycleId,
      statusId,
      componentId,
      thresholdValue,
      objectiveValue,
      customAttributes,
      version: clientVersion,
      qualityOverrideReason,
    } = req.body

    // Find the requirement
    const requirement = await prisma.requirement.findFirst({
      where: {
        projectId,
        OR: [
          { id: requirementId },
          { requirementId: requirementId },
        ],
      },
    })

    if (!requirement) {
      return res.status(404).json({
        success: false,
        error: 'Requirement not found',
      })
    }

    // Optimistic locking: if client supplies a version, it must match the stored version
    if (clientVersion !== undefined && clientVersion !== requirement.version) {
      return res.status(409).json({
        success: false,
        error: 'Requirement was modified by another user. Please refresh and try again.',
        currentVersion: requirement.version,
      })
    }

    // Check lock
    if (checkLock(requirement, req.userId)) {
      return res.status(423).json({
        success: false,
        error: 'Requirement is locked. Please unlock to edit.',
        lockedByUserId: requirement.lockedByUserId,
      })
    }

    // N-2.3 (#428): INCOSE/EARS write-time quality gate — runs ONLY when the
    // `description` is actually being changed. Editing any other field on a
    // pre-existing malformed requirement must never be blocked (Design item #1).
    const descriptionChanged =
      description !== undefined && description !== requirement.description
    let qualityReport: RequirementQualityReport | undefined
    if (descriptionChanged) {
      qualityReport = validateRequirementText(stripToPlainText(description))
      if (qualityReport.hasErrors && !isNonBlank(qualityOverrideReason)) {
        return res.status(422).json({
          success: false,
          error:
            'Requirement text has quality findings that must be resolved or overridden',
          qualityReport,
        })
      }
    }

    // Check for circular reference if parent is being changed
    if (parentId !== undefined && parentId !== requirement.parentId) {
      const hasCircularRef = await checkCircularReference(requirement.id, parentId)
      if (hasCircularRef) {
        return res.status(400).json({
          success: false,
          error: 'Cannot set parent: would create circular reference',
        })
      }

      // Validate parent if provided
      if (parentId) {
        const parent = await prisma.requirement.findFirst({
          where: {
            projectId,
            OR: [
              { id: parentId },
              { requirementId: parentId },
            ],
          },
        })

        if (!parent) {
          return res.status(400).json({
            success: false,
            error: 'Parent requirement not found',
          })
        }
      }
    }

    // Check if requirementType (classification) is being changed
    // Handle cases where requirement was unassigned (null/undefined) and is now being assigned
    const currentType = requirement.requirementType || null
    const newType = requirementType !== undefined ? (requirementType || null) : null
    const classificationChanged = requirementType !== undefined &&
      newType !== currentType

    // Determine the effective type for ID generation (use new type if provided, otherwise current)
    const effectiveType = requirementType !== undefined ? requirementType : requirement.requirementType
    const effectiveCategory = category !== undefined ? category : requirement.category

    console.log(`[Requirement ID Update] Debug - Current type: "${currentType}", New type: "${newType}", Classification changed: ${classificationChanged}, Current ID: "${requirement.requirementId}", New ID from request: "${newRequirementId}"`)

    // Determine the final requirement ID
    let finalRequirementId: string | undefined = undefined

    // Check if manual ID override was provided (explicitly set and different from current)
    // If newRequirementId is the same as current, it's just the frontend sending the current value, not an override
    const hasManualIdOverride = newRequirementId !== undefined &&
      newRequirementId !== null &&
      newRequirementId !== '' &&
      newRequirementId !== requirement.requirementId

    if (hasManualIdOverride) {
      // Manual ID override provided (different from current ID)
      finalRequirementId = newRequirementId
      console.log(`[Requirement ID Update] Manual ID override provided: ${finalRequirementId}`)
    }

    // Check if the final requirementId already exists (excluding current requirement)
    if (finalRequirementId && finalRequirementId !== requirement.requirementId) {
      const existingRequirement = await prisma.requirement.findFirst({
        where: {
          projectId,
          requirementId: finalRequirementId,
          NOT: {
            id: requirement.id, // Exclude the current requirement
          },
        },
      })

      if (existingRequirement) {
        return res.status(400).json({
          success: false,
          error: `Requirement ID "${finalRequirementId}" already exists in this project`,
        })
      }
    }

    let transitionChecklistSubmissionResults:
      | Array<{
          assignmentId: string
          responses: Array<{ checklistItemId: string; responseId: string }>
        }>
      | undefined

    // Build update data object, conditionally including requirementId only when it should be updated
    const updateData: any = {
      version: { increment: 1 },
      title,
      description,
      parentId: parentId !== undefined ? (parentId || null) : undefined,
      priority,
      status,
      stage,
      owner,
      verificationMethod,
      acceptanceCriteria,
      source,
      category,
      relatedDocuments,
      tags: tags !== undefined ? tags : undefined,
      requirementType: requirementType !== undefined ? requirementType : undefined,
      requirementLevel: requirementLevel !== undefined ? requirementLevel : undefined,
      risk: risk !== undefined ? risk : undefined,
      complexity: complexity !== undefined ? complexity : undefined,
      rationale: rationale !== undefined ? rationale : undefined,
      linkedMocCode: linkedMocCode !== undefined ? (linkedMocCode ? parseInt(linkedMocCode, 10) : null) : undefined,
      lifecycleId: lifecycleId !== undefined ? lifecycleId : undefined,
      statusId: statusId !== undefined ? statusId : undefined,
      componentId: componentId !== undefined ? (componentId || null) : undefined,
      thresholdValue: thresholdValue !== undefined ? thresholdValue : undefined,
      objectiveValue: objectiveValue !== undefined ? objectiveValue : undefined,
      customAttributes: customAttributes !== undefined ? customAttributes : undefined,
    }

    // When statusId changes: validate lifecycle gates, set statusChangedAt/statusChangedBy
    if (statusId !== undefined && statusId !== requirement.statusId) {
      const targetStatusName = req.body.status ?? (status as string) ?? ''
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { strictLifecycleGates: true },
      })
      const strictMode = project?.strictLifecycleGates ?? false
      const reqWithMoc = await prisma.requirement.findUnique({
        where: { id: requirement.id },
        include: { moc: true },
      })
      if (reqWithMoc && targetStatusName) {
        const gates = await requirementValidationService.checkLifecycleGates(
          { ...reqWithMoc, projectId } as any,
          targetStatusName,
          strictMode
        )
        if (!gates.passed && gates.blockers.length > 0) {
          return res.status(400).json({
            success: false,
            error: `Lifecycle gates not met: ${gates.blockers.join('; ')}`,
            gates: { warnings: gates.warnings, blockers: gates.blockers },
          })
        }
      }

      // Role-based transition rules (client sends allowed role IDs from lifecycle; empty = unrestricted)
      const allowedEngineeringRoleIdsRaw = req.body.allowedEngineeringRoleIds as unknown
      const allowedEngineeringRoleIds = Array.isArray(allowedEngineeringRoleIdsRaw)
        ? (allowedEngineeringRoleIdsRaw as string[]).filter((id) => typeof id === 'string' && id.length > 0)
        : []
      if (strictMode && allowedEngineeringRoleIds.length > 0) {
        if (!req.userId) {
          return res.status(401).json({ success: false, error: 'Unauthorized' })
        }
        const userEngRoles = await prisma.projectUserEngineeringRole.findMany({
          where: { projectId, userId: req.userId },
          select: { roleId: true },
        })
        const userRoleIdSet = new Set(userEngRoles.map((r) => r.roleId))
        const hasAllowedRole = allowedEngineeringRoleIds.some((id) => userRoleIdSet.has(id))
        if (!hasAllowedRole) {
          return res.status(403).json({
            success: false,
            error: 'You do not have an engineering role required for this transition',
          })
        }
      }

      // Transition checklist enforcement
      const resolvedLifecycleId = lifecycleId ?? requirement.lifecycleId
      if (resolvedLifecycleId && requirement.statusId) {
        const requiredChecklists = await transitionChecklistService.getChecklistsForTransition(
          projectId,
          resolvedLifecycleId,
          requirement.statusId,
          statusId,
          'Requirement'
        )

        if (requiredChecklists.length > 0) {
          const checklistCompletions = req.body.checklistCompletions as
            | { assignmentId: string; responses: { checklistItemId: string; value: Record<string, unknown>; passed: boolean }[]; overrideById?: string }[]
            | undefined

          if (!checklistCompletions || checklistCompletions.length === 0) {
            return res.status(400).json({
              success: false,
              error: 'Transition checklists must be completed before changing status',
              checklistsRequired: true,
              checklists: requiredChecklists,
            })
          }

          const requiredAssignmentIds = new Set(requiredChecklists.map((rc) => rc.assignmentId))
          const submittedAssignmentIds = new Set(checklistCompletions.map((c) => c.assignmentId))
          const missingAssignments = requiredChecklists.filter((rc) => !submittedAssignmentIds.has(rc.assignmentId))
          if (missingAssignments.length > 0) {
            return res.status(400).json({
              success: false,
              error: `Missing completions for ${missingAssignments.length} required checklist(s)`,
              checklistsRequired: true,
              checklists: requiredChecklists,
            })
          }

          for (const completion of checklistCompletions) {
            if (!requiredAssignmentIds.has(completion.assignmentId)) {
              return res.status(400).json({
                success: false,
                error: 'Unknown or invalid checklist assignment in submission',
                checklistsRequired: true,
                checklists: requiredChecklists,
              })
            }

            const allPassed = completion.responses.every((r) => r.passed)
            const isOverride = !!completion.overrideById
            if (!allPassed && !isOverride) {
              return res.status(400).json({
                success: false,
                error: 'Not all checklist items have passed. Complete all required items or use admin override.',
                checklistsRequired: true,
                checklists: requiredChecklists,
              })
            }

            try {
              const completed = await transitionChecklistService.submitCompletion({
                checklistAssignmentId: completion.assignmentId,
                entityType: 'Requirement',
                entityId: requirement.id,
                projectId,
                completedById: req.userId || '',
                overriddenById: completion.overrideById,
                responses: completion.responses,
              })
              if (!transitionChecklistSubmissionResults) transitionChecklistSubmissionResults = []
              transitionChecklistSubmissionResults.push({
                assignmentId: completion.assignmentId,
                responses: (completed?.responses ?? []).map((r) => ({
                  checklistItemId: r.checklistItemId,
                  responseId: r.id,
                })),
              })
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err)
              if (msg.startsWith('[ChecklistValidation]')) {
                return res.status(400).json({
                  success: false,
                  error: msg.replace('[ChecklistValidation]', '').trim(),
                  checklistsRequired: true,
                  checklists: requiredChecklists,
                })
              }
              throw err
            }
          }
        }
      }

      updateData.statusChangedAt = new Date()
      updateData.statusChangedBy = req.userId ?? null
    }

    // Only include requirementId in update if it was generated or manually provided
    if (finalRequirementId !== undefined) {
      updateData.requirementId = finalRequirementId
      console.log(`[Requirement ID Update] Updating requirement ID from "${requirement.requirementId}" to "${finalRequirementId}"`)

      // Update all references to the old requirementId across the system
      if (requirement.requirementId && finalRequirementId !== requirement.requirementId) {
        await updateRequirementIdReferences(
          projectId,
          requirement.requirementId,
          finalRequirementId,
          requirement.id
        )
      }
    }

    // Determine which meaningful fields are changing (depends only on request body)
    const changedFields: string[] = []
    if (title !== undefined) changedFields.push('title')
    if (description !== undefined) changedFields.push('description')
    if (acceptanceCriteria !== undefined) changedFields.push('acceptanceCriteria')
    if (verificationMethod !== undefined) changedFields.push('verificationMethod')
    if (parentId !== undefined) changedFields.push('parentId')
    if (requirementType !== undefined) changedFields.push('requirementType')
    if (requirementLevel !== undefined) changedFields.push('requirementLevel')
    if (risk !== undefined) changedFields.push('risk')
    if (complexity !== undefined) changedFields.push('complexity')
    if (source !== undefined) changedFields.push('source')
    if (owner !== undefined) changedFields.push('owner')
    if (rationale !== undefined) changedFields.push('rationale')
    if (assumptions !== undefined) changedFields.push('assumptions')
    if (linkedMocCode !== undefined) changedFields.push('linkedMocCode')
    if (thresholdValue !== undefined) changedFields.push('thresholdValue')
    if (objectiveValue !== undefined) changedFields.push('objectiveValue')
    if (customAttributes !== undefined) changedFields.push('customAttributes')
    if (finalRequirementId !== undefined && finalRequirementId !== requirement.requirementId) {
      changedFields.push('requirementId')
    }

    // Atomic core: snapshot + update + trace-link suspect-marking in one transaction
    // so a mid-flight crash cannot leave a version snapshot for a change that never
    // committed, and cannot leave traceability state inconsistent (#23).
    const updatedRequirement = await prisma.$transaction(async (tx) => {
      // Capture the pre-update state inside the transaction so the snapshot is only
      // written if the update itself succeeds (#23 fix — was previously outside the tx).
      await createVersionSnapshot(
        requirement.id,
        projectId,
        req.userId,
        undefined,
        'Updated via API',
        tx
      )

      // isLocked: false enforces the lock at the DB level — if a concurrent request
      // locked the requirement between our fetch and this write, Prisma throws P2025
      // instead of silently overwriting the locked record (#34).
      const updated = await tx.requirement.update({
        where: { id: requirement.id, isLocked: false },
        data: updateData,
        include: {
          parent: {
            select: {
              id: true,
              requirementId: true,
              title: true,
            },
          },
          children: {
            select: {
              id: true,
              requirementId: true,
              title: true,
            },
          },
          moc: true,
        },
      })

      if (changedFields.length > 0) {
        // Mark all requirement-to-requirement trace links suspect
        await tx.traceLink.updateMany({
          where: {
            projectId,
            OR: [
              { sourceId: requirement.id, sourceType: 'requirement' },
              { targetId: requirement.id, targetType: 'requirement' },
            ],
          },
          data: { isSuspect: true },
        })

        // DO-178C Impact Analysis: mark linked VerTestCases suspect
        const testCaseLinks = await tx.traceLink.findMany({
          where: {
            projectId,
            targetId: requirement.id,
            targetType: 'requirement',
            sourceType: 'test_case',
          },
          select: { sourceId: true },
        })
        if (testCaseLinks.length > 0) {
          await tx.verTestCase.updateMany({
            where: { id: { in: testCaseLinks.map(l => l.sourceId) }, projectId },
            data: { isSuspect: true, invalidatedAt: new Date() },
          })
        }
      }

      return updated
    })

    await syncRequirementParameterLinks(
      projectId,
      requirement.id,
      updatedRequirement.title ?? '',
      updatedRequirement.description ?? '',
      req.userId
    )

    if (changedFields.length > 0) {
      await traceabilityService.markLinksSuspectByMeaningfulChange(
        projectId,
        requirement.id,
        changedFields
      )
    }

    await linkageAuditService.log({
      projectId,
      entityType: 'REQUIREMENT',
      entityId: requirement.id,
      action: 'REQUIREMENT_UPDATED',
      oldValue: requirement,
      newValue: updatedRequirement,
      performedByUserId: req.userId,
    })

    if (statusId !== undefined && statusId !== requirement.statusId) {
      await linkageAuditService.log({
        projectId,
        entityType: 'REQUIREMENT',
        entityId: requirement.id,
        action: 'REQUIREMENT_STATUS_CHANGED',
        oldValue: { status: requirement.status, statusId: requirement.statusId },
        newValue: { status: updatedRequirement.status, statusId: updatedRequirement.statusId },
        performedByUserId: req.userId,
      })
    }

    const changes = buildRequirementChangeSummary(requirement, updatedRequirement as any)
    // Fire-and-forget: notification failure must not cause the update endpoint to return 500
    notifyRequirementSubscribers({
      projectId,
      requirementId: requirement.id,
      actorUserId: req.userId,
      changes,
      requirementSnapshot: {
        id: updatedRequirement.id,
        requirementId: updatedRequirement.requirementId,
        title: updatedRequirement.title,
      },
    }).catch(err => console.error('[updateRequirement] Notification failed (non-fatal):', err))

    // N-2.3 (#428): record the quality-override when the description change
    // was saved past `error`-severity findings.
    if (qualityReport?.hasErrors && isNonBlank(qualityOverrideReason)) {
      await logQualityOverride(projectId, req.userId, {
        requirementId: updatedRequirement.id,
        requirementKey: updatedRequirement.requirementId,
        mode: 'update',
        overrideReason: qualityOverrideReason.trim(),
        score: qualityReport.score,
        earsPattern: qualityReport.earsPattern,
        findingRuleIds: qualityReport.findings
          .filter((f) => f.severity === 'error')
          .map((f) => f.ruleId),
      })
    }

    res.json({
      success: true,
      data: updatedRequirement,
      ...(qualityReport ? { qualityReport } : {}),
      ...(transitionChecklistSubmissionResults?.length
        ? { transitionChecklistSubmissionResults }
        : {}),
    })
  } catch (error: any) {
    console.error('Update requirement error:', error)

    // P2025 = Prisma record-not-found. Re-query to distinguish two cases (#34):
    //   locked between fetch and write → 409 Conflict
    //   deleted between fetch and write → 404 Not Found
    // Guard on modelName to avoid misidentifying a nested-write P2025 as a lock failure.
    if (error?.code === 'P2025' && (!error?.meta?.modelName || error?.meta?.modelName === 'Requirement')) {
      const { projectId, requirementId } = req.params
      const check = await prisma.requirement.findFirst({
        where: { projectId, OR: [{ id: requirementId }, { requirementId }] },
        select: { isLocked: true },
      }).catch(() => null)
      if (check?.isLocked) {
        return res.status(409).json({ success: false, error: 'Requirement was locked by a concurrent request. Please refresh and try again.' })
      }
      return res.status(404).json({ success: false, error: 'Requirement not found' })
    }

    let errorMessage = 'Internal server error'
    if (error?.message) {
      errorMessage = error.message
      if (error.message.includes('Unique constraint')) {
        errorMessage = 'Requirement ID already exists'
      }
    }

    res.status(500).json({
      success: false,
      error: errorMessage,
    })
  }
}

export const deleteRequirement = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, requirementId } = req.params

    const requirement = await prisma.requirement.findFirst({
      where: {
        projectId,
        OR: [
          { id: requirementId },
          { requirementId: requirementId },
        ],
      },
      include: {
        children: {
          select: { id: true },
        },
      },
    })

    if (!requirement) {
      return res.status(404).json({
        success: false,
        error: 'Requirement not found',
      })
    }

    // Check lock
    if (checkLock(requirement, req.userId)) {
      return res.status(423).json({
        success: false,
        error: 'Requirement is locked. Please unlock to edit.',
        lockedByUserId: requirement.lockedByUserId,
      })
    }

    // Check if requirement has children (must not allow soft delete if children exist, or handle cascading?
    // Current rule from analysis: "This requirement has child requirements that must be deleted or reassigned first."
    // We maintain this strict check for now to avoid orphaned children in active view.

    // Handle children based on user selection
    if (requirement.children.length > 0) {
      const childrenToDelete = req.body.childrenToDelete || [] // IDs of children to delete

      // 1. Soft delete selected children — skip any that are locked (#34)
      if (childrenToDelete.length > 0) {
        await prisma.requirement.updateMany({
          where: {
            id: { in: childrenToDelete },
            parentId: requirement.id,
            isLocked: false,
          },
          data: {
            deletedAt: new Date(),
            deletedById: req.userId,
            deleteReason: 'Cascade delete from parent',
          }
        })
      }

      // 2. Reparent remaining children (parentId = null)
      // These are children that exist but were NOT selected for deletion
      await prisma.requirement.updateMany({
        where: {
          parentId: requirement.id,
          id: { notIn: childrenToDelete } // Ensure we don't reparent what we just deleted (though deleted ones still have parentId, so maybe safer to do this first or explicitly?)
          // UpdateMany ignores soft-deleted if we don't filter them? No, prisma updates all.
          // Safe approach: Reparent everything NOT in the delete list.
        },
        data: {
          parentId: null
        }
      })
    }

    // 3. Process Linked Items atomically — collect IDs by type, then run a single
    //    $transaction so either all deletes succeed or none do (#31).
    const { linkedItemsToDelete } = req.body

    // Pre-fetch CR attachments outside the transaction (needed for filesystem cleanup)
    const crAttachmentFiles: string[] = []

    if (linkedItemsToDelete && Array.isArray(linkedItemsToDelete) && linkedItemsToDelete.length > 0) {
      console.log(`[Delete Requirement] Processing ${linkedItemsToDelete.length} linked items for deletion`)

      const issueIds: string[] = []
      const crIds: string[] = []
      const functionIds: string[] = []
      const linkedReqIds: string[] = []
      const testCaseIds: string[] = []
      const pbsIds: string[] = []

      for (const item of linkedItemsToDelete) {
        if (item.type === 'issue') issueIds.push(item.id)
        else if (item.type === 'change_request') crIds.push(item.id)
        else if (item.type === 'function') functionIds.push(item.id)
        else if (item.type === 'requirement' || item.type === 'hazard' || item.type === 'risk') linkedReqIds.push(item.id)
        else if (item.type === 'test_case') testCaseIds.push(item.id)
        else if (item.type === 'pbs_component') pbsIds.push(item.id)
      }

      // Pre-fetch CR attachment file paths (best-effort — failure must not abort the delete)
      if (crIds.length > 0) {
        try {
          const crs = await prisma.changeRequest.findMany({
            where: { id: { in: crIds }, projectId },
            include: { attachments: true },
          })
          const uploadsDir = path.join(__dirname, '../../uploads/change-requests')
          for (const cr of crs) {
            for (const att of cr.attachments) {
              if (att.fileUrl && !att.fileUrl.startsWith('data:')) {
                crAttachmentFiles.push(path.join(uploadsDir, path.basename(att.fileUrl)))
              }
            }
          }
        } catch (prefetchErr) {
          console.error('[Delete Requirement] Failed to pre-fetch CR attachments; filesystem cleanup will be skipped:', prefetchErr)
        }
      }

      // Execute all DB deletes atomically — if any step throws, all are rolled back.
      // projectId is included in every where clause to prevent cross-project deletion (#31 security).
      await prisma.$transaction(async (tx) => {
        if (issueIds.length > 0) await tx.issue.deleteMany({ where: { id: { in: issueIds }, projectId } })
        if (crIds.length > 0) await tx.changeRequest.deleteMany({ where: { id: { in: crIds }, projectId } })
        if (functionIds.length > 0) await tx.systemFunction.deleteMany({ where: { id: { in: functionIds }, projectId } })
        if (testCaseIds.length > 0) await tx.verTestCase.deleteMany({ where: { id: { in: testCaseIds }, projectId } })
        if (pbsIds.length > 0) await tx.component.deleteMany({ where: { id: { in: pbsIds }, projectId } })
        if (linkedReqIds.length > 0) {
          await tx.requirement.updateMany({
            where: { id: { in: linkedReqIds }, projectId },
            data: {
              deletedAt: new Date(),
              deletedById: req.userId,
              deleteReason: `Deleted as linked item of ${requirement.requirementId || requirement.title}`,
            },
          })
        }
      })

      // Remove CR attachment files from filesystem (best-effort, after DB transaction committed)
      for (const filePath of crAttachmentFiles) {
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath) } catch (e) { console.error('Failed to unlink CR attachment:', e) }
        }
      }
    }

    // Soft delete the requirement — isLocked: false enforces the lock at DB level (#34)
    const softDeletedAt = new Date()
    const softDeleteReason = req.body.reason || null
    const deletedRequirement = await prisma.requirement.update({
      where: { id: requirement.id, isLocked: false },
      data: {
        deletedAt: softDeletedAt,
        deletedById: req.userId,
        deleteReason: softDeleteReason,
      },
    })

    // Log children actions if any
    if (requirement.children.length > 0) {
      // We can log this but for now main log is enough
    }

    await linkageAuditService.log({
      projectId,
      entityType: 'REQUIREMENT',
      entityId: requirement.id,
      action: 'REQUIREMENT_DELETED_SOFT' as any,
      oldValue: { status: requirement.status },
      newValue: { deletedAt: deletedRequirement.deletedAt, reason: deletedRequirement.deleteReason },
      performedByUserId: req.userId,
    })

    notifyRequirementSubscribers({
      projectId,
      requirementId: requirement.id,
      actorUserId: req.userId,
      changes: ['Requirement moved to trash'],
      action: 'deleted',
      requirementSnapshot: {
        id: requirement.id,
        requirementId: requirement.requirementId,
        title: requirement.title,
      },
    }).catch(console.error)

    res.json({
      success: true,
      message: 'Requirement moved to trash successfully',
    })
  } catch (error: any) {
    console.error('Delete requirement error:', error)
    if (error?.code === 'P2025' && (!error?.meta?.modelName || error?.meta?.modelName === 'Requirement')) {
      const { projectId, requirementId } = req.params
      const check = await prisma.requirement.findFirst({
        where: { projectId, OR: [{ id: requirementId }, { requirementId }] },
        select: { isLocked: true },
      }).catch(() => null)
      if (check?.isLocked) {
        return res.status(409).json({ success: false, error: 'Requirement was locked by a concurrent request. Please refresh and try again.' })
      }
      return res.status(404).json({ success: false, error: 'Requirement not found' })
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const restoreRequirement = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, requirementId } = req.params

    const requirement = await prisma.requirement.findFirst({
      where: {
        projectId,
        OR: [
          { id: requirementId },
          { requirementId: requirementId },
        ],
      },
    })

    if (!requirement) {
      return res.status(404).json({
        success: false,
        error: 'Requirement not found',
      })
    }

    if (!requirement.deletedAt) {
      return res.status(400).json({
        success: false,
        error: 'Requirement is not deleted',
      })
    }

    // Restore the requirement
    const restoredRequirement = await prisma.requirement.update({
      where: { id: requirement.id },
      data: {
        deletedAt: null,
        deletedById: null,
        deleteReason: null,
        restoredAt: new Date(),
        restoredById: req.userId,
      },
    })

    await linkageAuditService.log({
      projectId,
      entityType: 'REQUIREMENT',
      entityId: requirement.id,
      action: 'REQUIREMENT_RESTORED',
      performedByUserId: req.userId,
    })

    res.json({
      success: true,
      message: 'Requirement restored successfully',
      data: restoredRequirement,
    })
  } catch (error) {
    console.error('Restore requirement error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const permanentDeleteRequirement = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, requirementId } = req.params

    const requirement = await prisma.requirement.findFirst({
      where: {
        projectId,
        OR: [
          { id: requirementId },
          { requirementId: requirementId },
        ],
      },
      include: {
        children: { select: { id: true } },
      },
    })

    if (!requirement) {
      return res.status(404).json({
        success: false,
        error: 'Requirement not found',
      })
    }

    // Ensure it is already soft deleted?
    // Requirement says: "Permanent delete requires explicit confirmation"
    // Usually we allow perm delete from Trash (so it must be soft deleted first), OR explicitly from active if rights allow.
    // Use case implies this action comes from Archive page, so likely soft deleted. But let's act on the ID regardless.

    // Constraint: Check children again (just in case)
    if (requirement.children.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot permanently delete: has ${requirement.children.length} children.`,
      })
    }

    // Check functions links - strict Referential Integrity might fail or cascade, but let's check manually to be safe/friendly
    const linkedFunctions = await prisma.systemFunction.findMany({
      where: { projectId, sourceReqId: requirement.id }
    })
    if (linkedFunctions.length > 0) {
      // Decide: Block or unlink?
      // Requirement says: "Permanent delete... item removed".
      // If DB has constraints, it will fail. Let's block to be safe.
      return res.status(400).json({
        success: false,
        error: `Cannot permanently delete: linked to ${linkedFunctions.length} function(s).`,
      })
    }

    const snapshot = JSON.stringify(requirement)

    await prisma.requirement.delete({
      where: { id: requirement.id },
    })

    // Log to permanent audit
    await linkageAuditService.log({
      projectId,
      entityType: 'REQUIREMENT',
      entityId: requirement.id,
      action: 'REQUIREMENT_PERMANENTLY_DELETED',
      oldValue: { snapshot },
      performedByUserId: req.userId,
    })

    res.json({
      success: true,
      message: 'Requirement permanently deleted',
    })
  } catch (error) {
    console.error('Permanent delete error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const getRecentlyDeletedRequirements = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { deletedBy, from, to } = req.query

    const whereClause: any = {
      projectId,
      deletedAt: { not: null },
    }

    if (deletedBy) {
      whereClause.deletedById = String(deletedBy)
    }

    if (from || to) {
      whereClause.deletedAt = {}
      if (from) whereClause.deletedAt.gte = new Date(String(from))
      if (to) whereClause.deletedAt.lte = new Date(String(to))
    }

    const deletedRequirements = await prisma.requirement.findMany({
      where: whereClause,
      orderBy: { deletedAt: 'desc' },
      include: {
        component: { select: { id: true, name: true } },
      },
    })

    // Fetch user details for deletedBy users
    const userIds = [...new Set(deletedRequirements.map(req => req.deletedById).filter(Boolean))] as string[]
    const users = userIds.length > 0 ? await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true, avatarUrl: true },
    }) : []

    const userMap = new Map(users.map(user => [user.id, user]))

    // Map to include calculated "daysLeft" and user details
    const result = deletedRequirements.map(req => {
      const deletedAt = new Date(req.deletedAt!)
      const expiresAt = new Date(deletedAt.getTime() + 7 * 24 * 60 * 60 * 1000) // +7 days
      const now = new Date()
      const msLeft = expiresAt.getTime() - now.getTime()
      const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24))

      return {
        ...req,
        daysLeft: daysLeft > 0 ? daysLeft : 0,
        deletedByUser: req.deletedById ? userMap.get(req.deletedById) || null : null,
      }
    })

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('Get recently deleted error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const createRequirementComment = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, requirementId } = req.params
    const { content } = req.body

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Comment content is required',
      })
    }

    const requirement = await prisma.requirement.findFirst({
      where: {
        projectId,
        OR: [
          { id: requirementId },
          { requirementId: requirementId },
        ],
      },
    })

    if (!requirement) {
      return res.status(404).json({
        success: false,
        error: 'Requirement not found',
      })
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
    })

    const comment = await prisma.requirementComment.create({
      data: {
        requirementId: requirement.id,
        projectId,
        content: content.trim(),
        authorId: req.userId,
        authorName: user?.name || 'Unknown',
      },
    })

    await linkageAuditService.log({
      projectId,
      entityType: 'REQUIREMENT',
      entityId: requirement.id,
      action: 'REQUIREMENT_COMMENT_ADDED',
      newValue: {
        commentId: comment.id,
        preview: truncatePlainText(htmlToPlainText(comment.content), 200),
      },
      performedByUserId: req.userId,
    })

    res.status(201).json({
      success: true,
      data: comment,
    })
  } catch (error) {
    console.error('Create requirement comment error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const deleteRequirementComment = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, commentId } = req.params

    const comment = await prisma.requirementComment.findFirst({
      where: {
        id: commentId,
        projectId,
      },
    })

    if (!comment) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found',
      })
    }

    // Only the comment author or an admin may delete
    if (comment.authorId && comment.authorId !== req.userId) {
      const actor = await prisma.user.findUnique({
        where: { id: req.userId! },
        select: { role: true },
      })
      const isAdmin = actor?.role === 'SUPERIOR_ADMIN' || actor?.role === 'COMPANY_ADMIN'
      if (!isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'You can only delete your own comments',
        })
      }
    }

    await linkageAuditService.log({
      projectId,
      entityType: 'REQUIREMENT',
      entityId: comment.requirementId,
      action: 'REQUIREMENT_COMMENT_DELETED',
      oldValue: {
        commentId: comment.id,
        preview: truncatePlainText(htmlToPlainText(comment.content), 200),
      },
      performedByUserId: req.userId,
    })

    await prisma.requirementComment.delete({
      where: { id: commentId },
    })

    res.json({
      success: true,
      message: 'Comment deleted successfully',
    })
  } catch (error) {
    console.error('Delete requirement comment error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const updateRequirementParent = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, requirementId } = req.params
    const { newParentId } = req.body

    const requirement = await prisma.requirement.findFirst({
      where: {
        projectId,
        OR: [
          { id: requirementId },
          { requirementId: requirementId },
        ],
      },
    })

    if (!requirement) {
      return res.status(404).json({
        success: false,
        error: 'Requirement not found',
      })
    }

    // Check lock
    if (checkLock(requirement, req.userId)) {
      return res.status(423).json({
        success: false,
        error: 'Requirement is locked. Please unlock to edit.',
        lockedByUserId: requirement.lockedByUserId,
      })
    }

    if (newParentId) {
      const hasCircularRef = await checkCircularReference(requirement.id, newParentId)
      if (hasCircularRef) {
        return res.status(400).json({
          success: false,
          error: 'Cannot set parent: would create circular reference',
        })
      }

      const parent = await prisma.requirement.findFirst({
        where: {
          projectId,
          OR: [
            { id: newParentId },
            { requirementId: newParentId },
          ],
        },
      })

      if (!parent) {
        return res.status(400).json({
          success: false,
          error: 'Parent requirement not found',
        })
      }
    }

    const updatedRequirement = await prisma.requirement.update({
      where: { id: requirement.id, isLocked: false },
      data: {
        parentId: newParentId || null,
      },
      include: {
        parent: {
          select: {
            id: true,
            requirementId: true,
            title: true,
          },
        },
        children: {
          select: {
            id: true,
            requirementId: true,
            title: true,
          },
        },
        moc: true,
      },
    })

    const changes = buildRequirementChangeSummary(requirement, updatedRequirement as any)
    notifyRequirementSubscribers({
      projectId,
      requirementId: requirement.id,
      actorUserId: req.userId,
      changes,
      requirementSnapshot: {
        id: updatedRequirement.id,
        requirementId: updatedRequirement.requirementId,
        title: updatedRequirement.title,
      },
    }).catch(console.error)

    res.json({
      success: true,
      data: updatedRequirement,
    })
  } catch (error: any) {
    console.error('Update requirement parent error:', error)
    if (error?.code === 'P2025' && (!error?.meta?.modelName || error?.meta?.modelName === 'Requirement')) {
      const { projectId, requirementId } = req.params
      const check = await prisma.requirement.findFirst({
        where: { projectId, OR: [{ id: requirementId }, { requirementId }] },
        select: { isLocked: true },
      }).catch(() => null)
      if (check?.isLocked) {
        return res.status(409).json({ success: false, error: 'Requirement was locked by a concurrent request. Please refresh and try again.' })
      }
      return res.status(404).json({ success: false, error: 'Requirement not found' })
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const bulkUpdateRequirements = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { requirementIds, updates } = req.body

    if (!requirementIds || !Array.isArray(requirementIds) || requirementIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Requirement IDs are required',
      })
    }

    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Updates are required',
      })
    }

    const updateData: any = {}
    if (updates.status !== undefined) updateData.status = updates.status
    if (updates.priority !== undefined) updateData.priority = updates.priority
    if (updates.owner !== undefined) updateData.owner = updates.owner || null
    if (updates.category !== undefined) updateData.category = updates.category || null
    if (updates.tags !== undefined) updateData.tags = updates.tags || []

    const beforeRequirements = await prisma.requirement.findMany({
      where: {
        projectId,
        id: { in: requirementIds },
      },
    })

    // isLocked: false ensures locked requirements are silently skipped rather than overwritten (#34)
    const result = await prisma.requirement.updateMany({
      where: {
        projectId,
        id: {
          in: requirementIds,
        },
        isLocked: false,
      },
      data: updateData,
    })

    const afterRequirements = await prisma.requirement.findMany({
      where: {
        projectId,
        id: { in: requirementIds },
      },
    })

    const afterById = new Map(afterRequirements.map((req) => [req.id, req]))
    beforeRequirements.forEach((before) => {
      const after = afterById.get(before.id)
      if (!after) return
      const changes = buildRequirementChangeSummary(before, after)
      notifyRequirementSubscribers({
        projectId,
        requirementId: before.id,
        actorUserId: req.userId,
        changes,
        requirementSnapshot: {
          id: after.id,
          requirementId: after.requirementId,
          title: after.title,
        },
      }).catch(console.error)
    })

    const skippedDueToLock = beforeRequirements.filter(r => r.isLocked).length

    res.json({
      success: true,
      message: `Updated ${result.count} requirement(s)${skippedDueToLock > 0 ? `, ${skippedDueToLock} skipped (locked)` : ''}`,
      count: result.count,
      skippedDueToLock,
    })
  } catch (error) {
    console.error('Bulk update requirements error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const bulkImportRequirements = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { create, update } = req.body

    if (!create && !update) {
      return res.status(400).json({
        success: false,
        error: 'No requirements to import',
      })
    }

    const createRows: CreateRowInput[] = Array.isArray(create) ? create : []
    const updateRows: UpdateRowInput[] = Array.isArray(update) ? update : []

    // Audit: import started (project-wide)
    await linkageAuditService.log({
      projectId,
      entityType: 'PROJECT',
      entityId: projectId,
      action: 'REQUIREMENTS_IMPORT_STARTED',
      oldValue: null,
      newValue: {
        kind: 'bulk_import',
        createCount: createRows.length,
        updateCount: updateRows.length,
      },
      performedByUserId: req.userId,
    })

    const errors: RowError[] = []

    // ─── Phase 1: pre-fetch lookup state once, then validate every row ────────
    const allProjectReqs = await prisma.requirement.findMany({
      where: { projectId },
      select: { id: true, requirementId: true },
    })
    const existingRequirementIds = new Set(
      allProjectReqs.map((r) => (r.requirementId ?? '').toLowerCase()).filter(Boolean),
    )
    const existingRequirementUuids = new Set(allProjectReqs.map((r) => r.id))

    const updateIds = updateRows.map((r) => r.id).filter(Boolean)
    const existingUpdateRows = updateIds.length
      ? await prisma.requirement.findMany({ where: { projectId, id: { in: updateIds } } })
      : []
    const existingByUuid = new Map(existingUpdateRows.map((r) => [r.id, r]))

    const validCreates: ValidatedCreate[] = []
    const validUpdates: ValidatedUpdate[] = []

    const createCtx: CreateRowContext = {
      projectId,
      existingRequirementIds,
      existingRequirementUuids,
      generateRequirementId: () => generateRequirementId(projectId),
      checkCircularReference,
    }
    const updateCtx: UpdateRowContext = {
      projectId,
      existingByUuid,
      existingRequirementUuids,
      checkCircularReference,
    }

    for (let i = 0; i < createRows.length; i++) {
      const result = await validateCreateRow(createRows[i], i, createCtx)
      if ('valid' in result) {
        validCreates.push(result.valid)
        // Reserve the new id locally so a duplicate later in the same batch is caught.
        const newId = result.valid.data.requirementId as string
        if (newId) existingRequirementIds.add(newId.toLowerCase())
      } else {
        errors.push({ row: i, errors: result.invalid })
      }
    }
    for (let i = 0; i < updateRows.length; i++) {
      const result = await validateUpdateRow(updateRows[i], i, updateCtx)
      if ('valid' in result) {
        validUpdates.push(result.valid)
      } else {
        errors.push({ row: createRows.length + i, errors: result.invalid })
      }
    }

    let createdCount = 0
    let updatedCount = 0
    const skippedCount = errors.length

    // ─── Phase 2: commit every valid row in a single transaction (#226) ──────
    // Any DB-level failure (locked row P2025, unique-constraint collision, etc.)
    // throws here and rolls back the entire batch — no partial imports (#92).
    const updateNotifications: Array<() => void> = []
    if (validCreates.length || validUpdates.length) {
      await prisma.$transaction(async (tx) => {
        for (const c of validCreates) {
          await tx.requirement.create({ data: c.data as any })
          createdCount++
        }
        for (const u of validUpdates) {
          // Snapshot threaded with tx (#224) — rolls back with the parent batch.
          await createVersionSnapshot(
            u.existing.id,
            projectId,
            req.userId,
            undefined,
            'Updated via bulk import',
            tx,
          )
          // isLocked: false guard preserves #34 behaviour — locked rows abort the tx.
          const updatedRequirement = await tx.requirement.update({
            where: { id: u.existing.id, isLocked: false },
            data: u.data as any,
          })
          const changes = buildRequirementChangeSummary(u.existing, updatedRequirement as any)
          updateNotifications.push(() => {
            notifyRequirementSubscribers({
              projectId,
              requirementId: updatedRequirement.id,
              actorUserId: req.userId,
              changes,
              requirementSnapshot: {
                id: updatedRequirement.id,
                requirementId: updatedRequirement.requirementId,
                title: updatedRequirement.title,
              },
            }).catch(console.error)
          })
          updatedCount++
        }
      })
    }
    // Notifications fire only after commit — never publish state that rolled back.
    for (const fn of updateNotifications) fn()

    res.json({
      success: true,
      data: {
        created: createdCount,
        updated: updatedCount,
        skipped: skippedCount,
        errors,
      },
    })

    // Audit: import completed (project-wide)
    await linkageAuditService.log({
      projectId,
      entityType: 'PROJECT',
      entityId: projectId,
      action: 'REQUIREMENTS_IMPORT_COMPLETED',
      oldValue: null,
      newValue: {
        kind: 'bulk_import',
        created: createdCount,
        updated: updatedCount,
        skipped: skippedCount,
        errorCount: errors.length,
      },
      performedByUserId: req.userId,
    })
  } catch (error: any) {
    // P2025: a row was locked between phase 1 and the tx — surface as user error,
    // not 500. Treats #34 lock-respect behaviour as a precondition failure.
    const isLocked = error?.code === 'P2025'
    const errorMsg = isLocked
      ? 'A requirement was locked and the import was rolled back. No changes applied.'
      : (error?.message || 'Internal server error')
    console.error('Bulk import requirements error:', error)

    try {
      const { projectId } = req.params
      await linkageAuditService.log({
        projectId,
        entityType: 'PROJECT',
        entityId: projectId,
        action: 'REQUIREMENTS_IMPORT_FAILED',
        oldValue: null,
        newValue: { kind: 'bulk_import', error: errorMsg },
        performedByUserId: req.userId,
      })
    } catch {
      // ignore audit failures
    }

    res.status(500).json({
      success: false,
      error: errorMsg,
    })
  }
}

// Migration endpoint to migrate existing category values to requirementType
export const migrateCategoryToRequirementType = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params

    // Find all requirements with category but no requirementType
    const requirementsToMigrate = await prisma.requirement.findMany({
      where: {
        projectId,
        category: { not: null },
        requirementType: null,
      },
    })

    let migratedCount = 0

    // Migrate each requirement
    for (const requirement of requirementsToMigrate) {
      if (requirement.category) {
        await prisma.requirement.update({
          where: { id: requirement.id },
          data: {
            requirementType: requirement.category,
            category: null, // Clear category after migration
          },
        })
        migratedCount++
      }
    }

    return res.json({
      success: true,
      message: `Successfully migrated ${migratedCount} requirements from category to requirementType`,
      migratedCount,
    })
  } catch (error: any) {
    console.error('Error migrating category to requirementType:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to migrate category to requirementType',
      details: error.message,
    })
  }
}

// Get custom requirement types for a project
export const getCustomRequirementTypes = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params

    const customTypes = await prisma.customRequirementType.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })

    res.json({
      success: true,
      data: customTypes,
    })
  } catch (error: any) {
    console.error('Error getting custom requirement types:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    })
  }
}

// Add a custom requirement type
export const addCustomRequirementType = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { typeName } = req.body

    if (!typeName || typeof typeName !== 'string' || typeName.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'typeName is required and must be a non-empty string',
      })
    }

    const customType = await prisma.customRequirementType.create({
      data: {
        projectId,
        typeName: typeName.trim(),
      },
    })

    res.json({
      success: true,
      data: customType,
    })
  } catch (error: any) {
    console.error('Error adding custom requirement type:', error)
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        error: 'A custom requirement type with this name already exists for this project',
      })
    }
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    })
  }
}

// Delete a custom requirement type
export const deleteCustomRequirementType = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, typeId } = req.params

    await prisma.customRequirementType.delete({
      where: {
        id: typeId,
        projectId, // Ensure the type belongs to the project
      },
    })

    res.json({
      success: true,
      message: 'Custom requirement type deleted successfully',
    })
  } catch (error: any) {
    console.error('Error deleting custom requirement type:', error)
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Custom requirement type not found',
      })
    }
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    })
  }
}

/**
 * Update the component assignment for a requirement (drag-and-drop)
 */
export const updateRequirementComponent = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, requirementId } = req.params
    const { componentId } = req.body

    const requirement = await prisma.requirement.findFirst({
      where: {
        projectId,
        OR: [{ id: requirementId }, { requirementId: requirementId }],
      },
      include: {
        component: { select: { id: true, name: true } },
      },
    })

    if (!requirement) {
      return res.status(404).json({
        success: false,
        error: 'Requirement not found',
      })
    }

    // Check lock
    if (checkLock(requirement, req.userId)) {
      return res.status(423).json({
        success: false,
        error: 'Requirement is locked by another user',
        lockedByUserId: requirement.lockedByUserId,
      })
    }

    // If componentId is provided, verify it exists in the same project
    if (componentId) {
      const component = await prisma.component.findFirst({
        where: {
          id: componentId,
          projectId,
        },
      })

      if (!component) {
        return res.status(400).json({
          success: false,
          error: 'Component not found in this project',
        })
      }
    }

    try {
      await createVersionSnapshot(
        requirement.id,
        projectId,
        req.userId,
        undefined,
        'PBS component assignment'
      )
    } catch (versionError) {
      console.warn('Failed to create version snapshot (component):', versionError)
    }

    const updated = await prisma.requirement.update({
      where: { id: requirement.id, isLocked: false },
      data: {
        componentId: componentId || null,
      },
      include: {
        component: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Sync allocated_to trace link so Traceability Matrix and lifecycle gates stay consistent
    const existingAllocLinks = await prisma.traceLink.findMany({
      where: {
        projectId,
        sourceType: 'requirement',
        sourceId: requirement.id,
        targetType: 'pbs_component',
        linkType: 'allocated_to',
      },
    })
    for (const link of existingAllocLinks) {
      await traceabilityService.deleteTraceLink(projectId, link.id, req.userId)
    }
    if (componentId) {
      await traceabilityService.createTraceLink(
        projectId,
        'requirement',
        requirement.id,
        'pbs_component',
        componentId,
        'allocated_to',
        undefined,
        'Auto-linked from PBS component assignment',
        req.userId
      )
    }

    await linkageAuditService.log({
      projectId,
      entityType: 'REQUIREMENT',
      entityId: requirement.id,
      action: 'REQUIREMENT_COMPONENT_CHANGED',
      oldValue: {
        componentId: requirement.componentId,
        componentName: requirement.component?.name ?? null,
      },
      newValue: {
        componentId: updated.componentId,
        componentName: updated.component?.name ?? null,
      },
      performedByUserId: req.userId,
    })

    const changes = buildRequirementChangeSummary(requirement, updated as any)
    notifyRequirementSubscribers({
      projectId,
      requirementId: requirement.id,
      actorUserId: req.userId,
      changes,
      requirementSnapshot: {
        id: updated.id,
        requirementId: updated.requirementId,
        title: updated.title,
      },
    }).catch(console.error)

    res.json({
      success: true,
      data: updated,
    })
  } catch (error: any) {
    console.error('Update requirement component error:', error)
    if (error?.code === 'P2025' && (!error?.meta?.modelName || error?.meta?.modelName === 'Requirement')) {
      const { projectId, requirementId } = req.params
      const check = await prisma.requirement.findFirst({
        where: { projectId, OR: [{ id: requirementId }, { requirementId }] },
        select: { isLocked: true },
      }).catch(() => null)
      if (check?.isLocked) {
        return res.status(409).json({ success: false, error: 'Requirement was locked by a concurrent request. Please refresh and try again.' })
      }
      return res.status(404).json({ success: false, error: 'Requirement not found' })
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

/**
 * GET /projects/:projectId/requirements/dashboard
 * Returns aggregate metrics for the RM dashboard: counts by review/verification status,
 * coverage (requirements linked to test cases), suspect links count, baselines.
 */
export const getRequirementsDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    if (!projectId) {
      return res.status(400).json({ success: false, error: 'Project ID is required' })
    }

    const baseWhere = { projectId, deletedAt: null }

    // #94: replace the in-memory trace-link scan with a single SQL aggregate.
    // The previous implementation loaded every TraceLink row into Node heap
    // to derive requirementIdsWithTestLink — unbounded by project size and
    // guaranteed to OOM on large certification projects.
    // `test_case` / `testcase` variants are both accepted because historic
    // rows used either spelling; the normalisation is applied inside SQL
    // so we do not need a post-query filter step.
    //
    // Suspect-link count is likewise replaced with a COUNT query — the
    // dashboard only used .length on the original array.
    const [
      totalRequirements,
      reviewStatusGroups,
      verificationStatusGroups,
      baselineCount,
      recentBaselines,
      coverageRows,
      suspectCountRows,
    ] = await Promise.all([
      prisma.requirement.count({ where: baseWhere }),
      prisma.requirement.groupBy({
        by: ['reviewStatus'],
        where: baseWhere,
        _count: { id: true },
      }),
      prisma.requirement.groupBy({
        by: ['verificationStatus'],
        where: baseWhere,
        _count: { id: true },
      }),
      prisma.baseline.count({ where: { projectId } }),
      prisma.baseline.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, createdAt: true, status: true },
      }),
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT
          CASE
            WHEN lower(replace(tl."sourceType", '-', '_')) = 'requirement'
             AND lower(replace(tl."targetType", '-', '_')) IN ('test_case', 'testcase')
              THEN tl."sourceId"
            WHEN lower(replace(tl."targetType", '-', '_')) = 'requirement'
             AND lower(replace(tl."sourceType", '-', '_')) IN ('test_case', 'testcase')
              THEN tl."targetId"
          END
        ) AS count
        FROM "TraceLink" tl
        WHERE tl."projectId" = ${projectId}
      `,
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM "TraceLink" tl
        WHERE tl."projectId" = ${projectId}
          AND tl."isSuspect" = TRUE
      `,
    ])

    const totalWithTestLink = Number(coverageRows[0]?.count ?? 0)
    const suspectLinksCount = Number(suspectCountRows[0]?.count ?? 0)
    const coveragePercent =
      totalRequirements > 0 ? Math.round((totalWithTestLink / totalRequirements) * 100) : 0

    const byReviewStatus: Record<string, number> = {}
    for (const g of reviewStatusGroups) {
      const key = g.reviewStatus ?? 'draft'
      byReviewStatus[key] = g._count.id
    }
    const byVerificationStatus: Record<string, number> = {}
    for (const g of verificationStatusGroups) {
      const key = g.verificationStatus ?? 'not_verified'
      byVerificationStatus[key] = g._count.id
    }

    res.json({
      success: true,
      data: {
        totalRequirements,
        byReviewStatus,
        byVerificationStatus,
        coveragePercent,
        coverageCount: totalWithTestLink,
        totalWithTestLink,
        suspectLinksCount,
        baselineCount,
        recentBaselines: recentBaselines.map((b) => ({
          id: b.id,
          name: b.name,
          createdAt: b.createdAt.toISOString(),
          status: b.status,
        })),
      },
    })
  } catch (error: any) {
    console.error('Get requirements dashboard error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

const MAX_REQIF_SIZE = 5 * 1024 * 1024 // 5MB

/**
 * POST /projects/:projectId/requirements/import/reqif
 * Body: JSON { content: string } (ReqIF XML string).
 * Parses ReqIF, creates requirements (skips duplicates by requirementId), creates TraceLinks for relations.
 * Returns { created, skipped, linksCreated, errors }.
 */
export const importReqif = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    if (!projectId) {
      return res.status(400).json({ success: false, error: 'Project ID is required' })
    }
    const body = req.body as { content?: string }
    const content = body?.content
    if (typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ success: false, error: 'Request body must include content (ReqIF XML string)' })
    }
    if (content.length > MAX_REQIF_SIZE) {
      return res.status(400).json({
        success: false,
      error: `File too large. Maximum size is ${MAX_REQIF_SIZE / 1024 / 1024}MB`,
      })
    }
    const { requirements: reqs, relations } = parseReqIF(content)
    let created = 0
    let skipped = 0
    const errors: Array<{ row?: number; message: string }> = []
    const identifierToId = new Map<string, string>()

    const existingByReqId = await prisma.requirement.findMany({
      where: { projectId, deletedAt: null },
      select: { id: true, requirementId: true },
    })
    const existingMap = new Map<string, string>()
    for (const r of existingByReqId) {
      if (r.requirementId) existingMap.set(r.requirementId, r.id)
    }

    for (let i = 0; i < reqs.length; i++) {
      const r = reqs[i]
      const identifier = (r.identifier || '').trim()
      const title = (r.title || r.identifier || 'Untitled').trim()
      const description = (r.description ?? '').trim() || ' '
      if (!identifier) {
        errors.push({ row: i + 1, message: 'Missing identifier' })
        continue
      }
      if (existingMap.has(identifier)) {
        identifierToId.set(identifier, existingMap.get(identifier)!)
        skipped++
        continue
      }
      try {
        const createdReq = await prisma.requirement.create({
          data: {
            projectId,
            requirementId: identifier,
            title,
            description,
            priority: 'medium',
            status: 'draft',
            stage: '',
          },
        })
        existingMap.set(identifier, createdReq.id)
        identifierToId.set(identifier, createdReq.id)
        created++
      } catch (err: any) {
        errors.push({ row: i + 1, message: err?.message || 'Failed to create requirement' })
      }
    }

    let linksCreated = 0
    for (const rel of relations) {
      const sourceId = identifierToId.get(rel.sourceRef) ?? existingMap.get(rel.sourceRef)
      const targetId = identifierToId.get(rel.targetRef) ?? existingMap.get(rel.targetRef)
      if (!sourceId || !targetId) continue
      try {
        await traceabilityService.createTraceLink(
          projectId,
          'requirement',
          sourceId,
          'requirement',
          targetId,
          rel.type || 'trace',
          undefined,
          'Imported from ReqIF',
          req.userId
        )
        linksCreated++
      } catch {
        // ignore duplicate or invalid link
      }
    }

    res.json({
      success: true,
      data: { created, skipped, linksCreated, errors },
    })
  } catch (error: any) {
    console.error('ReqIF import error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

function clampReminderStr(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value.slice(0, max)
}

/** POST …/lifecycle-transition-reminder — notify project members who hold required engineering roles for a gated transition. */
export const sendLifecycleTransitionReminder = async (req: AuthRequest, res: Response) => {
  try {
    const actorId = req.userId
    if (!actorId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }
    const { projectId, requirementId } = req.params
    const body = req.body as {
      toStatusId?: string
      allowedEngineeringRoleIds?: string[]
      fromStatusName?: string
      toStatusName?: string
      note?: string
    }
    const toStatusId = typeof body.toStatusId === 'string' ? body.toStatusId.trim() : ''
    const roleIds = Array.isArray(body.allowedEngineeringRoleIds)
      ? [
          ...new Set(
            body.allowedEngineeringRoleIds.filter(
              (id): id is string => typeof id === 'string' && id.length > 0
            )
          ),
        ]
      : []
    if (!toStatusId || roleIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'toStatusId and a non-empty allowedEngineeringRoleIds array are required',
      })
    }

    const requirement = await prisma.requirement.findFirst({
      where: {
        projectId,
        deletedAt: null,
        OR: [{ id: requirementId }, { requirementId: requirementId }],
      },
      select: {
        id: true,
        title: true,
        requirementId: true,
        projectId: true,
      },
    })
    if (!requirement) {
      return res.status(404).json({ success: false, error: 'Requirement not found' })
    }

    const roles = await prisma.engineeringRole.findMany({
      where: { id: { in: roleIds } },
      select: { id: true, name: true },
    })
    const validRoleIds = roles.map((r) => r.id)
    if (validRoleIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid engineering roles for this reminder',
      })
    }

    const assignments = await prisma.projectUserEngineeringRole.findMany({
      where: { projectId, roleId: { in: validRoleIds } },
      select: { userId: true },
    })
    const recipientIds = [...new Set(assignments.map((a) => a.userId))].filter((id) => id !== actorId)

    const [actor, project] = await Promise.all([
      prisma.user.findUnique({ where: { id: actorId }, select: { name: true, email: true } }),
      prisma.project.findUnique({ where: { id: projectId }, select: { slug: true } }),
    ])
    const actorLabel = actor?.name?.trim() || actor?.email?.trim() || 'A teammate'
    const fromName = clampReminderStr(body.fromStatusName, 120) || 'current status'
    const toName = clampReminderStr(body.toStatusName, 120) || 'next status'
    const roleLabel =
      roles.length === 1
        ? roles[0].name
        : `${roles.length} roles: ${roles.map((r) => r.name).join(', ')}`
    const reqRef = requirement.requirementId || requirement.id.slice(0, 8)
    const titleShort = (requirement.title || 'Requirement').slice(0, 120)
    const titleTail = (requirement.title || '').length > 120 ? '…' : ''
    const note = clampReminderStr(body.note, 400)
    const openPath = project?.slug
      ? `/projects/${encodeURIComponent(project.slug)}/requirements?requirementId=${encodeURIComponent(requirement.id)}`
      : ''

    let message = `${actorLabel} asked you to help advance requirement ${reqRef} (${titleShort}${titleTail}) from "${fromName}" toward "${toName}". This transition is gated for: ${roleLabel}.`
    if (openPath) {
      message += ` Open: ${openPath}`
    }
    if (note) {
      message += ` Note: ${note}`
    }

    const title = 'Lifecycle transition reminder'

    if (recipientIds.length === 0) {
      return res.json({
        success: true,
        data: {
          notifiedCount: 0,
          message: 'No project members with those roles to notify (excluding yourself).',
        },
      })
    }

    await prisma.notification.createMany({
      data: recipientIds.map((uid) => ({
        userId: uid,
        type: 'lifecycle_transition_reminder',
        title,
        message,
        projectId,
        read: false,
      })),
    })

    res.json({ success: true, data: { notifiedCount: recipientIds.length } })
  } catch (error) {
    console.error('sendLifecycleTransitionReminder:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
