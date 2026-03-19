import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
import {
  getBuses, createBus, updateBus, deleteBus,
  getMessages, createMessage, updateMessage, deleteMessage,
  getFields, createField, updateField, deleteField, reorderFields,
} from '../controllers/comm.controller'

const router = Router()
router.use(authenticateToken)
router.param('projectId', projectIdParam)

// Buses
router.get('/:projectId/buses', getBuses)
router.post('/:projectId/buses', createBus)
router.patch('/:projectId/buses/:id', updateBus)
router.delete('/:projectId/buses/:id', deleteBus)

// Messages (under a bus)
router.get('/buses/:busId/messages', getMessages)
router.post('/buses/:busId/messages', createMessage)
router.patch('/messages/:id/buses/:busId', updateMessage)
router.delete('/messages/:id', deleteMessage)

// Fields (under a message)
router.get('/messages/:messageId/fields', getFields)
router.post('/messages/:messageId/fields', createField)
router.put('/messages/:messageId/fields/reorder', reorderFields)
router.patch('/fields/:id', updateField)
router.delete('/fields/:id', deleteField)

export default router
