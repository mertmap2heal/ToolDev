import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma'
import type { Prisma } from '@prisma/client'


/**
 * Get version history for a specific requirement
 */
export const getRequirementVersions = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, requirementId } = req.params

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

    const versions = await prisma.requirementVersion.findMany({
      where: {
        requirementId: requirement.id,
        projectId,
      },
      orderBy: { version: 'desc' },
    })

    // All requirement-scoped audits except REQUIREMENT_UPDATED (field edits are in RequirementVersion snapshots)
    const auditEvents = await prisma.verAuditEvent.findMany({
      where: {
        projectId,
        entityType: 'REQUIREMENT',
        entityId: requirement.id,
        action: { not: 'REQUIREMENT_UPDATED' },
      },
      orderBy: { performedAt: 'desc' },
    })

    // Fetch user details for audit events
    const userIds = [...new Set(auditEvents.map(e => e.performedByUserId).filter(Boolean))] as string[]
    const users = userIds.length > 0 ? await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    }) : []

    const userMap = new Map(users.map(user => [user.id, user]))

    // Map audit events with user details
    const enrichedAuditEvents = auditEvents.map(event => ({
      id: event.id,
      action: event.action,
      performedAt: event.performedAt,
      performedByUserId: event.performedByUserId,
      performedByUser: event.performedByUserId ? userMap.get(event.performedByUserId) || null : null,
      oldValue: event.oldValue,
      newValue: event.newValue,
    }))

    res.json({
      success: true,
      data: {
        versions,
        auditEvents: enrichedAuditEvents,
      }
    })
  } catch (error) {
    console.error('Get requirement versions error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

/**
 * Get a specific version of a requirement
 */
export const getRequirementVersion = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, requirementId, versionNumber } = req.params

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

    const version = await prisma.requirementVersion.findFirst({
      where: {
        requirementId: requirement.id,
        projectId,
        version: parseInt(versionNumber, 10),
      },
    })

    if (!version) {
      return res.status(404).json({
        success: false,
        error: 'Version not found',
      })
    }

    res.json({
      success: true,
      data: version,
    })
  } catch (error) {
    console.error('Get requirement version error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

/**
 * Create a new version snapshot for a requirement
 * This is typically called automatically when a requirement is updated
 */
export const createRequirementVersion = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, requirementId } = req.params
    const { changeReason } = req.body

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

    // Get the latest version number
    const latestVersion = await prisma.requirementVersion.findFirst({
      where: {
        requirementId: requirement.id,
        projectId,
      },
      orderBy: { version: 'desc' },
      select: { version: true },
    })

    const newVersionNumber = (latestVersion?.version || 0) + 1

    // Create version snapshot
    const version = await prisma.requirementVersion.create({
      data: {
        requirementId: requirement.id,
        projectId,
        version: newVersionNumber,
        title: requirement.title,
        description: requirement.description,
        priority: requirement.priority,
        status: requirement.status,
        stage: requirement.stage,
        owner: requirement.owner,
        category: requirement.category,
        source: requirement.source,
        verificationMethod: requirement.verificationMethod,
        acceptanceCriteria: requirement.acceptanceCriteria,
        tags: requirement.tags,
        changedBy: req.user?.id,
        changedByName: req.user?.name,
        changeReason: changeReason || null,
        snapshot: JSON.stringify(requirement),
      },
    })

    res.status(201).json({
      success: true,
      data: version,
    })
  } catch (error) {
    console.error('Create requirement version error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

/**
 * Compare two versions of a requirement
 */
export const compareVersions = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, requirementId } = req.params
    const { versionA, versionB } = req.query

    if (!versionA || !versionB) {
      return res.status(400).json({
        success: false,
        error: 'Both versionA and versionB query parameters are required',
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

    const [versionAData, versionBData] = await Promise.all([
      prisma.requirementVersion.findFirst({
        where: {
          requirementId: requirement.id,
          projectId,
          version: parseInt(versionA as string, 10),
        },
      }),
      prisma.requirementVersion.findFirst({
        where: {
          requirementId: requirement.id,
          projectId,
          version: parseInt(versionB as string, 10),
        },
      }),
    ])

    if (!versionAData || !versionBData) {
      return res.status(404).json({
        success: false,
        error: 'One or both versions not found',
      })
    }

    // Calculate diff for key fields
    const diff = {
      title: versionAData.title !== versionBData.title,
      description: versionAData.description !== versionBData.description,
      priority: versionAData.priority !== versionBData.priority,
      status: versionAData.status !== versionBData.status,
      stage: versionAData.stage !== versionBData.stage,
      owner: versionAData.owner !== versionBData.owner,
      category: versionAData.category !== versionBData.category,
      source: versionAData.source !== versionBData.source,
      verificationMethod: versionAData.verificationMethod !== versionBData.verificationMethod,
      acceptanceCriteria: versionAData.acceptanceCriteria !== versionBData.acceptanceCriteria,
      tags: JSON.stringify(versionAData.tags) !== JSON.stringify(versionBData.tags),
    }

    res.json({
      success: true,
      data: {
        versionA: versionAData,
        versionB: versionBData,
        diff,
        changedFields: Object.entries(diff).filter(([, changed]) => changed).map(([field]) => field),
      },
    })
  } catch (error) {
    console.error('Compare versions error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

/**
 * Helper function to create a version when updating a requirement
 * Call this before updating the requirement to capture the previous state
 */
/**
 * Create a version snapshot of a requirement's current state.
 *
 * @param tx  Optional Prisma transaction client. When provided the snapshot is
 *            written atomically with the caller's transaction — any error
 *            propagates so the caller's transaction rolls back. When omitted
 *            the function uses the global singleton and swallows errors so it
 *            never blocks a standalone call.
 */
export async function createVersionSnapshot(
  requirementId: string,
  projectId: string,
  userId?: string,
  userName?: string,
  changeReason?: string,
  tx?: Prisma.TransactionClient
): Promise<void> {
  const client = tx ?? prisma

  const doSnapshot = async () => {
    const requirement = await client.requirement.findFirst({
      where: { id: requirementId, projectId },
    })

    if (!requirement) return

    const latestVersion = await client.requirementVersion.findFirst({
      where: { requirementId, projectId },
      orderBy: { version: 'desc' },
      select: { version: true },
    })

    const newVersionNumber = (latestVersion?.version || 0) + 1

    await client.requirementVersion.create({
      data: {
        requirementId,
        projectId,
        version: newVersionNumber,
        title: requirement.title,
        description: requirement.description,
        priority: requirement.priority,
        status: requirement.status,
        stage: requirement.stage,
        owner: requirement.owner,
        category: requirement.category,
        source: requirement.source,
        verificationMethod: requirement.verificationMethod,
        acceptanceCriteria: requirement.acceptanceCriteria,
        tags: requirement.tags,
        changedBy: userId,
        changedByName: userName,
        changeReason,
        snapshot: JSON.stringify(requirement),
      },
    })
  }

  if (tx) {
    // Inside a transaction: let errors propagate to trigger rollback
    await doSnapshot()
  } else {
    // Standalone: swallow errors so snapshot failure never blocks the caller
    try {
      await doSnapshot()
    } catch (error) {
      console.error('Create version snapshot error:', error)
    }
  }
}
