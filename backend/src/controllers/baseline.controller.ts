import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma'
import { collectComponentIdAndDescendants } from '../utils/componentHelpers'


async function logBaselineAudit(
  projectId: string,
  userId: string | undefined,
  action: string,
  details: string
): Promise<void> {
  if (!userId) return
  try {
    await prisma.auditLog.create({
      data: { projectId, userId, action, details },
    })
  } catch (e) {
    console.warn('Baseline audit log failed:', e)
  }
}

/**
 * Get all baselines for a project
 */
export const getBaselines = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params

    const baselines = await prisma.baseline.findMany({
      where: { projectId },
      include: {
        _count: {
          select: { items: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const formattedBaselines = baselines.map((baseline) => {
      const linksSnapshot = baseline.linksSnapshot as { links?: Array<{ isSuspect?: boolean }> } | null
      const links = linksSnapshot?.links || []
      const linksCount = links.length
      const suspectLinksCount = links.filter((l: any) => l.isSuspect).length
      return {
        id: baseline.id,
        projectId: baseline.projectId,
        name: baseline.name,
        description: baseline.description,
        status: baseline.status,
        baselineType: baseline.baselineType ?? undefined,
        reviewType: baseline.reviewType ?? undefined,
        milestoneId: baseline.milestoneId ?? undefined,
        approvedBy: baseline.approvedBy ?? undefined,
        approvedByName: baseline.approvedByName ?? undefined,
        approvedAt: baseline.approvedAt?.toISOString(),
        approvalNotes: baseline.approvalNotes ?? undefined,
        supersedesBaselineId: baseline.supersedesBaselineId ?? undefined,
        configurationAuthority: baseline.configurationAuthority ?? undefined,
        fdAL: baseline.fdAL ?? undefined,
        createdBy: baseline.createdBy,
        createdByName: baseline.createdByName,
        lockedAt: baseline.lockedAt?.toISOString(),
        itemCount: baseline._count.items,
        linksCount,
        suspectLinksCount,
        createdAt: baseline.createdAt.toISOString(),
        updatedAt: baseline.updatedAt.toISOString(),
      }
    })

    res.json({
      success: true,
      data: formattedBaselines,
    })
  } catch (error) {
    console.error('Get baselines error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

/**
 * Get a specific baseline with its items
 */
export const getBaseline = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, baselineId } = req.params

    if (!projectId || !baselineId) {
      return res.status(400).json({
        success: false,
        error: 'Project ID and Baseline ID are required',
      })
    }

    const baseline = await prisma.baseline.findFirst({
      where: { id: baselineId, projectId },
      include: {
        items: true,
        _count: {
          select: { items: true },
        },
      },
    })

    if (!baseline) {
      return res.status(404).json({
        success: false,
        error: 'Baseline not found',
      })
    }

    // Format baseline items to avoid circular references and large JSON snapshots
    const formattedItems = (baseline.items || []).map((item) => ({
      id: item.id,
      baselineId: item.baselineId,
      requirementId: item.requirementId,
      snapshot: item.snapshot, // Keep snapshot as JSON string
      createdAt: item.createdAt.toISOString(),
    }))

    const linksSnapshot = baseline.linksSnapshot as { links?: Array<{ isSuspect?: boolean }> } | null
    const links = linksSnapshot?.links || []
    const linksCount = links.length
    const suspectLinksCount = links.filter((l: any) => l.isSuspect).length

    res.json({
      success: true,
      data: {
        id: baseline.id,
        projectId: baseline.projectId,
        name: baseline.name,
        description: baseline.description,
        status: baseline.status,
        baselineType: baseline.baselineType ?? undefined,
        reviewType: baseline.reviewType ?? undefined,
        milestoneId: baseline.milestoneId ?? undefined,
        approvedBy: baseline.approvedBy ?? undefined,
        approvedByName: baseline.approvedByName ?? undefined,
        approvedAt: baseline.approvedAt?.toISOString(),
        approvalNotes: baseline.approvalNotes ?? undefined,
        supersedesBaselineId: baseline.supersedesBaselineId ?? undefined,
        configurationAuthority: baseline.configurationAuthority ?? undefined,
        fdAL: baseline.fdAL ?? undefined,
        createdBy: baseline.createdBy,
        createdByName: baseline.createdByName,
        lockedAt: baseline.lockedAt?.toISOString(),
        itemCount: baseline._count.items,
        linksCount,
        suspectLinksCount,
        createdAt: baseline.createdAt.toISOString(),
        updatedAt: baseline.updatedAt.toISOString(),
        items: formattedItems,
      },
    })
  } catch (error: any) {
    console.error('Get baseline error:', error)
    const errorMessage = error?.message || 'Internal server error'
    const errorDetails = process.env.NODE_ENV === 'development' ? error?.stack : undefined
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      ...(errorDetails && { details: errorDetails }),
    })
  }
}

/**
 * Create a new baseline by snapshotting requirements.
 * Body: requirementIds?, componentIds?, functionIds? (all optional). Merged to form the set of requirements to baseline.
 * If none provided, all project requirements are included.
 */
export const createBaseline = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const {
      name,
      description,
      requirementIds,
      componentIds,
      functionIds,
      baselineType,
      reviewType,
      milestoneId,
      supersedesBaselineId,
      configurationAuthority,
      fdAL,
    } = req.body

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'Project ID is required',
      })
    }

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Baseline name is required',
      })
    }

    // Resolve requirement IDs from scope (components + functions) and merge with explicit requirementIds
    const mergedReqIds = new Set<string>(
      Array.isArray(requirementIds) && requirementIds.length > 0 ? requirementIds : []
    )

    // From PBS components: requirements whose componentId is in selected component or any descendant
    if (Array.isArray(componentIds) && componentIds.length > 0) {
      const allComponentIds = new Set<string>()
      for (const cid of componentIds) {
        const withDescendants = await collectComponentIdAndDescendants(projectId, cid)
        withDescendants.forEach((id) => allComponentIds.add(id))
      }
      const reqsByComponent = await prisma.requirement.findMany({
        where: {
          projectId,
          deletedAt: null,
          componentId: { in: Array.from(allComponentIds) },
        },
        select: { id: true },
      })
      reqsByComponent.forEach((r) => mergedReqIds.add(r.id))
    }

    // From functions: requirements linked via TraceLink (either direction)
    if (Array.isArray(functionIds) && functionIds.length > 0) {
      const links = await prisma.traceLink.findMany({
        where: {
          projectId,
          OR: [
            { sourceType: 'requirement', targetType: 'function', targetId: { in: functionIds } },
            { sourceType: 'function', targetType: 'requirement', sourceId: { in: functionIds } },
          ],
        },
        select: { sourceType: true, sourceId: true, targetType: true, targetId: true },
      })
      for (const link of links) {
        if (link.sourceType === 'requirement') mergedReqIds.add(link.sourceId)
        if (link.targetType === 'requirement') mergedReqIds.add(link.targetId)
      }
    }

    // Build where: if we have any merged IDs, filter by them; otherwise all project requirements
    const whereClause: any = { projectId, deletedAt: null }
    if (mergedReqIds.size > 0) {
      whereClause.id = { in: Array.from(mergedReqIds) }
    }

    const requirements = await prisma.requirement.findMany({
      where: whereClause,
      include: {
        comments: true,
        attachments: true,
      },
    })

    const snapshotReqIds = requirements.map((r) => r.id)

    // Resolve creator name for "Created by" display (Archive and BaselineManager)
    let createdByName: string | null = null
    const createdByUserId = req.userId ?? null
    if (req.userId) {
      const creator = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { name: true, email: true },
      })
      createdByName = creator?.name?.trim() || creator?.email || null
    }

    // Create baseline and items in a transaction
    const baseline = await prisma.$transaction(async (tx) => {
      // Verify that baseline model exists on transaction client
      if (!tx.baseline) {
        throw new Error('Baseline model not found. Please run: npx prisma generate')
      }

      // Create the baseline
      const newBaseline = await tx.baseline.create({
        data: {
          projectId,
          name,
          description: description || null,
          status: 'active',
          baselineType: baselineType || null,
          reviewType: reviewType || null,
          milestoneId: milestoneId || null,
          supersedesBaselineId: supersedesBaselineId || null,
          configurationAuthority: configurationAuthority || null,
          fdAL: fdAL || null,
          createdBy: req.userId ?? null,
          createdByName,
        },
      })

      // Snapshot links where source or target is a requirement in this baseline
      let linksSnapshot: { links: any[] } | null = null
      if (snapshotReqIds.length > 0) {
        const traceLinks = await tx.traceLink.findMany({
          where: {
            projectId,
            OR: [
              { sourceType: 'requirement', sourceId: { in: snapshotReqIds } },
              { targetType: 'requirement', targetId: { in: snapshotReqIds } },
            ],
          },
        })
        linksSnapshot = {
          links: traceLinks.map((l) => ({
            id: l.id,
            sourceType: l.sourceType,
            sourceId: l.sourceId,
            targetType: l.targetType,
            targetId: l.targetId,
            linkType: l.linkType,
            rationale: l.rationale,
            isSuspect: l.isSuspect,
          })),
        }
        await tx.baseline.update({
          where: { id: newBaseline.id },
          data: { linksSnapshot },
        })
      }

      // Create baseline items for each requirement
      if (requirements.length > 0) {
        // Create snapshot data, handling potential circular references
        const snapshotData = requirements.map((req) => {
          // Create a clean copy without circular references
          const cleanReq = {
            id: req.id,
            projectId: req.projectId,
            requirementId: req.requirementId,
            title: req.title,
            description: req.description,
            parentId: req.parentId,
            priority: req.priority,
            status: req.status,
            stage: req.stage,
            owner: req.owner,
            verificationMethod: req.verificationMethod,
            acceptanceCriteria: req.acceptanceCriteria,
            source: req.source,
            category: req.category,
            relatedDocuments: req.relatedDocuments,
            tags: req.tags,
            createdAt: req.createdAt.toISOString(),
            updatedAt: req.updatedAt.toISOString(),
            // Include comments and attachments counts, not full objects
            commentsCount: req.comments?.length || 0,
            attachmentsCount: req.attachments?.length || 0,
          }
          return {
            baselineId: newBaseline.id,
            requirementId: req.id,
            snapshot: JSON.stringify(cleanReq),
          }
        })
        
        await tx.baselineItem.createMany({
          data: snapshotData,
        })

        // Record each included requirement in its version history as a baselined snapshot
        for (const requirement of requirements) {
          const latestVersion = await tx.requirementVersion.findFirst({
            where: { requirementId: requirement.id, projectId },
            orderBy: { version: 'desc' },
            select: { version: true },
          })
          const newVersionNumber = (latestVersion?.version ?? 0) + 1
          const tagsArray = Array.isArray(requirement.tags)
            ? requirement.tags.map((t: unknown) => (typeof t === 'string' ? t : String(t)))
            : []
          await tx.requirementVersion.create({
            data: {
              requirementId: requirement.id,
              projectId,
              version: newVersionNumber,
              title: String(requirement.title ?? ''),
              description: String(requirement.description ?? ''),
              priority: String(requirement.priority ?? ''),
              status: String(requirement.status ?? ''),
              stage: requirement.stage != null ? String(requirement.stage) : null,
              owner: requirement.owner != null ? String(requirement.owner) : null,
              category: requirement.category != null ? String(requirement.category) : null,
              source: requirement.source != null ? String(requirement.source) : null,
              verificationMethod: requirement.verificationMethod != null ? String(requirement.verificationMethod) : null,
              acceptanceCriteria: requirement.acceptanceCriteria != null ? String(requirement.acceptanceCriteria) : null,
              tags: tagsArray,
              changedBy: createdByUserId,
              changedByName: createdByName,
              changeReason: `Baselined: ${newBaseline.name}`,
              snapshot: JSON.stringify(requirement),
              baselineId: newBaseline.id,
              baselineName: newBaseline.name,
            },
          })
        }
      }

      return newBaseline
    })

    await logBaselineAudit(
      projectId,
      req.user?.id,
      'BASELINE_CREATED',
      `Baseline "${name}" created (id: ${baseline.id}, ${requirements.length} requirements)`
    )

    res.status(201).json({
      success: true,
      data: {
        ...baseline,
        itemCount: requirements.length,
        createdAt: baseline.createdAt.toISOString(),
        updatedAt: baseline.updatedAt.toISOString(),
      },
      message: `Baseline created with ${requirements.length} requirement(s)`,
    })
  } catch (error: any) {
    console.error('Create baseline error:', error)
    
    let errorMessage = 'Internal server error'
    if (error?.message) {
      errorMessage = error.message
      // Check for common database errors
      if (error.message.includes('Unknown model') || 
          error.message.includes('does not exist') ||
          error.message.includes('Cannot read properties of undefined')) {
        errorMessage = 'Database schema needs to be updated. Please run: cd backend && npx prisma generate && npx prisma db push'
      } else if (error.message.includes('Foreign key constraint')) {
        errorMessage = 'Invalid project ID or database constraint violation'
      } else if (error.message.includes('Unique constraint')) {
        errorMessage = 'A baseline with this name already exists'
      }
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage,
    })
  }
}

/**
 * Lock a baseline to prevent further changes
 */
export const lockBaseline = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, baselineId } = req.params

    const baseline = await prisma.baseline.findFirst({
      where: { id: baselineId, projectId },
    })

    if (!baseline) {
      return res.status(404).json({
        success: false,
        error: 'Baseline not found',
      })
    }

    if (baseline.status === 'locked') {
      return res.status(400).json({
        success: false,
        error: 'Baseline is already locked',
      })
    }

    const updatedBaseline = await prisma.baseline.update({
      where: { id: baselineId },
      data: {
        status: 'locked',
        lockedAt: new Date(),
      },
    })

    await logBaselineAudit(
      projectId,
      req.user?.id,
      'BASELINE_LOCKED',
      `Baseline "${baseline.name}" locked (id: ${baselineId})`
    )

    res.json({
      success: true,
      data: {
        ...updatedBaseline,
        lockedAt: updatedBaseline.lockedAt?.toISOString(),
        createdAt: updatedBaseline.createdAt.toISOString(),
        updatedAt: updatedBaseline.updatedAt.toISOString(),
      },
      message: 'Baseline locked successfully',
    })
  } catch (error) {
    console.error('Lock baseline error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

/**
 * Delete a baseline
 */
export const deleteBaseline = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, baselineId } = req.params

    const baseline = await prisma.baseline.findFirst({
      where: { id: baselineId, projectId },
    })

    if (!baseline) {
      return res.status(404).json({
        success: false,
        error: 'Baseline not found',
      })
    }

    if (baseline.status === 'locked') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete a locked baseline',
      })
    }

    await logBaselineAudit(
      projectId,
      req.user?.id,
      'BASELINE_DELETED',
      `Baseline "${baseline.name}" deleted (id: ${baselineId})`
    )

    await prisma.baseline.delete({
      where: { id: baselineId },
    })

    res.json({
      success: true,
      message: 'Baseline deleted successfully',
    })
  } catch (error) {
    console.error('Delete baseline error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

/**
 * Compare two baselines
 */
export const compareBaselines = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { baselineAId, baselineBId } = req.query

    if (!baselineAId || !baselineBId) {
      return res.status(400).json({
        success: false,
        error: 'Both baselineAId and baselineBId are required',
      })
    }

    const [baselineA, baselineB] = await Promise.all([
      prisma.baseline.findFirst({
        where: { id: baselineAId as string, projectId },
        include: { items: true },
      }),
      prisma.baseline.findFirst({
        where: { id: baselineBId as string, projectId },
        include: { items: true },
      }),
    ])

    if (!baselineA || !baselineB) {
      return res.status(404).json({
        success: false,
        error: 'One or both baselines not found',
      })
    }

    // Build maps of requirement IDs to parsed snapshots
    const parseSnapshot = (snapshot: string) => {
      try {
        return JSON.parse(snapshot)
      } catch {
        return null
      }
    }

    const mapA = new Map(
      baselineA.items.map((item) => [item.requirementId, { snapshot: item.snapshot, parsed: parseSnapshot(item.snapshot) }])
    )
    const mapB = new Map(
      baselineB.items.map((item) => [item.requirementId, { snapshot: item.snapshot, parsed: parseSnapshot(item.snapshot) }])
    )

    const added: any[] = []
    const removed: any[] = []
    const modified: any[] = []

    // Find added and modified
    mapB.forEach((itemB, reqId) => {
      const itemA = mapA.get(reqId)
      if (!itemA) {
        // Added requirement
        if (itemB.parsed) {
          added.push({
            id: reqId,
            requirementId: itemB.parsed.requirementId || reqId.substring(0, 8),
            title: itemB.parsed.title || 'Untitled',
            description: itemB.parsed.description || '',
            priority: itemB.parsed.priority || '',
            status: itemB.parsed.status || '',
            category: itemB.parsed.category || '',
          })
        } else {
          added.push({ id: reqId, requirementId: reqId.substring(0, 8), title: 'Unknown' })
        }
      } else if (itemA.snapshot !== itemB.snapshot) {
        // Modified requirement - include both versions and changedFields
        const parsedA = itemA.parsed
        const parsedB = itemB.parsed
        if (parsedA && parsedB) {
          const fieldsToCompare = [
            'title', 'description', 'priority', 'status', 'category', 'owner',
            'verificationMethod', 'acceptanceCriteria', 'source', 'stage',
          ] as const
          const str = (v: unknown) => (v == null ? '' : String(v).trim())
          const changedFields: string[] = fieldsToCompare.filter(
            (f) => str(parsedA[f]) !== str(parsedB[f])
          )
          modified.push({
            id: reqId,
            requirementId: parsedB.requirementId || reqId.substring(0, 8),
            title: parsedB.title || 'Untitled',
            description: parsedB.description || '',
            priority: parsedB.priority || '',
            status: parsedB.status || '',
            category: parsedB.category || '',
            changedFields,
            previous: {
              title: parsedA.title ?? undefined,
              description: parsedA.description ?? undefined,
              priority: parsedA.priority ?? undefined,
              status: parsedA.status ?? undefined,
              category: parsedA.category ?? undefined,
              owner: parsedA.owner ?? undefined,
              verificationMethod: parsedA.verificationMethod ?? undefined,
              acceptanceCriteria: parsedA.acceptanceCriteria ?? undefined,
              source: parsedA.source ?? undefined,
              stage: parsedA.stage ?? undefined,
            },
          })
        } else {
          modified.push({ id: reqId, requirementId: reqId.substring(0, 8), title: 'Unknown' })
        }
      }
    })

    // Find removed
    mapA.forEach((itemA, reqId) => {
      if (!mapB.has(reqId)) {
        // Removed requirement
        if (itemA.parsed) {
          removed.push({
            id: reqId,
            requirementId: itemA.parsed.requirementId || reqId.substring(0, 8),
            title: itemA.parsed.title || 'Untitled',
            description: itemA.parsed.description || '',
            priority: itemA.parsed.priority || '',
            status: itemA.parsed.status || '',
            category: itemA.parsed.category || '',
          })
        } else {
          removed.push({ id: reqId, requirementId: reqId.substring(0, 8), title: 'Unknown' })
        }
      }
    })

    // Diff links from linksSnapshot (LINKAGE_V1)
    const linksA = (baselineA.linksSnapshot as { links?: any[] } | null)?.links || []
    const linksB = (baselineB.linksSnapshot as { links?: any[] } | null)?.links || []
    const linkKey = (l: any) => `${l.sourceType}:${l.sourceId}:${l.targetType}:${l.targetId}:${l.linkType}`
    const setA = new Map(linksA.map((l) => [linkKey(l), l]))
    const setB = new Map(linksB.map((l) => [linkKey(l), l]))

    const linksAdded: Array<{ id: string; sourceId: string; sourceType: string; targetId: string; targetType: string; linkType: string }> = []
    const linksRemoved: Array<{ id: string; sourceId: string; sourceType: string; targetId: string; targetType: string; linkType: string }> = []
    const linksSuspectChanged: Array<{ id: string; sourceId: string; sourceType: string; targetId: string; targetType: string; linkType: string }> = []

    setB.forEach((linkB, key) => {
      const linkA = setA.get(key)
      if (!linkA) {
        linksAdded.push({
          id: linkB.id,
          sourceId: linkB.sourceId,
          sourceType: linkB.sourceType,
          targetId: linkB.targetId,
          targetType: linkB.targetType,
          linkType: linkB.linkType,
        })
      } else if (linkA.isSuspect !== linkB.isSuspect) {
        linksSuspectChanged.push({
          id: linkB.id,
          sourceId: linkB.sourceId,
          sourceType: linkB.sourceType,
          targetId: linkB.targetId,
          targetType: linkB.targetType,
          linkType: linkB.linkType,
        })
      }
    })
    setA.forEach((linkA, key) => {
      if (!setB.has(key)) {
        linksRemoved.push({
          id: linkA.id,
          sourceId: linkA.sourceId,
          sourceType: linkA.sourceType,
          targetId: linkA.targetId,
          targetType: linkA.targetType,
          linkType: linkA.linkType,
        })
      }
    })

    res.json({
      success: true,
      data: {
        baselineA: {
          id: baselineA.id,
          name: baselineA.name,
          createdAt: baselineA.createdAt.toISOString(),
          linksCount: linksA.length,
        },
        baselineB: {
          id: baselineB.id,
          name: baselineB.name,
          createdAt: baselineB.createdAt.toISOString(),
          linksCount: linksB.length,
        },
        added,
        removed,
        modified,
        linksAdded,
        linksRemoved,
        linksSuspectChanged,
        summary: {
          addedCount: added.length,
          removedCount: removed.length,
          modifiedCount: modified.length,
          linksAddedCount: linksAdded.length,
          linksRemovedCount: linksRemoved.length,
        },
      },
    })
  } catch (error) {
    console.error('Compare baselines error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}
