import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { lifecycleControlTowerService } from '../services/lifecycleControlTower.service'

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

// ═══════════════════════════════════════════════════════════════════════════
// CONTROL TOWER ENDPOINTS — Isolated lifecycle monitoring & governance
// ═══════════════════════════════════════════════════════════════════════════

router.get('/control-tower/overview', async (req, res) => {
    try {
        const projectId = (req.query.projectId as string) ?? 'default'
        const data = await lifecycleControlTowerService.getOverview(projectId)
        res.json({ success: true, data })
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message })
    }
})

router.get('/control-tower/trends', async (req, res) => {
    try {
        const projectId = (req.query.projectId as string) ?? 'default'
        const days = parseInt(req.query.days as string) || 30
        const data = await lifecycleControlTowerService.getTrends(projectId, days)
        res.json({ success: true, data })
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message })
    }
})

router.get('/control-tower/heatmap', async (req, res) => {
    try {
        const projectId = (req.query.projectId as string) ?? 'default'
        const data = await lifecycleControlTowerService.getHeatmap(projectId)
        res.json({ success: true, data })
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message })
    }
})

router.get('/control-tower/function-health', async (req, res) => {
    try {
        const projectId = (req.query.projectId as string) ?? 'default'
        const data = await lifecycleControlTowerService.getFunctionHealth(projectId)
        res.json({ success: true, data })
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message })
    }
})

router.get('/control-tower/pbs-health', async (req, res) => {
    try {
        const projectId = (req.query.projectId as string) ?? 'default'
        const data = await lifecycleControlTowerService.getPBSHealth(projectId)
        res.json({ success: true, data })
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message })
    }
})

router.get('/control-tower/traceability', async (req, res) => {
    try {
        const projectId = (req.query.projectId as string) ?? 'default'
        const page = parseInt(req.query.page as string) || 1
        const limit = parseInt(req.query.limit as string) || 50
        const data = await lifecycleControlTowerService.getTraceabilityTable(projectId, page, limit)
        res.json({ success: true, data })
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message })
    }
})

router.get('/control-tower/sla-breaches', async (req, res) => {
    try {
        const projectId = (req.query.projectId as string) ?? 'default'
        const data = await lifecycleControlTowerService.getSlaBreaches(projectId)
        res.json({ success: true, data })
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message })
    }
})

router.get('/control-tower/anomalies', async (req, res) => {
    try {
        const projectId = (req.query.projectId as string) ?? 'default'
        const data = await lifecycleControlTowerService.getAnomalies(projectId)
        res.json({ success: true, data })
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message })
    }
})

router.get('/control-tower/integrity-violations', async (req, res) => {
    try {
        const projectId = (req.query.projectId as string) ?? 'default'
        const data = await lifecycleControlTowerService.getIntegrityViolations(projectId)
        res.json({ success: true, data })
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message })
    }
})

router.get('/control-tower/readiness', async (req, res) => {
    try {
        const projectId = (req.query.projectId as string) ?? 'default'
        const data = await lifecycleControlTowerService.getReadinessScore(projectId)
        res.json({ success: true, data })
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message })
    }
})

router.get('/control-tower/pending-approvals', async (req, res) => {
    try {
        const projectId = (req.query.projectId as string) ?? 'default'
        const data = await lifecycleControlTowerService.getPendingApprovals(projectId)
        res.json({ success: true, data })
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message })
    }
})

router.get('/control-tower/audit-trail', async (req, res) => {
    try {
        const projectId = (req.query.projectId as string) ?? 'default'
        const page = parseInt(req.query.page as string) || 1
        const limit = parseInt(req.query.limit as string) || 50
        const data = await lifecycleControlTowerService.getAuditTrail(projectId, page, limit)
        res.json({ success: true, data })
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message })
    }
})

router.get('/control-tower/benchmarks', async (req, res) => {
    try {
        const data = await lifecycleControlTowerService.getBenchmarks()
        res.json({ success: true, data })
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message })
    }
})

export default router
