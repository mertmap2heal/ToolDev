import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma'
import { extractParameters } from '../utils/parameterExtractor'
import { traceabilityService } from '../services/traceability.service'
import { isAdminUser } from '../lib/adminAuth'


export const createFunction = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const {
      functionId, name, description, sourceReqId,
      status, owner, verificationMethod,
      parentId, level, sortOrder, criticality,
      pbsComponentId, allocatedTo,
    } = req.body

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Function name is required',
      })
    }

    // Auto-generate functionId if not provided
    let resolvedFunctionId = functionId?.trim()?.toUpperCase() || ''
    if (!resolvedFunctionId) {
      const count = await prisma.systemFunction.count({ where: { projectId } })
      const nextNum = count + 1
      let candidate = `FUNC-${String(nextNum).padStart(3, '0')}`
      // Ensure uniqueness by incrementing if collision
      let exists = await prisma.systemFunction.findUnique({ where: { functionId: candidate } })
      let attempt = nextNum
      while (exists) {
        attempt++
        candidate = `FUNC-${String(attempt).padStart(3, '0')}`
        exists = await prisma.systemFunction.findUnique({ where: { functionId: candidate } })
      }
      resolvedFunctionId = candidate
    } else {
      // Check if user-provided functionId already exists
      const existingFunction = await prisma.systemFunction.findUnique({
        where: { functionId: resolvedFunctionId },
      })

      if (existingFunction) {
        return res.status(400).json({
          success: false,
          error: 'Function ID already exists. Please use a different ID.',
        })
      }
    }

    // Calculate level from parent if parentId is provided
    let computedLevel = level ?? 0
    if (parentId) {
      const parentFunc = await prisma.systemFunction.findUnique({
        where: { id: parentId },
      })
      if (parentFunc) {
        computedLevel = (parentFunc.level ?? 0) + 1
      }
    }

    // Get next sort order
    let computedSortOrder = sortOrder ?? 0
    if (computedSortOrder === 0) {
      const maxSort = await prisma.systemFunction.aggregate({
        _max: { sortOrder: true },
        where: { projectId, parentId: parentId || null },
      })
      computedSortOrder = (maxSort._max.sortOrder ?? 0) + 1
    }

    const function_ = await prisma.systemFunction.create({
      data: {
        projectId,
        functionId: resolvedFunctionId,
        name,
        description: description || '',
        sourceReqId,
        status: status || 'draft',
        owner: owner || '',
        verificationMethod: verificationMethod || '',
        parentId: parentId || null,
        level: computedLevel,
        sortOrder: computedSortOrder,
        criticality: criticality || 'medium',
        pbsComponentId: pbsComponentId || null,
        allocatedTo: allocatedTo || null,
      },
    })

    // Extract parameters from description and create them
    if (description) {
      const parameterNames = extractParameters(description)
      for (const paramName of parameterNames) {
        try {
          await prisma.parameter.upsert({
            where: {
              projectId_name: {
                projectId,
                name: paramName,
              },
            },
            update: {
              sourceFunctionId: function_.id,
            },
            create: {
              projectId,
              name: paramName,
              description: `Parameter extracted from function ${functionId}`,
              sourceFunctionId: function_.id,
            },
          })
        } catch (error) {
          console.error(`Failed to create parameter ${paramName}:`, error)
        }
      }
    }

    // Return the function with children included
    const result = await prisma.systemFunction.findUnique({
      where: { id: function_.id },
      include: {
        children: {
          orderBy: { sortOrder: 'asc' },
        },
        parent: {
          select: { id: true, functionId: true, name: true },
        },
      },
    })

    res.status(201).json({
      success: true,
      data: result,
    })
  } catch (error: any) {
    console.error('Create function error:', error)

    let errorMessage = 'Internal server error'
    if (error?.message) {
      errorMessage = error.message
      if (error.message.includes('Unknown arg')) {
        errorMessage = 'Database schema mismatch. Please run: npx prisma db push'
      } else if (error.message.includes('Foreign key constraint')) {
        errorMessage = 'Invalid project ID'
      } else if (error.message.includes('Unique constraint')) {
        errorMessage = 'Function with this ID already exists'
      }
    }

    res.status(500).json({
      success: false,
      error: errorMessage,
    })
  }
}

export const getFunctions = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params

    const functions = await prisma.systemFunction.findMany({
      where: { projectId },
      include: {
        children: {
          orderBy: { sortOrder: 'asc' },
        },
        parent: {
          select: { id: true, functionId: true, name: true },
        },
      },
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    })

    res.json({
      success: true,
      data: functions,
    })
  } catch (error) {
    console.error('Get functions error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const getFunction = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const function_ = await prisma.systemFunction.findUnique({
      where: { id },
      include: {
        children: {
          orderBy: { sortOrder: 'asc' },
          include: {
            children: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        parent: {
          select: { id: true, functionId: true, name: true },
        },
      },
    })

    if (!function_) {
      return res.status(404).json({
        success: false,
        error: 'Function not found',
      })
    }

    res.json({
      success: true,
      data: function_,
    })
  } catch (error) {
    console.error('Get function error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const updateFunction = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const {
      functionId, name, description, sourceReqId,
      status, owner, verificationMethod,
      parentId, level, sortOrder, criticality,
      pbsComponentId, allocatedTo,
    } = req.body

    const function_ = await prisma.systemFunction.findUnique({
      where: { id },
    })

    if (!function_) {
      return res.status(404).json({
        success: false,
        error: 'Function not found',
      })
    }

    // Check if functionId is being changed and if it already exists
    if (functionId && functionId !== function_.functionId) {
      const existingFunction = await prisma.systemFunction.findUnique({
        where: { functionId },
      })

      if (existingFunction) {
        return res.status(400).json({
          success: false,
          error: 'Function ID already exists. Please use a different ID.',
        })
      }
    }

    // Prevent circular parent references
    if (parentId && parentId !== function_.parentId) {
      if (parentId === id) {
        return res.status(400).json({
          success: false,
          error: 'A function cannot be its own parent.',
        })
      }
      let currentParentId: string | null = parentId
      while (currentParentId) {
        if (currentParentId === id) {
          return res.status(400).json({
            success: false,
            error: 'Circular parent reference detected.',
          })
        }
        const p = await prisma.systemFunction.findUnique({
          where: { id: currentParentId },
          select: { parentId: true },
        })
        currentParentId = p?.parentId ?? null
      }
    }

    // Calculate level from parent
    let computedLevel = level
    if (parentId !== undefined) {
      if (parentId) {
        const parentFunc = await prisma.systemFunction.findUnique({
          where: { id: parentId },
          select: { level: true },
        })
        computedLevel = parentFunc ? (parentFunc.level ?? 0) + 1 : 0
      } else {
        computedLevel = 0
      }
    }

    const projectId = function_.projectId

    const updatedFunction = await prisma.systemFunction.update({
      where: { id },
      data: {
        ...(functionId !== undefined && { functionId }),
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(sourceReqId !== undefined && { sourceReqId }),
        ...(status !== undefined && { status }),
        ...(owner !== undefined && { owner }),
        ...(verificationMethod !== undefined && { verificationMethod }),
        ...(parentId !== undefined && { parentId: parentId || null }),
        ...(computedLevel !== undefined && { level: computedLevel }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(criticality !== undefined && { criticality }),
        ...(pbsComponentId !== undefined && { pbsComponentId: pbsComponentId || null }),
        ...(allocatedTo !== undefined && { allocatedTo: allocatedTo || null }),
      },
      include: {
        children: { orderBy: { sortOrder: 'asc' } },
        parent: { select: { id: true, functionId: true, name: true } },
      },
    })

    // Extract parameters from description
    if (description) {
      const parameterNames = extractParameters(description)
      for (const paramName of parameterNames) {
        try {
          await prisma.parameter.upsert({
            where: {
              projectId_name: {
                projectId,
                name: paramName,
              },
            },
            update: {
              sourceFunctionId: updatedFunction.id,
            },
            create: {
              projectId,
              name: paramName,
              description: `Parameter extracted from function ${updatedFunction.functionId || updatedFunction.name}`,
              sourceFunctionId: updatedFunction.id,
            },
          })
        } catch (error) {
          console.error(`Failed to create/update parameter ${paramName}:`, error)
        }
      }
    }

    // If parentId changed, update levels of all descendants recursively
    if (parentId !== undefined && parentId !== function_.parentId) {
      await updateDescendantLevels(id, computedLevel ?? 0)
    }

    res.json({
      success: true,
      data: updatedFunction,
    })
  } catch (error) {
    console.error('Update function error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

// Recursively update levels of descendants
async function updateDescendantLevels(parentId: string, parentLevel: number) {
  const children = await prisma.systemFunction.findMany({
    where: { parentId },
    select: { id: true },
  })
  for (const child of children) {
    const newLevel = parentLevel + 1
    await prisma.systemFunction.update({
      where: { id: child.id },
      data: { level: newLevel },
    })
    await updateDescendantLevels(child.id, newLevel)
  }
}

/**
 * Delete a function.
 *
 * Issue #290: the previous implementation hard-deleted every Issue whose
 * `relatedFunctionIds` contained this function's id, with no caller
 * authorisation check beyond plain project membership and no audit trail.
 * Any member could destroy the entire function-issue graph in one call.
 *
 * New behaviour:
 *   - Scoped lookup by (id, projectId).
 *   - Default cascade is *nullify*: the function id is spliced out of each
 *     linked Issue's `relatedFunctionIds`, the Issues survive.
 *   - Hard-delete of linked Issues still possible but requires BOTH
 *     `?deleteLinkedIssues=true` AND the caller being project owner or
 *     platform admin. Every deletion writes an AuditLog entry naming the
 *     affected issueKey so the cascade is discoverable.
 */
export const deleteFunction = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const function_ = await prisma.systemFunction.findFirst({
      where: { id, projectId },
      include: { children: { select: { id: true } } },
    })

    if (!function_) {
      return res.status(404).json({
        success: false,
        error: 'Function not found',
      })
    }

    // Re-parent children to the deleted function's parent
    if (function_.children && function_.children.length > 0) {
      await prisma.systemFunction.updateMany({
        where: { parentId: id },
        data: {
          parentId: function_.parentId || null,
          level: function_.level,
        },
      })
      for (const child of function_.children) {
        await updateDescendantLevels(child.id, function_.level)
      }
    }

    // Resolve linked issues.
    const linkedIssues = await prisma.issue.findMany({
      where: {
        projectId: function_.projectId,
        relatedFunctionIds: { has: id },
      },
      select: { id: true, issueKey: true, relatedFunctionIds: true, title: true },
    })

    const wantsHardCascade = String(req.query.deleteLinkedIssues ?? '').toLowerCase() === 'true'

    if (linkedIssues.length > 0 && wantsHardCascade) {
      // Hard cascade — caller must be project owner / admin.
      const [adminBypass, ownerMember, legacyOwner] = await Promise.all([
        isAdminUser(userId),
        prisma.projectMember.findFirst({
          where: { projectId: function_.projectId, userId, role: 'owner' },
          select: { id: true },
        }),
        prisma.project.findFirst({
          where: { id: function_.projectId, userId },
          select: { id: true },
        }),
      ])
      const authorised = adminBypass || ownerMember || legacyOwner
      if (!authorised) {
        return res.status(403).json({
          success: false,
          error: 'Only a project owner or admin can hard-delete linked issues',
        })
      }

      await prisma.issue.deleteMany({
        where: { id: { in: linkedIssues.map((issue) => issue.id) } },
      })

      // #290: record an audit entry per destroyed issue so the cascade is
      // visible after the fact.
      await prisma.auditLog.createMany({
        data: linkedIssues.map((issue) => ({
          projectId: function_.projectId,
          userId,
          action: 'ISSUE_HARD_DELETED_VIA_FUNCTION_CASCADE',
          details: JSON.stringify({
            issueId: issue.id,
            issueKey: issue.issueKey,
            title: issue.title,
            functionId: id,
            functionName: function_.name,
          }),
        })),
      })
    } else if (linkedIssues.length > 0) {
      // Default nullify cascade: keep the issues, just unlink.
      await Promise.all(
        linkedIssues.map((issue) =>
          prisma.issue.update({
            where: { id: issue.id },
            data: {
              relatedFunctionIds: issue.relatedFunctionIds.filter((f) => f !== id),
            },
          }),
        ),
      )
    }

    await prisma.systemFunction.delete({
      where: { id },
    })

    const msg = linkedIssues.length === 0
      ? 'Function deleted successfully'
      : wantsHardCascade
        ? `Function deleted along with ${linkedIssues.length} linked issue(s)`
        : `Function deleted; ${linkedIssues.length} linked issue(s) kept (unlinked)`

    res.json({
      success: true,
      message: msg,
      data: {
        linkedIssueCount: linkedIssues.length,
        cascadeMode: wantsHardCascade ? 'hard-delete' : 'nullify',
      },
    })
  } catch (error) {
    console.error('Delete function error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

// Move function in hierarchy (re-parent + reorder)
export const moveFunction = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { newParentId, newSortOrder } = req.body

    const function_ = await prisma.systemFunction.findUnique({
      where: { id },
    })

    if (!function_) {
      return res.status(404).json({
        success: false,
        error: 'Function not found',
      })
    }

    let newLevel = 0
    if (newParentId) {
      const parent = await prisma.systemFunction.findUnique({
        where: { id: newParentId },
        select: { level: true },
      })
      newLevel = parent ? (parent.level ?? 0) + 1 : 0
    }

    await prisma.systemFunction.update({
      where: { id },
      data: {
        parentId: newParentId || null,
        level: newLevel,
        sortOrder: newSortOrder ?? 0,
      },
    })

    await updateDescendantLevels(id, newLevel)

    const updated = await prisma.systemFunction.findUnique({
      where: { id },
      include: {
        children: { orderBy: { sortOrder: 'asc' } },
        parent: { select: { id: true, functionId: true, name: true } },
      },
    })

    res.json({
      success: true,
      data: updated,
    })
  } catch (error) {
    console.error('Move function error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

/**
 * Update the PBS component assignment for a function (drag-and-drop) — same logic as requirements
 */
export const updateFunctionComponent = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id: functionId } = req.params
    const { componentId } = req.body

    const function_ = await prisma.systemFunction.findFirst({
      where: {
        projectId,
        id: functionId,
      },
    })

    if (!function_) {
      return res.status(404).json({
        success: false,
        error: 'Function not found',
      })
    }

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

    const updated = await prisma.systemFunction.update({
      where: { id: functionId },
      data: {
        pbsComponentId: componentId || null,
      },
    })

    // Sync allocated_to trace link (same as requirements).
    // Replaced sequential per-link deleteTraceLink loop (~5 round-trips x N) with
    // capped-parallel fan-out. deleteTraceLink preserves all audit + notify
    // side effects per link; Promise.all just removes the wall-clock serialization.
    const existingAllocLinks = await prisma.traceLink.findMany({
      where: {
        projectId,
        sourceType: 'function',
        sourceId: functionId,
        targetType: 'pbs_component',
        linkType: 'allocated_to',
      },
    })
    if (existingAllocLinks.length > 0) {
      const DELETE_CONCURRENCY = 16
      for (let i = 0; i < existingAllocLinks.length; i += DELETE_CONCURRENCY) {
        const slice = existingAllocLinks.slice(i, i + DELETE_CONCURRENCY)
        await Promise.all(
          slice.map((link) =>
            traceabilityService.deleteTraceLink(projectId, link.id, req.userId)
          )
        )
      }
    }
    if (componentId) {
      await traceabilityService.createTraceLink(
        projectId,
        'function',
        functionId,
        'pbs_component',
        componentId,
        'allocated_to',
        undefined,
        'Auto-linked from PBS component assignment',
        req.userId
      )
    }

    res.json({
      success: true,
      data: updated,
    })
  } catch (error) {
    console.error('Update function component error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}
