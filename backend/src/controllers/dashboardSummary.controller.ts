// RF-2 (#484) — the dashboard-summary controller.
//
// Thin per the controller -> service boundary (kb/backend-patterns.md): it
// reads `req.userId`, delegates to the pure `composeDashboardSummary` service,
// and emits the standard `{ success, data }` shape. All batching, scoping and
// metric derivation live in the service.
import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { composeDashboardSummary } from '../services/dashboardSummary.service'

/**
 * GET /api/v1/projects/dashboard-summary
 *
 * Returns the portfolio dashboard aggregate for the authenticated caller —
 * KPIs, per-project roll-ups, the caller's pending-action queue, and the
 * recent activity feed. Visibility-scoped to the caller's accessible projects
 * (owner OR accepted team member); `authenticateToken` guarantees `req.userId`.
 */
export const getDashboardSummary = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const data = await composeDashboardSummary(userId)
    res.json({ success: true, data })
  } catch (error) {
    console.error('Get dashboard summary error:', error)
    res.status(500).json({ success: false, error: 'Failed to load dashboard summary.' })
  }
}
