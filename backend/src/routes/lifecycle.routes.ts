import { Router, Request, Response } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware'
import { requireProjectMember } from '../middleware/requireProjectMember.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
import { lifecycleControlTowerService } from '../services/lifecycleControlTower.service'
import {
    listLibrary,
    getApplicableLifecycle,
    listTransitions,
    createLifecycleDefinition,
    updateLifecycleDefinition,
    deleteLifecycleDefinition,
} from '../controllers/lifecycle.controller'

const router = Router()

router.use(authenticateToken)

// ═══════════════════════════════════════════════════════════════════════════
// CONTROL TOWER ENDPOINTS — Isolated lifecycle monitoring & governance
// ═══════════════════════════════════════════════════════════════════════════
//
// Security (issue #164): every tenant-scoped endpoint requires project
// membership. projectId is taken from the URL path (never query string),
// resolved through projectIdParam (supports UUID and slug), then guarded by
// requireProjectMember which returns 403 for non-members.
// ═══════════════════════════════════════════════════════════════════════════

// Global (no project scope) — kept auth-only.
router.get('/control-tower/benchmarks', async (_req: Request, res: Response) => {
    try {
        const data = await lifecycleControlTowerService.getBenchmarks()
        res.json({ success: true, data })
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// Register :projectId resolver on the parent router so it fires for the
// sub-router's merged params as well.
router.param('projectId', projectIdParam)

// Project-scoped sub-router: all routes below require membership on :projectId.
const ctProject = Router({ mergeParams: true })
ctProject.use(requireProjectMember)

ctProject.get('/overview', async (req: AuthRequest, res: Response) => {
    try {
        const { projectId } = req.params
        const data = await lifecycleControlTowerService.getOverview(projectId)
        res.json({ success: true, data })
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message })
    }
})

ctProject.get('/trends', async (req: AuthRequest, res: Response) => {
    try {
        const { projectId } = req.params
        const days = parseInt(req.query.days as string) || 30
        const data = await lifecycleControlTowerService.getTrends(projectId, days)
        res.json({ success: true, data })
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message })
    }
})

ctProject.get('/heatmap', async (req: AuthRequest, res: Response) => {
    try {
        const { projectId } = req.params
        const data = await lifecycleControlTowerService.getHeatmap(projectId)
        res.json({ success: true, data })
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// Legacy flat path.
ctProject.get('/function-health', async (req: AuthRequest, res: Response) => {
    try {
        const { projectId } = req.params
        const data = await lifecycleControlTowerService.getFunctionHealth(projectId)
        res.json({ success: true, data })
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// Frontend-matching path.
ctProject.get('/health/functions', async (req: AuthRequest, res: Response) => {
    try {
        const { projectId } = req.params
        const data = await lifecycleControlTowerService.getFunctionHealth(projectId)
        res.json({ success: true, data })
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message })
    }
})

ctProject.get('/pbs-health', async (req: AuthRequest, res: Response) => {
    try {
        const { projectId } = req.params
        const data = await lifecycleControlTowerService.getPBSHealth(projectId)
        res.json({ success: true, data })
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message })
    }
})

ctProject.get('/health/pbs', async (req: AuthRequest, res: Response) => {
    try {
        const { projectId } = req.params
        const data = await lifecycleControlTowerService.getPBSHealth(projectId)
        res.json({ success: true, data })
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message })
    }
})

ctProject.get('/traceability', async (req: AuthRequest, res: Response) => {
    try {
        const { projectId } = req.params
        const page = parseInt(req.query.page as string) || 1
        const limit = parseInt(req.query.limit as string) || 50
        const data = await lifecycleControlTowerService.getTraceabilityTable(projectId, page, limit)
        res.json({ success: true, data })
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message })
    }
})

ctProject.get('/sla-breaches', async (req: AuthRequest, res: Response) => {
    try {
        const { projectId } = req.params
        const data = await lifecycleControlTowerService.getSlaBreaches(projectId)
        res.json({ success: true, data })
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message })
    }
})

ctProject.get('/sla/breaches', async (req: AuthRequest, res: Response) => {
    try {
        const { projectId } = req.params
        const data = await lifecycleControlTowerService.getSlaBreaches(projectId)
        res.json({ success: true, data })
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message })
    }
})

ctProject.get('/anomalies', async (req: AuthRequest, res: Response) => {
    try {
        const { projectId } = req.params
        const data = await lifecycleControlTowerService.getAnomalies(projectId)
        res.json({ success: true, data })
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message })
    }
})

ctProject.get('/integrity-violations', async (req: AuthRequest, res: Response) => {
    try {
        const { projectId } = req.params
        const data = await lifecycleControlTowerService.getIntegrityViolations(projectId)
        res.json({ success: true, data })
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message })
    }
})

ctProject.get('/integrity', async (req: AuthRequest, res: Response) => {
    try {
        const { projectId } = req.params
        const data = await lifecycleControlTowerService.getIntegrityViolations(projectId)
        res.json({ success: true, data })
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message })
    }
})

ctProject.get('/readiness', async (req: AuthRequest, res: Response) => {
    try {
        const { projectId } = req.params
        const data = await lifecycleControlTowerService.getReadinessScore(projectId)
        res.json({ success: true, data })
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message })
    }
})

ctProject.get('/pending-approvals', async (req: AuthRequest, res: Response) => {
    try {
        const { projectId } = req.params
        const data = await lifecycleControlTowerService.getPendingApprovals(projectId)
        res.json({ success: true, data })
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message })
    }
})

ctProject.get('/approvals/pending', async (req: AuthRequest, res: Response) => {
    try {
        const { projectId } = req.params
        const data = await lifecycleControlTowerService.getPendingApprovals(projectId)
        res.json({ success: true, data })
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message })
    }
})

ctProject.get('/audit-trail', async (req: AuthRequest, res: Response) => {
    try {
        const { projectId } = req.params
        const page = parseInt(req.query.page as string) || 1
        const limit = parseInt(req.query.limit as string) || 50
        const data = await lifecycleControlTowerService.getAuditTrail(projectId, page, limit)
        res.json({ success: true, data })
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message })
    }
})

ctProject.get('/audit', async (req: AuthRequest, res: Response) => {
    try {
        const { projectId } = req.params
        const page = parseInt(req.query.page as string) || 1
        const limit = parseInt(req.query.limit as string) || 50
        const data = await lifecycleControlTowerService.getAuditTrail(projectId, page, limit)
        res.json({ success: true, data })
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message })
    }
})

// Mount the project-scoped sub-router. Any path on /control-tower/:projectId
// goes through requireProjectMember before hitting a handler.
router.use('/control-tower/:projectId', ctProject)

// ═══════════════════════════════════════════════════════════════════════════
// LIFECYCLE DEFINITION ENDPOINTS — model-backed library + writes (NX-11 #474)
// ═══════════════════════════════════════════════════════════════════════════
//
// Replaces the former placeholder stubs. Project-scoped per N-3: projectId is
// a URL path segment (never a query string), resolved by the projectIdParam
// router.param handler registered above, then guarded by requireProjectMember.
// Reads return the shared catalogue + this project's own custom lifecycles;
// writes only ever touch project-custom rows (the service raises 403 for a
// catalogue lifecycle). Mounted AFTER /control-tower so the literal
// 'control-tower' segment is never captured as a projectId.
// ═══════════════════════════════════════════════════════════════════════════

const lifecycleDef = Router({ mergeParams: true })
lifecycleDef.use(requireProjectMember)

// Reads
lifecycleDef.get('/library', listLibrary)
lifecycleDef.get('/applicable', getApplicableLifecycle)
lifecycleDef.get('/transitions', listTransitions)

// Writes — project-custom lifecycles only
lifecycleDef.post('/definitions', createLifecycleDefinition)
lifecycleDef.put('/definitions/:lifecycleId', updateLifecycleDefinition)
lifecycleDef.delete('/definitions/:lifecycleId', deleteLifecycleDefinition)

router.use('/:projectId', lifecycleDef)

export default router
