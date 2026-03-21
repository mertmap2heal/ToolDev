import { Response } from 'express'
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
import fs from 'fs'
import path from 'path'


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
async function generateRequirementId(
  projectId: string
): Promise<string> {
  // Always use the generic prefix 'REQ' regardless of type
  const prefix = 'REQ'

  // Find the highest number for this prefix
  // Fetch all requirements and filter in JavaScript since requirementId is nullable
  const allRequirements = await prisma.requirement.findMany({
    where: {
      projectId,
    },
    select: {
      requirementId: true,
    },
  })

  // Filter requirements that start with the prefix followed by dash and number
  // Format: "PREFIX-001", "PREFIX-002", etc.
  // Also handle old format without REQ- prefix for transition compatibility
  const existingRequirements = allRequirements.filter(
    (req) => {
      if (!req.requirementId) return false
      // Escape special regex characters in prefix
      const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      // Match new format: "REQ-FUNC-001" or old format: "FUNC-001" (for transition)
      // If prefix starts with "REQ-", also check for old format without "REQ-"
      let prefixPattern: RegExp
      if (prefix.startsWith('REQ-')) {
        // Extract the suffix after "REQ-" (e.g., "FUNC" from "REQ-FUNC")
        const suffix = prefix.substring(4) // Remove "REQ-"
        const escapedSuffix = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        // Match both new format (REQ-FUNC-001) and old format (FUNC-001)
        prefixPattern = new RegExp(`^(?:${escapedPrefix}|${escapedSuffix})-\\d+$`)
      } else {
        // For non-REQ prefixes (like just "REQ"), match exact format
        prefixPattern = new RegExp(`^${escapedPrefix}-\\d+$`)
      }
      return prefixPattern.test(req.requirementId)
    }
  )

  let maxNumber = 0
  for (const req of existingRequirements) {
    if (req.requirementId) {
      // Extract number after the dash (e.g., "FUNC-001" -> 1)
      const match = req.requirementId.match(/-(\d+)$/)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > maxNumber) {
          maxNumber = num
        }
      }
    }
  }

  const nextNumber = maxNumber + 1
  return `${prefix}-${nextNumber.toString().padStart(3, '0')}`
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
    res.json({ success: true, data: events })
  } catch (error) {
    console.error('Get audit events error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
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

    // Generate requirement ID if not provided
    // Uses requirementType (classification) as primary, category as fallback
    let finalRequirementId = providedRequirementId
    if (!finalRequirementId) {
      finalRequirementId = await generateRequirementId(projectId)
    }

    // Check if requirementId already exists in this project
    const existingRequirement = await prisma.requirement.findFirst({
      where: {
        projectId,
        requirementId: finalRequirementId,
      },
    })

    if (existingRequirement) {
      // Check if it's soft deleted
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

    const requirement = await prisma.requirement.create({
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
        parent: {
          select: {
            id: true,
            requirementId: true,
            title: true,
          },
        },
        moc: true,
      },
    })

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

    res.status(201).json({
      success: true,
      data: requirement,
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

    if (requirement.lockedByUserId !== userId) {
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

    // Check lock
    if (checkLock(requirement, req.userId)) {
      return res.status(423).json({
        success: false,
        error: 'Requirement is locked. Please unlock to edit.',
        lockedByUserId: requirement.lockedByUserId,
      })
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

    // Create version snapshot before updating (for version history)
    // Wrap in try-catch to prevent version creation from blocking updates
    try {
      await createVersionSnapshot(
        requirement.id,
        projectId,
        req.userId,
        undefined,
        'Updated via API'
      )
    } catch (versionError) {
      // Log but don't fail the update if version creation fails
      console.warn('Failed to create version snapshot:', versionError)
    }

    // Build update data object, conditionally including requirementId only when it should be updated
    const updateData: any = {
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

          for (const completion of checklistCompletions) {
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

            await transitionChecklistService.submitCompletion({
              checklistAssignmentId: completion.assignmentId,
              entityType: 'Requirement',
              entityId: requirement.id,
              projectId,
              completedById: req.userId || '',
              overriddenById: completion.overrideById,
              responses: completion.responses,
            })
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

    const updatedRequirement = await prisma.requirement.update({
      where: { id: requirement.id },
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

    // Mark downstream trace links as suspect when meaningful fields change
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
      // Also mark all requirement-to-requirement links (both directions) for full coverage
      await prisma.traceLink.updateMany({
        where: {
          projectId,
          OR: [
            { sourceId: requirement.id, sourceType: 'requirement' },
            { targetId: requirement.id, targetType: 'requirement' },
          ],
        },
        data: { isSuspect: true },
      })

      // DO-178C Impact Analysis - Mark linked VerTestCases as suspect
      const testCaseLinks = await prisma.traceLink.findMany({
        where: {
          projectId,
          targetId: requirement.id,
          targetType: 'requirement',
          sourceType: 'test_case'
        },
        select: { sourceId: true }
      })

      if (testCaseLinks.length > 0) {
        const testCaseIds = testCaseLinks.map(l => l.sourceId)
        await prisma.verTestCase.updateMany({
          where: { id: { in: testCaseIds }, projectId },
          data: {
            isSuspect: true,
            invalidatedAt: new Date()
          }
        })
      }
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
    await notifyRequirementSubscribers({
      projectId,
      requirementId: requirement.id,
      actorUserId: req.userId,
      changes,
      requirementSnapshot: {
        id: updatedRequirement.id,
        requirementId: updatedRequirement.requirementId,
        title: updatedRequirement.title,
      },
    })

    res.json({
      success: true,
      data: updatedRequirement,
    })
  } catch (error: any) {
    console.error('Update requirement error:', error)

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

      // 1. Soft delete selected children
      if (childrenToDelete.length > 0) {
        await prisma.requirement.updateMany({
          where: {
            id: { in: childrenToDelete },
            parentId: requirement.id
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

    // 3. Process Linked Items (Issues, Change Requests)
    // The frontend passes a list of items that the user explicitly selected for deletion.
    // We will hard delete them to match the behavior of their respective controllers.
    const { linkedItemsToDelete } = req.body

    if (linkedItemsToDelete && Array.isArray(linkedItemsToDelete) && linkedItemsToDelete.length > 0) {
      console.log(`[Delete Requirement] Processing ${linkedItemsToDelete.length} linked items for deletion`)

      for (const item of linkedItemsToDelete) {
        try {
          if (item.type === 'issue') {
            // Hard delete issue
            await prisma.issue.delete({ where: { id: item.id } }).catch(e => {
              console.error(`Failed to delete linked issue ${item.id}:`, e)
            })
          } else if (item.type === 'change_request') {
            // Find CR to delete attachments first
            const cr = await prisma.changeRequest.findUnique({
              where: { id: item.id },
              include: { attachments: true }
            })

            if (cr) {
              // Delete attachments from FS
              const uploadsDir = path.join(__dirname, '../../uploads/change-requests')
              for (const attachment of cr.attachments) {
                if (attachment.fileUrl && !attachment.fileUrl.startsWith('data:')) {
                  const filePath = path.join(uploadsDir, path.basename(attachment.fileUrl))
                  if (fs.existsSync(filePath)) {
                    try { fs.unlinkSync(filePath) } catch (e) { console.error('Failed to unlink file:', e) }
                  }
                }
              }

              // Hard delete CR
              await prisma.changeRequest.delete({ where: { id: item.id } }).catch(e => {
                console.error(`Failed to delete linked change request ${item.id}:`, e)
              })
            }
          } else if (item.type === 'function') {
            // Hard delete function
            await prisma.systemFunction.delete({ where: { id: item.id } }).catch(e => {
              console.error(`Failed to delete linked function ${item.id}:`, e)
            })
          } else if (item.type === 'requirement' || item.type === 'hazard' || item.type === 'risk') {
            // Soft delete linked requirement (or hazard/risk if they are requirements)
            await prisma.requirement.update({
              where: { id: item.id },
              data: {
                deletedAt: new Date(),
                deletedById: req.userId,
                deleteReason: `Deleted as linked item of ${requirement.requirementId || requirement.title}`,
              }
            }).catch(e => {
              console.error(`Failed to delete linked requirement/item ${item.id}:`, e)
            })
          } else if (item.type === 'test_case') {
            // Hard delete verification test case
            await prisma.verTestCase.delete({ where: { id: item.id } }).catch(e => {
              console.error(`Failed to delete linked test case ${item.id}:`, e)
            })
          } else if (item.type === 'pbs_component') {
            // Hard delete PBS component
            await prisma.component.delete({ where: { id: item.id } }).catch(e => {
              console.error(`Failed to delete linked PBS component ${item.id}:`, e)
            })
          }
        } catch (error) {
          console.error(`Error processing linked item deletion for ${item.type}:${item.id}`, error)
          // Continue processing other items even if one fails
        }
      }
    }

    // Soft delete the requirement
    const deletedRequirement = await prisma.requirement.update({
      where: { id: requirement.id },
      data: {
        deletedAt: new Date(),
        deletedById: req.userId,
        deleteReason: req.body.reason || null,
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

    await notifyRequirementSubscribers({
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
    })

    res.json({
      success: true,
      message: 'Requirement moved to trash successfully',
    })
  } catch (error) {
    console.error('Delete requirement error:', error)
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
      where: { id: requirement.id },
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
    await notifyRequirementSubscribers({
      projectId,
      requirementId: requirement.id,
      actorUserId: req.userId,
      changes,
      requirementSnapshot: {
        id: updatedRequirement.id,
        requirementId: updatedRequirement.requirementId,
        title: updatedRequirement.title,
      },
    })

    res.json({
      success: true,
      data: updatedRequirement,
    })
  } catch (error: any) {
    console.error('Update requirement parent error:', error)
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

    const result = await prisma.requirement.updateMany({
      where: {
        projectId,
        id: {
          in: requirementIds,
        },
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
    await Promise.all(
      beforeRequirements.map(async (before) => {
        const after = afterById.get(before.id)
        if (!after) return
        const changes = buildRequirementChangeSummary(before, after)
        await notifyRequirementSubscribers({
          projectId,
          requirementId: before.id,
          actorUserId: req.userId,
          changes,
          requirementSnapshot: {
            id: after.id,
            requirementId: after.requirementId,
            title: after.title,
          },
        })
      })
    )

    res.json({
      success: true,
      message: `Updated ${result.count} requirement(s)`,
      count: result.count,
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

    const errors: Array<{ row: number; errors: string[] }> = []
    let createdCount = 0
    let updatedCount = 0
    let skippedCount = 0

    // Process creates
    if (create && Array.isArray(create)) {
      for (let i = 0; i < create.length; i++) {
        const reqData = create[i]
        try {
          // Validate required fields
          if (!reqData.title || !reqData.description) {
            errors.push({
              row: i,
              errors: ['Title and description are required'],
            })
            skippedCount++
            continue
          }

          // Check for duplicate requirementId if provided
          if (reqData.requirementId) {
            const existing = await prisma.requirement.findFirst({
              where: {
                projectId,
                requirementId: reqData.requirementId,
              },
            })

            if (existing) {
              errors.push({
                row: i,
                errors: [`Requirement ID "${reqData.requirementId}" already exists`],
              })
              skippedCount++
              continue
            }
          }

          // Validate parent if provided
          if (reqData.parentId) {
            const parent = await prisma.requirement.findFirst({
              where: {
                projectId,
                id: reqData.parentId,
              },
            })

            if (!parent) {
              errors.push({
                row: i,
                errors: [`Parent requirement not found`],
              })
              skippedCount++
              continue
            }

            // Check for circular reference
            const hasCircular = await checkCircularReference(reqData.parentId, reqData.parentId)
            if (hasCircular) {
              errors.push({
                row: i,
                errors: ['Circular reference detected'],
              })
              skippedCount++
              continue
            }
          }

          // Generate requirementId if not provided
          // Uses requirementType (classification) as primary, category as fallback
          let requirementId = reqData.requirementId
          if (!requirementId) {
            requirementId = await generateRequirementId(projectId)
          }

          // Create requirement
          await prisma.requirement.create({
            data: {
              projectId,
              requirementId,
              title: reqData.title,
              description: reqData.description,
              priority: reqData.priority || 'medium',
              status: reqData.status || 'draft',
              stage: reqData.stage || '',
              owner: reqData.owner || null,
              category: reqData.category || null,
              source: reqData.source || null,
              verificationMethod: reqData.verificationMethod || null,
              acceptanceCriteria: reqData.acceptanceCriteria || null,
              tags: reqData.tags || [],
              parentId: reqData.parentId || null,
              requirementType: reqData.requirementType || null,
              requirementLevel: reqData.requirementLevel || null,
              risk: reqData.risk || null,
              complexity: reqData.complexity || null,
              rationale: reqData.rationale || null,
              assumptions: reqData.assumptions || null,
              dependencies: reqData.dependencies || [],
              conflicts: reqData.conflicts || [],
              stakeholders: reqData.stakeholders || [],
              verificationStatus: reqData.verificationStatus || null,
              verificationDate: reqData.verificationDate ? new Date(reqData.verificationDate) : null,
              verificationNotes: reqData.verificationNotes || null,
            },
          })

          createdCount++
        } catch (error: any) {
          console.error(`Error creating requirement at row ${i}:`, error)
          errors.push({
            row: i,
            errors: [error.message || 'Failed to create requirement'],
          })
          skippedCount++
        }
      }
    }

    // Process updates
    if (update && Array.isArray(update)) {
      for (let i = 0; i < update.length; i++) {
        const { id, data: updateData } = update[i]
        try {
          // Find existing requirement
          const existing = await prisma.requirement.findFirst({
            where: {
              projectId,
              id,
            },
          })

          if (!existing) {
            errors.push({
              row: create ? create.length + i : i,
              errors: ['Requirement not found'],
            })
            skippedCount++
            continue
          }

          // Validate parent if being changed
          if (updateData.parentId !== undefined && updateData.parentId !== existing.parentId) {
            if (updateData.parentId) {
              const parent = await prisma.requirement.findFirst({
                where: {
                  projectId,
                  id: updateData.parentId,
                },
              })

              if (!parent) {
                errors.push({
                  row: create ? create.length + i : i,
                  errors: ['Parent requirement not found'],
                })
                skippedCount++
                continue
              }

              // Check for circular reference
              const hasCircular = await checkCircularReference(existing.id, updateData.parentId)
              if (hasCircular) {
                errors.push({
                  row: create ? create.length + i : i,
                  errors: ['Circular reference detected'],
                })
                skippedCount++
                continue
              }
            }
          }

          // Create version snapshot before updating
          try {
            await createVersionSnapshot(
              existing.id,
              projectId,
              req.userId,
              undefined,
              'Updated via bulk import'
            )
          } catch (versionError) {
            console.warn('Failed to create version snapshot:', versionError)
          }

          // Update requirement
          const updatedRequirement = await prisma.requirement.update({
            where: { id: existing.id },
            data: {
              title: updateData.title !== undefined ? updateData.title : existing.title,
              description: updateData.description !== undefined ? updateData.description : existing.description,
              priority: updateData.priority !== undefined ? updateData.priority : existing.priority,
              status: updateData.status !== undefined ? updateData.status : existing.status,
              stage: updateData.stage !== undefined ? updateData.stage : existing.stage,
              owner: updateData.owner !== undefined ? (updateData.owner || null) : existing.owner,
              category: updateData.category !== undefined ? (updateData.category || null) : existing.category,
              source: updateData.source !== undefined ? (updateData.source || null) : existing.source,
              verificationMethod: updateData.verificationMethod !== undefined ? (updateData.verificationMethod || null) : existing.verificationMethod,
              acceptanceCriteria: updateData.acceptanceCriteria !== undefined ? (updateData.acceptanceCriteria || null) : existing.acceptanceCriteria,
              tags: updateData.tags !== undefined ? updateData.tags : existing.tags,
              parentId: updateData.parentId !== undefined ? (updateData.parentId || null) : existing.parentId,
              requirementType: updateData.requirementType !== undefined ? (updateData.requirementType || null) : existing.requirementType,
              requirementLevel: updateData.requirementLevel !== undefined ? (updateData.requirementLevel || null) : existing.requirementLevel,
              risk: updateData.risk !== undefined ? (updateData.risk || null) : existing.risk,
              complexity: updateData.complexity !== undefined ? (updateData.complexity || null) : existing.complexity,
              rationale: updateData.rationale !== undefined ? (updateData.rationale || null) : existing.rationale,
              assumptions: updateData.assumptions !== undefined ? (updateData.assumptions || null) : existing.assumptions,
              dependencies: updateData.dependencies !== undefined ? updateData.dependencies : existing.dependencies,
              conflicts: updateData.conflicts !== undefined ? updateData.conflicts : existing.conflicts,
              stakeholders: updateData.stakeholders !== undefined ? updateData.stakeholders : existing.stakeholders,
              verificationStatus: updateData.verificationStatus !== undefined ? (updateData.verificationStatus || null) : existing.verificationStatus,
              verificationDate: updateData.verificationDate !== undefined ? (updateData.verificationDate ? new Date(updateData.verificationDate) : null) : existing.verificationDate,
              verificationNotes: updateData.verificationNotes !== undefined ? (updateData.verificationNotes || null) : existing.verificationNotes,
            },
          })

          const changes = buildRequirementChangeSummary(existing, updatedRequirement as any)
          await notifyRequirementSubscribers({
            projectId,
            requirementId: updatedRequirement.id,
            actorUserId: req.userId,
            changes,
            requirementSnapshot: {
              id: updatedRequirement.id,
              requirementId: updatedRequirement.requirementId,
              title: updatedRequirement.title,
            },
          })

          updatedCount++
        } catch (error: any) {
          console.error(`Error updating requirement at row ${i}:`, error)
          errors.push({
            row: create ? create.length + i : i,
            errors: [error.message || 'Failed to update requirement'],
          })
          skippedCount++
        }
      }
    }

    res.json({
      success: true,
      data: {
        created: createdCount,
        updated: updatedCount,
        skipped: skippedCount,
        errors,
      },
    })
  } catch (error: any) {
    console.error('Bulk import requirements error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
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
        id: requirementId,
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

    const updated = await prisma.requirement.update({
      where: { id: requirementId },
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
        sourceId: requirementId,
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
        requirementId,
        'pbs_component',
        componentId,
        'allocated_to',
        undefined,
        'Auto-linked from PBS component assignment',
        req.userId
      )
    }

    const changes = buildRequirementChangeSummary(requirement, updated as any)
    await notifyRequirementSubscribers({
      projectId,
      requirementId: requirement.id,
      actorUserId: req.userId,
      changes,
      requirementSnapshot: {
        id: updated.id,
        requirementId: updated.requirementId,
        title: updated.title,
      },
    })

    res.json({
      success: true,
      data: updated,
    })
  } catch (error) {
    console.error('Update requirement component error:', error)
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

    const [
      totalRequirements,
      reviewStatusGroups,
      verificationStatusGroups,
      baselineCount,
      recentBaselines,
      allLinks,
      suspectLinks,
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
      traceabilityService.getTraceLinks(projectId),
      traceabilityService.getSuspectLinks(projectId),
    ])

    const normType = (t: string) => (t ?? '').toLowerCase().replace(/-/g, '_')
    const isTestCase = (t: string) => {
      const n = normType(t)
      return n === 'test_case' || n === 'testcase'
    }
    const requirementIdsWithTestLink = new Set<string>()
    for (const link of allLinks) {
      const st = (link as any).sourceType
      const tt = (link as any).targetType
      const sid = (link as any).sourceId
      const tid = (link as any).targetId
      if (st === 'requirement' && isTestCase(tt)) requirementIdsWithTestLink.add(sid)
      if (tt === 'requirement' && isTestCase(st)) requirementIdsWithTestLink.add(tid)
    }
    const totalWithTestLink = requirementIdsWithTestLink.size
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
        suspectLinksCount: suspectLinks.length,
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
