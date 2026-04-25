import { prisma } from '../lib/prisma'

/**
 * Asynchronous bulk-ops runner for the Parameters page.
 *
 * Why async: a synchronous "delete N parameters" request blocks the
 * HTTP connection for as long as the loop takes, and a write-heavy
 * job (e.g. 5000 deletes with cascading audit-log writes) easily hits
 * the proxy timeout. Submitting a job + polling status decouples the
 * UI from server-side processing time.
 *
 * Pattern:
 *   1. Controller writes a pending row to ParameterBulkJob and returns
 *      immediately with the job id.
 *   2. The worker (started once at boot) polls every 2s, picks the
 *      oldest `pending` job, marks it `running`, processes each item,
 *      writes per-item results, and marks the job `completed | failed
 *      | partial` at the end.
 *   3. The frontend polls GET /:projectId/bulk-jobs/:jobId every 1s
 *      until the status leaves the running family.
 *
 * Operations supported in v1:
 *   - "bulk-delete"        payload: { ids: string[] }
 *   - "bulk-status-change" payload: { ids: string[], status: string }
 */

export type BulkOperation = 'bulk-delete' | 'bulk-status-change'

export async function submitJob(args: {
  projectId: string
  submittedBy: string
  operation: BulkOperation
  payload: Record<string, unknown>
  totalItems: number
}) {
  return prisma.parameterBulkJob.create({
    data: {
      projectId: args.projectId,
      submittedBy: args.submittedBy,
      operation: args.operation,
      payload: args.payload as object,
      status: 'pending',
      totalItems: args.totalItems,
    },
  })
}

export async function getJob(jobId: string, projectId: string) {
  return prisma.parameterBulkJob.findFirst({
    where: { id: jobId, projectId },
  })
}

export async function listRecentJobs(projectId: string, limit = 20) {
  return prisma.parameterBulkJob.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

let workerStarted = false
let workerHandle: NodeJS.Timeout | null = null

/**
 * Starts the singleton worker loop. Safe to call repeatedly — no-op
 * after the first call.
 */
export function startBulkJobWorker(intervalMs = 2_000) {
  if (workerStarted) return
  workerStarted = true
  workerHandle = setInterval(() => {
    void processOneJob().catch((e) => {
      // Don't crash the loop; surface to stderr so server logs pick it up.
      // eslint-disable-next-line no-console
      console.error('[bulk-job worker] error', e)
    })
  }, intervalMs)
}

export function stopBulkJobWorker() {
  if (workerHandle) {
    clearInterval(workerHandle)
    workerHandle = null
  }
  workerStarted = false
}

async function processOneJob() {
  // Atomically pick + mark running. Optimistic update via where=status='pending'.
  const candidate = await prisma.parameterBulkJob.findFirst({
    where: { status: 'pending' },
    orderBy: { createdAt: 'asc' },
  })
  if (!candidate) return
  // Best-effort claim — if another worker beat us, updateMany returns 0.
  const claim = await prisma.parameterBulkJob.updateMany({
    where: { id: candidate.id, status: 'pending' },
    data: { status: 'running', startedAt: new Date() },
  })
  if (claim.count === 0) return
  const job = await prisma.parameterBulkJob.findUniqueOrThrow({ where: { id: candidate.id } })
  const results: Array<{ id: string; status: 'ok' | 'error'; error?: string }> = []
  let done = 0
  let failed = 0

  try {
    if (job.operation === 'bulk-delete') {
      const ids = (job.payload as { ids?: string[] }).ids ?? []
      // Process in batches of 50 so one bad row doesn't fail the whole job.
      for (const id of ids) {
        try {
          await prisma.parameter.delete({ where: { id } })
          results.push({ id, status: 'ok' })
          done++
        } catch (e) {
          results.push({ id, status: 'error', error: (e as Error).message })
          failed++
        }
        // Persist progress every 25 items so the frontend poller sees movement.
        if ((done + failed) % 25 === 0) {
          await prisma.parameterBulkJob.update({
            where: { id: job.id },
            data: { doneItems: done, failedItems: failed },
          })
        }
      }
    } else if (job.operation === 'bulk-status-change') {
      const payload = job.payload as { ids?: string[]; status?: string }
      const ids = payload.ids ?? []
      const newStatus = payload.status ?? 'draft'
      for (const id of ids) {
        try {
          await prisma.parameter.update({
            where: { id },
            data: { status: newStatus },
          })
          results.push({ id, status: 'ok' })
          done++
        } catch (e) {
          results.push({ id, status: 'error', error: (e as Error).message })
          failed++
        }
        if ((done + failed) % 25 === 0) {
          await prisma.parameterBulkJob.update({
            where: { id: job.id },
            data: { doneItems: done, failedItems: failed },
          })
        }
      }
    } else {
      throw new Error(`Unsupported operation: ${job.operation}`)
    }

    const finalStatus = failed === 0 ? 'completed' : done === 0 ? 'failed' : 'partial'
    await prisma.parameterBulkJob.update({
      where: { id: job.id },
      data: {
        status: finalStatus,
        doneItems: done,
        failedItems: failed,
        itemResults: results,
        completedAt: new Date(),
      },
    })
  } catch (e) {
    await prisma.parameterBulkJob.update({
      where: { id: job.id },
      data: {
        status: 'failed',
        doneItems: done,
        failedItems: failed,
        itemResults: results,
        completedAt: new Date(),
      },
    })
    throw e
  }
}
