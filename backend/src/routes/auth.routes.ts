import { Router } from 'express'
import { register, login, getCurrentUser, getUsers, resetUserPassword } from '../controllers/auth.controller'
import { authenticateToken } from '../middleware/auth.middleware'

const router = Router()

router.post('/register', register)
router.post('/login', login)
router.get('/me', authenticateToken, getCurrentUser)
router.get('/users', authenticateToken, getUsers)
router.put('/users/:userId/password', authenticateToken, resetUserPassword)

export default router
