import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma'
import { buildRequirementChangeSummary, notifyRequirementSubscribers } from '../services/requirementNotification.service'


/**
 * Get all components for a project as a tree structure
 */
export const getComponentTree = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    })

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      })
    }

    // Get all components for this project
    const components = await prisma.component.findMany({
      where: { projectId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })

    // Build tree structure
    const buildTree = (parentId: string | null): any[] => {
      return components
        .filter((c) => c.parentId === parentId)
        .map((c) => ({
          ...c,
          isRoot: c.parentId === null,
          children: buildTree(c.id),
        }))
    }

    const tree = buildTree(null)

    res.json({
      success: true,
      data: tree,
    })
  } catch (error) {
    console.error('Get component tree error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

/**
 * Get a single component by ID
 */
export const getComponent = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, componentId } = req.params

    const component = await prisma.component.findFirst({
      where: {
        id: componentId,
        projectId,
      },
      include: {
        children: {
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
        parent: true,
      },
    })

    if (!component) {
      return res.status(404).json({
        success: false,
        error: 'Component not found',
      })
    }

    res.json({
      success: true,
      data: {
        ...component,
        isRoot: component.parentId === null,
      },
    })
  } catch (error) {
    console.error('Get component error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

/**
 * Get or create the root component (MPAC) for a project
 */
export const getOrCreateRootComponent = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    })

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      })
    }

    // Check for existing root component
    let rootComponent = await prisma.component.findFirst({
      where: {
        projectId,
        parentId: null,
      },
      include: {
        children: {
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
    })

    // Create root component if it doesn't exist
    if (!rootComponent) {
      rootComponent = await prisma.component.create({
        data: {
          projectId,
          parentId: null,
          name: 'MPAC',
          description: `Root component for ${project.name}`,
          sortOrder: 0,
        },
        include: {
          children: true,
        },
      })
    }

    res.json({
      success: true,
      data: {
        ...rootComponent,
        isRoot: true,
      },
    })
  } catch (error) {
    console.error('Get/create root component error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

/**
 * Create a new component
 */
export const createComponent = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { parentId, name, description, sortOrder } = req.body

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Name is required',
      })
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    })

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      })
    }

    // If parentId is provided, verify it exists and belongs to this project
    if (parentId) {
      const parentComponent = await prisma.component.findFirst({
        where: {
          id: parentId,
          projectId,
        },
      })

      if (!parentComponent) {
        return res.status(404).json({
          success: false,
          error: 'Parent component not found',
        })
      }
    } else {
      // If no parentId, check if we're trying to create another root component
      const existingRoot = await prisma.component.findFirst({
        where: {
          projectId,
          parentId: null,
        },
      })

      if (existingRoot) {
        return res.status(400).json({
          success: false,
          error: 'A root component (MPAC) already exists for this project. New components must have a parent.',
        })
      }
    }

    // Get the max sortOrder for siblings
    const maxSortOrder = await prisma.component.aggregate({
      where: {
        projectId,
        parentId: parentId || null,
      },
      _max: {
        sortOrder: true,
      },
    })

    const component = await prisma.component.create({
      data: {
        projectId,
        parentId: parentId || null,
        name,
        description,
        sortOrder: sortOrder ?? (maxSortOrder._max.sortOrder ?? 0) + 1,
      },
      include: {
        parent: true,
        children: true,
      },
    })

    res.status(201).json({
      success: true,
      data: {
        ...component,
        isRoot: component.parentId === null,
      },
    })
  } catch (error) {
    console.error('Create component error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

/**
 * Update a component
 */
export const updateComponent = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, componentId } = req.params
    const { name, description, parentId, sortOrder } = req.body

    // Verify component exists and belongs to project
    const existingComponent = await prisma.component.findFirst({
      where: {
        id: componentId,
        projectId,
      },
    })

    if (!existingComponent) {
      return res.status(404).json({
        success: false,
        error: 'Component not found',
      })
    }

    // Don't allow changing root component's parentId
    if (existingComponent.parentId === null && parentId !== undefined && parentId !== null) {
      return res.status(400).json({
        success: false,
        error: 'Cannot change the parent of the root component (MPAC)',
      })
    }

    // If changing parentId, verify the new parent exists
    if (parentId !== undefined && parentId !== null) {
      // Prevent setting a component as its own parent
      if (parentId === componentId) {
        return res.status(400).json({
          success: false,
          error: 'A component cannot be its own parent',
        })
      }

      const newParent = await prisma.component.findFirst({
        where: {
          id: parentId,
          projectId,
        },
      })

      if (!newParent) {
        return res.status(404).json({
          success: false,
          error: 'New parent component not found',
        })
      }

      // Prevent circular references - check if new parent is a descendant
      const isDescendant = await checkIsDescendant(componentId, parentId)
      if (isDescendant) {
        return res.status(400).json({
          success: false,
          error: 'Cannot set a descendant as the parent (would create circular reference)',
        })
      }
    }

    const component = await prisma.component.update({
      where: { id: componentId },
      data: {
        name,
        description,
        parentId: parentId !== undefined ? parentId : undefined,
        sortOrder,
      },
      include: {
        parent: true,
        children: {
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
    })

    res.json({
      success: true,
      data: {
        ...component,
        isRoot: component.parentId === null,
      },
    })
  } catch (error) {
    console.error('Update component error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

/**
 * Delete a component and optionally reassign its children and artifacts
 */
export const deleteComponent = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, componentId } = req.params
    const { reassignTo } = req.query // Optional: componentId to reassign children/artifacts to

    // Verify component exists and belongs to project
    const component = await prisma.component.findFirst({
      where: {
        id: componentId,
        projectId,
      },
      include: {
        children: true,
      },
    })

    if (!component) {
      return res.status(404).json({
        success: false,
        error: 'Component not found',
      })
    }

    // Don't allow deleting the root component
    if (component.parentId === null) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete the root component (MPAC)',
      })
    }

    // If there are children and no reassignment target, reject
    if (component.children.length > 0 && !reassignTo) {
      return res.status(400).json({
        success: false,
        error: 'Component has children. Please specify reassignTo parameter or delete children first.',
      })
    }

    // If reassignment target specified, verify it exists and update children
    if (reassignTo && typeof reassignTo === 'string') {
      const targetComponent = await prisma.component.findFirst({
        where: {
          id: reassignTo,
          projectId,
        },
      })

      if (!targetComponent) {
        return res.status(404).json({
          success: false,
          error: 'Reassignment target component not found',
        })
      }

      // Move children to the target component
      await prisma.component.updateMany({
        where: { parentId: componentId },
        data: { parentId: reassignTo },
      })

      // Move all artifacts to target component (requirements, functions, etc.)
      // This updates all componentId references from this component to the target
      await reassignArtifacts(componentId, reassignTo, req.userId)
    }

    // Delete the component
    await prisma.component.delete({
      where: { id: componentId },
    })

    res.json({
      success: true,
      message: 'Component deleted successfully',
    })
  } catch (error) {
    console.error('Delete component error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

/**
 * Helper function to check if targetId is a descendant of componentId
 */
async function checkIsDescendant(componentId: string, targetId: string): Promise<boolean> {
  const children = await prisma.component.findMany({
    where: { parentId: componentId },
  })

  for (const child of children) {
    if (child.id === targetId) {
      return true
    }
    const isDesc = await checkIsDescendant(child.id, targetId)
    if (isDesc) {
      return true
    }
  }

  return false
}

/**
 * Helper function to reassign component artifacts from one component to another.
 * Moves child components and any associated requirements.
 */
async function reassignArtifacts(
  fromComponentId: string,
  toComponentId: string,
  actorUserId?: string
): Promise<void> {
  await prisma.component.updateMany({
    where: { parentId: fromComponentId },
    data: { parentId: toComponentId },
  })

  // Reassign requirements from the deleted component to the target component
  const affectedRequirements = await prisma.requirement.findMany({
    where: { componentId: fromComponentId },
  })

  await prisma.requirement.updateMany({
    where: { componentId: fromComponentId },
    data: { componentId: toComponentId },
  })

  if (affectedRequirements.length > 0) {
    const updatedRequirements = await prisma.requirement.findMany({
      where: { id: { in: affectedRequirements.map((req) => req.id) } },
    })
    const updatedById = new Map(updatedRequirements.map((req) => [req.id, req]))

    await Promise.all(
      affectedRequirements.map(async (before) => {
        const after = updatedById.get(before.id)
        if (!after) return
        const changes = buildRequirementChangeSummary(before as any, after as any)
        await notifyRequirementSubscribers({
          projectId: after.projectId,
          requirementId: before.id,
          actorUserId,
          changes,
          requirementSnapshot: {
            id: after.id,
            requirementId: after.requirementId,
            title: after.title,
          },
        })
      })
    )
  }
}

/**
 * Ensure root component exists for a project (used when migrating existing projects)
 */
export const ensureRootComponent = async (projectId: string): Promise<string> => {
  // Check for existing root component
  let rootComponent = await prisma.component.findFirst({
    where: {
      projectId,
      parentId: null,
    },
  })

  // Create root component if it doesn't exist
  if (!rootComponent) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    })

    rootComponent = await prisma.component.create({
      data: {
        projectId,
        parentId: null,
        name: 'MPAC',
        description: project ? `Root component for ${project.name}` : 'Root component',
        sortOrder: 0,
      },
    })
  }

  return rootComponent.id
}

/**
 * Sync PBS nodes from localStorage into the component table.
 * Accepts an array of PBS nodes and upserts them as components,
 * preserving the hierarchy via parentId.
 */
export const syncPBSToComponents = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { nodes } = req.body // PBSNode[] from localStorage

    if (!Array.isArray(nodes)) {
      return res.status(400).json({
        success: false,
        error: 'nodes array is required',
      })
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    })

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      })
    }

    // Get existing components for this project
    const existingComponents = await prisma.component.findMany({
      where: { projectId },
    })
    const existingIds = new Set(existingComponents.map((c) => c.id))

    // #293: all supplied node ids + parentIds must resolve inside the
    // current project. Collect the complete allowed-id set (existing
    // project components + ids being created in this same batch) so
    // parentId validation works for both pre-existing and newly-created
    // parents within the same sync call.
    const incomingNodeIds = new Set(nodes.map((n: any) => String(n.id)))
    const allowedIds = new Set<string>([...existingIds, ...incomingNodeIds])

    for (const node of nodes) {
      if (node.parentId && !allowedIds.has(String(node.parentId))) {
        return res.status(400).json({
          success: false,
          error: `parentId ${node.parentId} is not a component of this project`,
        })
      }

      // #293: if the node id is new, verify it does not collide with an
      // existing component in ANY project (Component.id is globally
      // unique). Collisions would otherwise leak existence of foreign
      // components via Prisma's unique-constraint 409/P2002.
      if (!existingIds.has(node.id)) {
        const clash = await prisma.component.findUnique({
          where: { id: node.id },
          select: { id: true, projectId: true },
        })
        if (clash && clash.projectId !== projectId) {
          return res.status(400).json({
            success: false,
            error: 'Component id collision with a foreign project',
          })
        }
      }
    }

    // Process nodes: create or update each one
    for (const node of nodes) {
      const data = {
        projectId,
        parentId: node.parentId || null,
        name: node.name || 'Unnamed',
        pbsCode: node.pbsCode || null,
        description: node.description || null,
        sortOrder: node.orderIndex ?? 0,
      }

      if (existingIds.has(node.id)) {
        // Update existing component
        await prisma.component.update({
          where: { id: node.id },
          data: {
            name: data.name,
            pbsCode: data.pbsCode,
            description: data.description,
            parentId: data.parentId,
            sortOrder: data.sortOrder,
          },
        })
      } else {
        // Create new component with the same ID as the PBS node
        await prisma.component.create({
          data: {
            id: node.id,
            ...data,
          },
        })
      }
    }

    // Return the updated tree
    const components = await prisma.component.findMany({
      where: { projectId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })

    const buildTree = (parentId: string | null): any[] => {
      return components
        .filter((c) => c.parentId === parentId)
        .map((c) => ({
          ...c,
          isRoot: c.parentId === null,
          children: buildTree(c.id),
        }))
    }

    res.json({
      success: true,
      data: buildTree(null),
    })
  } catch (error) {
    console.error('Sync PBS to components error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}
