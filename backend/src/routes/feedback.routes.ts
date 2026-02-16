import express from 'express'
import { submitFeedback } from '../controllers/feedback.controller.js'
import { authenticateToken } from '../middleware/auth.middleware.js'

const router = express.Router()

// Optional authentication - if helpful to know who sent it
router.post('/', authenticateToken, submitFeedback)

export default router
