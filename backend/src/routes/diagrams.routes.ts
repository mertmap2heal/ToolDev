import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import {
  getDiagrams,
  getDiagram,
  createDiagram,
  updateDiagram,
  deleteDiagram,
  getDiagramsByElement,
  saveDiagramLayout,
} from '../controllers/diagram.controller'

const router = Router()

/**
 * Diagram Routes
 * All routes are protected by authentication middleware
 */

// Get all diagrams for a project
router.get('/:projectId', authenticateToken, getDiagrams)

// Get diagrams linked to a specific element
router.get('/:projectId/element/:elementType/:elementId', authenticateToken, getDiagramsByElement)

// Get a single diagram
router.get('/:projectId/:diagramId', authenticateToken, getDiagram)

// Create a new diagram
router.post('/:projectId', authenticateToken, createDiagram)

// Update a diagram
router.put('/:projectId/:diagramId', authenticateToken, updateDiagram)

// Save diagram layout
router.put('/:projectId/:diagramId/layout', authenticateToken, saveDiagramLayout)

// Delete a diagram
router.delete('/:projectId/:diagramId', authenticateToken, deleteDiagram)

export default router
