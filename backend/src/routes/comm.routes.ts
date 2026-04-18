import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
import {
  getBuses, createBus, updateBus, deleteBus,
  getMessages, createMessage, updateMessage, deleteMessage,
  getFields, createField, updateField, deleteField, reorderFields,
} from '../controllers/comm.controller'

// #289: every route carries :projectId so projectIdParam enforces membership
// on the nested bus/message/field tiers. Previously only bus-level routes
// had :projectId — the nested tiers skipped the middleware entirely, which
// allowed cross-project IDOR on messages and fields.
const router = Router()
router.use(authenticateToken)
router.param('projectId', projectIdParam)

// Buses
router.get('/:projectId/buses', getBuses)
router.post('/:projectId/buses', createBus)
router.patch('/:projectId/buses/:id', updateBus)
router.delete('/:projectId/buses/:id', deleteBus)

// Messages (under a bus, scoped to project)
router.get('/:projectId/buses/:busId/messages', getMessages)
router.post('/:projectId/buses/:busId/messages', createMessage)
router.patch('/:projectId/messages/:id', updateMessage)
router.delete('/:projectId/messages/:id', deleteMessage)

// Fields (under a message, scoped to project)
router.get('/:projectId/messages/:messageId/fields', getFields)
router.post('/:projectId/messages/:messageId/fields', createField)
router.put('/:projectId/messages/:messageId/fields/reorder', reorderFields)
router.patch('/:projectId/fields/:id', updateField)
router.delete('/:projectId/fields/:id', deleteField)

export default router
