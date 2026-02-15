import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'

const router = Router()

router.use(authenticateToken)

// Placeholder routes for lifecycle to prevent 404s
// The frontend service falls back to Zustand store if these return empty or 404,
// but explicit 200 OK with empty data is cleaner.

router.get('/library', async (req, res) => {
    res.json({
        success: true,
        data: [], // Empty list
    })
})

router.get('/applicable', async (req, res) => {
    // Return success: false or empty data to trigger frontend fallback
    res.json({
        success: true,
        data: null,
    })
})

router.get('/transitions', async (req, res) => {
    res.json({
        success: true,
        data: { transitions: [] },
    })
})

export default router
