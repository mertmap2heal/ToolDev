import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Diagram Controller
 * Provides CRUD operations for MBSE diagrams stored in the database.
 * Diagrams can be linked to source elements via traceability links.
 */

/**
 * Get all diagrams for a project
 */
export const getDiagrams = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params

    const diagrams = await prisma.diagram.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })

    res.json({ success: true, data: diagrams })
  } catch (error) {
    console.error('Error fetching diagrams:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch diagrams' })
  }
}

/**
 * Get a single diagram by ID
 */
export const getDiagram = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, diagramId } = req.params

    const diagram = await prisma.diagram.findFirst({
      where: {
        id: diagramId,
        projectId,
      },
    })

    if (!diagram) {
      return res.status(404).json({ success: false, error: 'Diagram not found' })
    }

    res.json({ success: true, data: diagram })
  } catch (error) {
    console.error('Error fetching diagram:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch diagram' })
  }
}

/**
 * Create a new diagram
 */
export const createDiagram = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const {
      diagramType,
      name,
      description,
      sourceElementId,
      sourceElementType,
      layout,
      createTraceLink,
    } = req.body

    // Validate required fields
    if (!diagramType || !name) {
      return res.status(400).json({ success: false, error: 'Diagram type and name are required' })
    }

    // Validate diagram type
    const validTypes = ['req', 'bdd', 'ibd', 'par', 'par-req', 'act', 'seq', 'stm', 'uc', 'pkg']
    if (!validTypes.includes(diagramType)) {
      return res.status(400).json({ success: false, error: 'Invalid diagram type' })
    }

    // Create the diagram
    const diagram = await prisma.diagram.create({
      data: {
        projectId,
        diagramType,
        name,
        description,
        sourceElementId,
        sourceElementType,
        layout: layout || null,
      },
    })

    // Optionally create a trace link to the source element
    if (createTraceLink && sourceElementId && sourceElementType) {
      await prisma.traceLink.create({
        data: {
          projectId,
          sourceType: sourceElementType,
          sourceId: sourceElementId,
          targetType: 'diagram',
          targetId: diagram.id,
          linkType: 'derives',
          rationale: `Diagram created from ${sourceElementType}`,
          isAuto: true,
        },
      })
    }

    res.status(201).json({ success: true, data: diagram })
  } catch (error) {
    console.error('Error creating diagram:', error)
    res.status(500).json({ success: false, error: 'Failed to create diagram' })
  }
}

/**
 * Update an existing diagram
 */
export const updateDiagram = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, diagramId } = req.params
    const { name, description, layout } = req.body

    // Verify diagram exists and belongs to project
    const existingDiagram = await prisma.diagram.findFirst({
      where: {
        id: diagramId,
        projectId,
      },
    })

    if (!existingDiagram) {
      return res.status(404).json({ success: false, error: 'Diagram not found' })
    }

    // Build update data
    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (layout !== undefined) updateData.layout = layout

    const diagram = await prisma.diagram.update({
      where: { id: diagramId },
      data: updateData,
    })

    res.json({ success: true, data: diagram })
  } catch (error) {
    console.error('Error updating diagram:', error)
    res.status(500).json({ success: false, error: 'Failed to update diagram' })
  }
}

/**
 * Delete a diagram
 */
export const deleteDiagram = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, diagramId } = req.params

    // Verify diagram exists and belongs to project
    const existingDiagram = await prisma.diagram.findFirst({
      where: {
        id: diagramId,
        projectId,
      },
    })

    if (!existingDiagram) {
      return res.status(404).json({ success: false, error: 'Diagram not found' })
    }

    // Delete associated trace links first
    await prisma.traceLink.deleteMany({
      where: {
        OR: [
          { targetType: 'diagram', targetId: diagramId },
          { sourceType: 'diagram', sourceId: diagramId },
        ],
      },
    })

    // Delete the diagram
    await prisma.diagram.delete({
      where: { id: diagramId },
    })

    res.json({ success: true, message: 'Diagram deleted successfully' })
  } catch (error) {
    console.error('Error deleting diagram:', error)
    res.status(500).json({ success: false, error: 'Failed to delete diagram' })
  }
}

/**
 * Get diagrams linked to a specific element
 */
export const getDiagramsByElement = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, elementType, elementId } = req.params

    // Find diagrams directly linked
    const directDiagrams = await prisma.diagram.findMany({
      where: {
        projectId,
        sourceElementId: elementId,
        sourceElementType: elementType,
      },
      orderBy: { createdAt: 'desc' },
    })

    // Find diagrams linked via trace links
    const traceLinks = await prisma.traceLink.findMany({
      where: {
        projectId,
        OR: [
          { sourceType: elementType, sourceId: elementId, targetType: 'diagram' },
          { targetType: elementType, targetId: elementId, sourceType: 'diagram' },
        ],
      },
    })

    const traceLinkDiagramIds = traceLinks.map((link) =>
      link.sourceType === 'diagram' ? link.sourceId : link.targetId
    )

    const linkedDiagrams = await prisma.diagram.findMany({
      where: {
        id: { in: traceLinkDiagramIds },
        projectId,
      },
      orderBy: { createdAt: 'desc' },
    })

    // Combine and deduplicate
    const allDiagrams = [...directDiagrams]
    for (const diagram of linkedDiagrams) {
      if (!allDiagrams.find((d) => d.id === diagram.id)) {
        allDiagrams.push(diagram)
      }
    }

    res.json({ success: true, data: allDiagrams })
  } catch (error) {
    console.error('Error fetching diagrams by element:', error)
    res.status(500).json({ success: false, error: 'Failed to fetch diagrams' })
  }
}

/**
 * Save diagram layout (node positions, zoom, etc.)
 */
export const saveDiagramLayout = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, diagramId } = req.params
    const { layout } = req.body

    // Verify diagram exists
    const existingDiagram = await prisma.diagram.findFirst({
      where: {
        id: diagramId,
        projectId,
      },
    })

    if (!existingDiagram) {
      return res.status(404).json({ success: false, error: 'Diagram not found' })
    }

    const diagram = await prisma.diagram.update({
      where: { id: diagramId },
      data: { layout },
    })

    res.json({ success: true, data: diagram })
  } catch (error) {
    console.error('Error saving diagram layout:', error)
    res.status(500).json({ success: false, error: 'Failed to save diagram layout' })
  }
}
