import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { PrismaClient } from '@prisma/client'
import { createVersionSnapshot } from './version.controller'
import { traceabilityService } from '../services/traceability.service'
import { linkageAuditService } from '../services/linkageAudit.service'
import { requirementValidationService } from '../services/requirementValidation.service'

const prisma = new PrismaClient()

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
]



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

    const parent = await prisma.requirement.findUnique({
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

    const requirements = await prisma.requirement.findMany({
      where: { projectId },
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
    console.error('Get requirements error:', error)
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

    await linkageAuditService.log({
      projectId,
      entityType: 'REQUIREMENT',
      entityId: requirement.id,
      action: 'REQUIREMENT_CREATED',
      newValue: { requirementId: requirement.requirementId, title: requirement.title },
      performedByUserId: req.user?.id,
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
        req.user?.id,
        req.user?.name,
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
      updateData.statusChangedAt = new Date()
      updateData.statusChangedBy = req.user?.id ?? null
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
    if (finalRequirementId !== undefined && finalRequirementId !== requirement.requirementId) {
      changedFields.push('requirementId')
    }

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
    }

    await linkageAuditService.log({
      projectId,
      entityType: 'REQUIREMENT',
      entityId: requirement.id,
      action: 'REQUIREMENT_UPDATED',
      oldValue: requirement,
      newValue: updatedRequirement,
      performedByUserId: req.user?.id,
    })

    if (statusId !== undefined && statusId !== requirement.statusId) {
      await linkageAuditService.log({
        projectId,
        entityType: 'REQUIREMENT',
        entityId: requirement.id,
        action: 'REQUIREMENT_STATUS_CHANGED',
        oldValue: { status: requirement.status, statusId: requirement.statusId },
        newValue: { status: updatedRequirement.status, statusId: updatedRequirement.statusId },
        performedByUserId: req.user?.id,
      })
    }

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

    // Check if requirement has children
    if (requirement.children.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete requirement: it has ${requirement.children.length} child requirement(s). Please delete or reassign children first.`,
      })
    }

    // Check if requirement is linked to functions
    const linkedFunctions = await prisma.systemFunction.findMany({
      where: {
        projectId,
        sourceReqId: requirement.id,
      },
    })

    if (linkedFunctions.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete requirement: it is linked to ${linkedFunctions.length} function(s). Please unlink functions first.`,
      })
    }

    // Delete the requirement
    await prisma.requirement.delete({
      where: { id: requirement.id },
    })

    res.json({
      success: true,
      message: 'Requirement deleted successfully',
    })
  } catch (error) {
    console.error('Delete requirement error:', error)
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

    const comment = await prisma.requirementComment.create({
      data: {
        requirementId: requirement.id,
        projectId,
        content: content.trim(),
        authorId: req.user?.id,
        authorName: req.user?.name,
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

    const result = await prisma.requirement.updateMany({
      where: {
        projectId,
        id: {
          in: requirementIds,
        },
      },
      data: updateData,
    })

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
              req.user?.id,
              req.user?.name,
              'Updated via bulk import'
            )
          } catch (versionError) {
            console.warn('Failed to create version snapshot:', versionError)
          }

          // Update requirement
          await prisma.requirement.update({
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
