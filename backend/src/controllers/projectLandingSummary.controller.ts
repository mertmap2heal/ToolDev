// RF-3 (#487) — the project-landing-summary controller.
//
// Thin per the controller -> service boundary (kb/backend-patterns.md): it
// reads the route `:id` (the canonical project id resolved by
// `resolveProjectParam`), delegates to the pure `composeProjectLandingSummary`
// service, and emits the standard `{ success, data }` shape. All batching and
// metric derivation live in the service; tenant scoping is the route's
// `requireProjectMember` middleware.
import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { composeProjectLandingSummary } from '../services/projectLandingSummary.service'

/**
 * GET /api/v1/projects/:id/landing-summary
 *
 * Returns the project-landing aggregate for one project — identity, the five
 * discipline progress bars, the lifecycle gate, owner / team, and the
 * per-module health rows. Membership-scoped by `requireProjectMember`;
 * `resolveProjectParam` resolves a slug or UUID to the canonical `req.params.id`.
 */
export const getProjectLandingSummary = async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.id
    if (!projectId) {
      return res.status(400).json({ success: false, error: 'Project id is required' })
    }

    const data = await composeProjectLandingSummary(projectId)
    if (!data) {
      return res.status(404).json({ success: false, error: 'Project not found' })
    }
    res.json({ success: true, data })
  } catch (error) {
    console.error('Get project landing summary error:', error)
    res
      .status(500)
      .json({ success: false, error: 'Failed to load project landing summary.' })
  }
}
