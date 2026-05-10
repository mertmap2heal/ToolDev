import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
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
 *
 * Auth runs FIRST (router.use), THEN projectIdParam fires when the
 * `:projectId` token resolves. Reversing this order — `router.param`
 * before `router.use(authenticateToken)` — caused every request to
 * 401 because Express runs param middleware before per-route
 * middleware, so `req.userId` was undefined when `projectIdParam`
 * called `userCanAccessProject`.
 */
router.use(authenticateToken)
router.param('projectId', projectIdParam)

// Get all diagrams for a project
router.get('/:projectId', getDiagrams)

// Get diagrams linked to a specific element
router.get('/:projectId/element/:elementType/:elementId', getDiagramsByElement)

// Get a single diagram
router.get('/:projectId/:diagramId', getDiagram)

// Create a new diagram
router.post('/:projectId', createDiagram)

// Update a diagram
router.put('/:projectId/:diagramId', updateDiagram)

// Save diagram layout
router.put('/:projectId/:diagramId/layout', saveDiagramLayout)

// Delete a diagram
router.delete('/:projectId/:diagramId', deleteDiagram)

export default router
