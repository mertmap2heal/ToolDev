import { Router } from 'express'
import {
  register,
  login,
  getCurrentUser,
  changeMyPassword,
  getUsers,
  resetUserPassword,
  updateUserInviteEmail,
  sendUserInvite,
} from '../controllers/auth.controller'
import { authenticateToken } from '../middleware/auth.middleware'

const router = Router()

router.post('/register', register)
router.post('/login', login)
router.get('/me', authenticateToken, getCurrentUser)
router.patch('/me/password', authenticateToken, changeMyPassword)
router.get('/users', authenticateToken, getUsers)
router.put('/users/:userId/password', authenticateToken, resetUserPassword)
router.patch('/users/:userId', authenticateToken, updateUserInviteEmail)
router.post('/users/:userId/send-invite', authenticateToken, sendUserInvite)

export default router
