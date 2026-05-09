/**
 * Regression: parameter bulk-job worker must NOT operate on parameters
 * outside the job's own projectId. Without scoping, a project-A member
 * could submit a delete/status-change job whose payload.ids referenced
 * project-B parameters and the worker would mutate them blindly.
 *
 * See HIGH-1 in this session's security review.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'
import { processOneJob } from '../services/parameterBulkJob.service'

describe('parameterBulkJob — cross-tenant payload (HIGH-1)', () => {
  const stamp = Date.now()
  let userAId: string
  let userBId: string
  let projectAId: string
  let projectBId: string
  let foreignParameterId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const userA = await prisma.user.create({
      data: { email: `pbulk-a-${stamp}@example.test`, password: 'x', name: 'A' },
    })
    userAId = userA.id
    jwt.sign({ userId: userA.id }, secret) // token unused — we drive the worker directly

    const userB = await prisma.user.create({
      data: { email: `pbulk-b-${stamp}@example.test`, password: 'x', name: 'B' },
    })
    userBId = userB.id

    const slugA = `pbulk-a-${stamp}`
    const slugB = `pbulk-b-${stamp}`
    const pA = await prisma.project.create({
      data: { name: `PBulk A ${stamp}`, domain: slugA, slug: slugA, userId: userAId },
    })
    projectAId = pA.id
    const pB = await prisma.project.create({
      data: { name: `PBulk B ${stamp}`, domain: slugB, slug: slugB, userId: userBId },
    })
    projectBId = pB.id

    const foreign = await prisma.parameter.create({
      data: {
        projectId: projectBId,
        name: `param_b_${stamp}`,
        parameterId: 'PARAM-B-001',
        status: 'approved',
      },
    })
    foreignParameterId = foreign.id
  })

  afterAll(async () => {
    await prisma.parameterBulkJob
      .deleteMany({ where: { projectId: { in: [projectAId, projectBId] } } })
      .catch(() => {})
    await prisma.parameter
      .deleteMany({ where: { projectId: { in: [projectAId, projectBId] } } })
      .catch(() => {})
    await prisma.project
      .deleteMany({ where: { id: { in: [projectAId, projectBId] } } })
      .catch(() => {})
    await prisma.user
      .deleteMany({ where: { id: { in: [userAId, userBId] } } })
      .catch(() => {})
  })

  it('bulk-delete with a foreign parameter id reports per-item error and leaves the row intact', async () => {
    // Project A submits a delete job whose payload.ids includes a project-B id.
    const job = await prisma.parameterBulkJob.create({
      data: {
        projectId: projectAId,
        submittedBy: userAId,
        operation: 'bulk-delete',
        status: 'pending',
        totalItems: 1,
        payload: { ids: [foreignParameterId] },
      },
    })

    await processOneJob()

    const after = await prisma.parameter.findUnique({ where: { id: foreignParameterId } })
    expect(after).not.toBeNull()
    expect(after?.projectId).toBe(projectBId)

    const finished = await prisma.parameterBulkJob.findUnique({ where: { id: job.id } })
    // Status surfaces as 'failed' when every item errored, 'partial' when
    // some succeeded, 'completed' when all succeeded — accept any terminal
    // state. Only the row-state contract matters for the security claim.
    expect(['done', 'completed', 'partial', 'failed']).toContain(finished?.status)
    expect(finished?.failedItems).toBe(1)
    expect(finished?.doneItems).toBe(0)
    const results =
      (finished?.itemResults as Array<{ id: string; status: string; error?: string }> | null) ?? []
    expect(results[0]?.status).toBe('error')
    expect(results[0]?.error).toMatch(/not in this project/i)
  })

  it('bulk-status-change with a foreign parameter id does not mutate the foreign row', async () => {
    const beforeRow = await prisma.parameter.findUnique({ where: { id: foreignParameterId } })
    const beforeStatus = beforeRow?.status

    const job = await prisma.parameterBulkJob.create({
      data: {
        projectId: projectAId,
        submittedBy: userAId,
        operation: 'bulk-status-change',
        status: 'pending',
        totalItems: 1,
        payload: { ids: [foreignParameterId], status: 'obsolete' },
      },
    })

    await processOneJob()

    const after = await prisma.parameter.findUnique({ where: { id: foreignParameterId } })
    expect(after?.status).toBe(beforeStatus)

    const finished = await prisma.parameterBulkJob.findUnique({ where: { id: job.id } })
    expect(finished?.failedItems).toBe(1)
  })
})
