import express from 'express'
import {
  getComponentTree,
  getComponent,
  getOrCreateRootComponent,
  createComponent,
  updateComponent,
  deleteComponent,
  syncPBSToComponents,
} from '../controllers/component.controller'
import { authenticateToken } from '../middleware/auth.middleware'

const router = express.Router()

router.use(authenticateToken)

/**
 * Component Routes (PBS - Product Breakdown Structure)
 * 
 * All routes are scoped to a project via :projectId parameter
 */

// GET /api/projects/:projectId/components - Get component tree for a project
router.get('/:projectId/components', getComponentTree)

// GET /api/projects/:projectId/components/root - Get or create root component (MPAC)
router.get('/:projectId/components/root', getOrCreateRootComponent)

// GET /api/projects/:projectId/components/:componentId - Get single component
router.get('/:projectId/components/:componentId', getComponent)

// POST /api/projects/:projectId/components - Create new component
router.post('/:projectId/components', createComponent)

// PUT /api/projects/:projectId/components/:componentId - Update component
router.put('/:projectId/components/:componentId', updateComponent)

// DELETE /api/projects/:projectId/components/:componentId - Delete component
// Query param: ?reassignTo=<componentId> to reassign children/artifacts
router.delete('/:projectId/components/:componentId', deleteComponent)

// POST /api/projects/:projectId/components/sync-pbs - Sync PBS localStorage to components
router.post('/:projectId/components/sync-pbs', syncPBSToComponents)

export default router
