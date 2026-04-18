import { Router } from 'express'
import {
  register,
  login,
  forgotPassword,
  getCurrentUser,
  changeMyPassword,
  updateMyProfile,
  getUsers,
  createAdminUser,
  resetUserPassword,
  updateUserInviteEmail,
  sendUserInvite,
} from '../controllers/auth.controller'
import { authenticateToken } from '../middleware/auth.middleware'
import rateLimit from 'express-rate-limit'

// Tighter limit for credential endpoints — 10 attempts per 15-minute window (#36)
const credentialLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many attempts — please try again in 15 minutes.' },
  skip: () => process.env.NODE_ENV === 'test',
})

// Slightly looser limit for account-management endpoints (password reset, invite) (#36)
const accountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests — please try again later.' },
  skip: () => process.env.NODE_ENV === 'test',
})

const router = Router()

router.post('/register', credentialLimiter, register)
router.post('/login', credentialLimiter, login)
router.post('/forgot-password', credentialLimiter, forgotPassword)
router.get('/me', authenticateToken, getCurrentUser)
router.patch('/me/password', authenticateToken, changeMyPassword)
router.patch('/me/profile', authenticateToken, updateMyProfile)
router.get('/users', authenticateToken, getUsers)
router.post('/users', authenticateToken, createAdminUser)
router.put('/users/:userId/password', authenticateToken, accountLimiter, resetUserPassword)
router.patch('/users/:userId', authenticateToken, accountLimiter, updateUserInviteEmail)
router.post('/users/:userId/send-invite', authenticateToken, accountLimiter, sendUserInvite)

export default router
