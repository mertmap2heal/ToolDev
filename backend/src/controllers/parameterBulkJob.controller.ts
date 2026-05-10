import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { submitJob, getJob, listRecentJobs } from '../services/parameterBulkJob.service'

/**
 * Controller for the async parameters bulk-job runner.
 *
 * Routes (mounted under /api/v1/parameters):
 *   POST   /:projectId/bulk-jobs           submit a new job, returns id
 *   GET    /:projectId/bulk-jobs/:jobId    poll status + per-item results
 *   GET    /:projectId/bulk-jobs           recent 20 jobs (history view)
 */

export async function submit(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId
    if (!userId) {
      res.status(401).json({ success: false, error: 'unauthenticated' })
      return
    }
    const { operation, payload } = req.body as {
      operation?: 'bulk-delete' | 'bulk-status-change'
      payload?: Record<string, unknown>
    }
    if (!operation || !payload) {
      res.status(400).json({ success: false, error: 'operation + payload required' })
      return
    }
    const ids = (payload as { ids?: unknown }).ids
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ success: false, error: 'payload.ids[] required' })
      return
    }
    const job = await submitJob({
      projectId: req.params.projectId,
      submittedBy: userId,
      operation,
      payload,
      totalItems: ids.length,
    })
    res.status(202).json({ success: true, data: { id: job.id, status: job.status } })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}

export async function get(req: AuthRequest, res: Response) {
  try {
    const job = await getJob(req.params.jobId, req.params.projectId)
    if (!job) {
      res.status(404).json({ success: false, error: 'job not found' })
      return
    }
    res.json({ success: true, data: job })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}

export async function list(req: AuthRequest, res: Response) {
  try {
    const jobs = await listRecentJobs(req.params.projectId)
    res.json({ success: true, data: jobs })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}
