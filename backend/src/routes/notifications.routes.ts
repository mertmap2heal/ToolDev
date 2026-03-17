import { Router } from 'express'
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../controllers/notification.controller'
import { authenticateToken } from '../middleware/auth.middleware'

const router = Router()

router.use(authenticateToken)

router.get('/', getNotifications)
router.patch('/:id/read', markNotificationRead)
router.patch('/read-all', markAllNotificationsRead)

export default router
