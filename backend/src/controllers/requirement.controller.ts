import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { PrismaClient } from '@prisma/client'
import { createVersionSnapshot } from './version.controller'

const prisma = new PrismaClient()

// Helper function to generate requirement ID
async function generateRequirementId(projectId: string, category?: string): Promise<string> {
  const prefix = category ? `REQ-${category.toUpperCase().substring(0, 4)}` : 'REQ'
  
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

  // Filter requirements that start with the prefix
  const existingRequirements = allRequirements.filter(
    (req) => req.requirementId && req.requirementId.startsWith(prefix)
  )

  let maxNumber = 0
  for (const req of existingRequirements) {
    if (req.requirementId) {
      const match = req.requirementId.match(/\d+$/)
      if (match) {
        const num = parseInt(match[0], 10)
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
        comments: {
          orderBy: { createdAt: 'desc' },
        },
        attachments: {
          orderBy: { createdAt: 'desc' },
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
    let finalRequirementId = providedRequirementId
    if (!finalRequirementId) {
      finalRequirementId = await generateRequirementId(projectId, category)
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
      },
      include: {
        parent: {
          select: {
            id: true,
            requirementId: true,
            title: true,
          },
        },
      },
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

    // Check if new requirementId already exists (if being changed)
    if (newRequirementId && newRequirementId !== requirement.requirementId) {
      const existingRequirement = await prisma.requirement.findFirst({
        where: {
          projectId,
          requirementId: newRequirementId,
        },
      })

      if (existingRequirement) {
        return res.status(400).json({
          success: false,
          error: `Requirement ID "${newRequirementId}" already exists in this project`,
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

    const updatedRequirement = await prisma.requirement.update({
      where: { id: requirement.id },
      data: {
        requirementId: newRequirementId,
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
      },
    })

    // Mark downstream trace links as suspect when content changes
    const contentChanged = title !== undefined || description !== undefined || acceptanceCriteria !== undefined
    if (contentChanged) {
      await prisma.traceLink.updateMany({
        where: {
          projectId,
          sourceId: requirement.id,
          sourceType: 'requirement',
        },
        data: {
          isSuspect: true,
        },
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
          let requirementId = reqData.requirementId
          if (!requirementId) {
            requirementId = await generateRequirementId(projectId, reqData.category)
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
