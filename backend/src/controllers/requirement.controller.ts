import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Helper function to generate requirement ID
async function generateRequirementId(projectId: string, category?: string): Promise<string> {
  const prefix = category ? `REQ-${category.toUpperCase().substring(0, 4)}` : 'REQ'
  
  // Find the highest number for this prefix
  const existingRequirements = await prisma.requirement.findMany({
    where: {
      projectId,
      requirementId: {
        startsWith: prefix,
      },
    },
    select: {
      requirementId: true,
    },
  })

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
