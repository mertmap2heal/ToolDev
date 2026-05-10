import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

/**
 * Guards the function -> pbs_component allocation sync against the
 * sequential per-link delete N+1. Seeds N stale `allocated_to` trace
 * links for one function and re-allocates; the controller must
 * delete them in capped-parallel rather than serially.
 *
 *   PERF_FN_LINKS - number of stale links to seed (default 30)
 *   PERF_FN_MS    - budget for the PATCH (default 8000)
 */

const PERF = !!process.env.RUN_PERF_TESTS
const COUNT = Number(process.env.PERF_FN_LINKS ?? 30)
const BUDGET_MS = Number(process.env.PERF_FN_MS ?? 8000)

describe.runIf(PERF)('Function -> Component allocation sync — perf guard', () => {
  const stamp = Date.now()
  let userId: string
  let token: string
  let projectId: string
  let functionId: string
  let componentId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const user = await prisma.user.create({
      data: { email: `fn-perf-${stamp}@example.test`, password: 'x', name: 'Fn Perf' },
    })
    userId = user.id
    token = jwt.sign({ userId }, secret)

    const slug = `fn-perf-${stamp}`
    const project = await prisma.project.create({
      data: { name: `Fn Perf ${stamp}`, domain: slug, slug, userId },
    })
    projectId = project.id

    const fn = await prisma.systemFunction.create({
      data: { projectId, name: `Fn ${stamp}`, description: 'perf' },
    })
    functionId = fn.id

    const comp = await prisma.component.create({
      data: { projectId, name: `Comp ${stamp}` },
    })
    componentId = comp.id

    const links = Array.from({ length: COUNT }, (_, i) => ({
      projectId,
      sourceType: 'function',
      sourceId: functionId,
      targetType: 'pbs_component',
      targetId: `stale-${stamp}-${i}`,
      linkType: 'allocated_to',
    }))
    await prisma.traceLink.createMany({ data: links })
  }, 60_000)

  afterAll(async () => {
    await prisma.traceLink.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.component.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.systemFunction.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
  }, 60_000)

  it(
    `re-assigns component on a function with ${COUNT} stale links in under ${BUDGET_MS}ms`,
    async () => {
      const t0 = process.hrtime.bigint()
      const res = await request(app)
        .patch(`/api/v1/functions/${projectId}/${functionId}/component`)
        .set('Authorization', `Bearer ${token}`)
        .send({ componentId })
      const ms = Number(process.hrtime.bigint() - t0) / 1_000_000

      // eslint-disable-next-line no-console
      console.log(`[perf] function/component sync over ${COUNT} stale links: ${ms.toFixed(0)}ms`)
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(ms).toBeLessThan(BUDGET_MS)

      const remaining = await prisma.traceLink.findMany({
        where: {
          projectId,
          sourceType: 'function',
          sourceId: functionId,
          targetType: 'pbs_component',
          linkType: 'allocated_to',
        },
        select: { targetId: true },
      })
      expect(remaining.length).toBe(1)
      expect(remaining[0].targetId).toBe(componentId)
    },
    120_000,
  )

  it(
    `clearing component (componentId=null) deletes the link without re-create`,
    async () => {
      const t0 = process.hrtime.bigint()
      const res = await request(app)
        .patch(`/api/v1/functions/${projectId}/${functionId}/component`)
        .set('Authorization', `Bearer ${token}`)
        .send({ componentId: null })
      const ms = Number(process.hrtime.bigint() - t0) / 1_000_000

      // eslint-disable-next-line no-console
      console.log(`[perf] function/component clear: ${ms.toFixed(0)}ms`)
      expect(res.status).toBe(200)
      expect(ms).toBeLessThan(BUDGET_MS)

      const remaining = await prisma.traceLink.count({
        where: {
          projectId,
          sourceType: 'function',
          sourceId: functionId,
          linkType: 'allocated_to',
        },
      })
      expect(remaining).toBe(0)
    },
    120_000,
  )
})
