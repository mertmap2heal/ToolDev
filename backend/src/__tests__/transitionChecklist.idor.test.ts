/**
 * Regression tests for #297 — IDOR on transition-checklist controllers.
 *
 * Before the fix, handlers looked up checklists / assignments / comments
 * by id alone and never matched projectId. Any member of any project
 * could read, update, delete, or leak checklists from other tenants
 * by supplying their own projectId in the URL with a foreign checklistId.
 *
 * Two projects owned by two users; every cross-project path must return
 * 404 and leave the foreign row untouched.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Transition checklists — cross-project IDOR (#297)', () => {
  const stamp = Date.now()

  let userAId: string
  let userBId: string
  let tokenA: string
  let tokenB: string
  let projectAId: string
  let projectBId: string
  let checklistAId: string
  let checklistBId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'

    const userA = await prisma.user.create({
      data: { email: `tc-idor-a-${stamp}@example.test`, password: 'x', name: 'A' },
    })
    userAId = userA.id
    tokenA = jwt.sign({ userId: userA.id }, secret)

    const userB = await prisma.user.create({
      data: { email: `tc-idor-b-${stamp}@example.test`, password: 'x', name: 'B' },
    })
    userBId = userB.id
    tokenB = jwt.sign({ userId: userB.id }, secret)

    const slugA = `tc-idor-a-${stamp}`
    const slugB = `tc-idor-b-${stamp}`
    const pA = await prisma.project.create({
      data: { name: `TC A ${stamp}`, domain: slugA, slug: slugA, userId: userAId },
    })
    projectAId = pA.id
    const pB = await prisma.project.create({
      data: { name: `TC B ${stamp}`, domain: slugB, slug: slugB, userId: userBId },
    })
    projectBId = pB.id

    const clA = await prisma.transitionChecklist.create({
      data: { projectId: projectAId, name: `Checklist A ${stamp}` },
    })
    checklistAId = clA.id
    const clB = await prisma.transitionChecklist.create({
      data: { projectId: projectBId, name: `Checklist B ${stamp}` },
    })
    checklistBId = clB.id
  })

  afterAll(async () => {
    await prisma.transitionChecklist.deleteMany({ where: { id: { in: [checklistAId, checklistBId] } } }).catch(() => {})
    await prisma.project.deleteMany({ where: { id: { in: [projectAId, projectBId] } } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('owner can GET their own checklist (sanity)', async () => {
    const res = await request(app)
      .get(`/api/v1/transition-checklists/${projectAId}/checklist/${checklistAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(checklistAId)
  })

  it('GET foreign checklist under own projectId returns 404 (#297)', async () => {
    const res = await request(app)
      .get(`/api/v1/transition-checklists/${projectAId}/checklist/${checklistBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(404)
  })

  it('PUT foreign checklist under own projectId returns 404 and does not mutate (#297)', async () => {
    const before = await prisma.transitionChecklist.findUnique({ where: { id: checklistBId } })
    const res = await request(app)
      .put(`/api/v1/transition-checklists/${projectAId}/checklist/${checklistBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'pwned' })
    expect(res.status).toBe(404)
    const after = await prisma.transitionChecklist.findUnique({ where: { id: checklistBId } })
    expect(after!.name).toBe(before!.name)
  })

  it('DELETE foreign checklist under own projectId returns 404 and preserves the row (#297)', async () => {
    const res = await request(app)
      .delete(`/api/v1/transition-checklists/${projectAId}/checklist/${checklistBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(404)
    const stillThere = await prisma.transitionChecklist.findUnique({ where: { id: checklistBId } })
    expect(stillThere).not.toBeNull()
  })

  it('user B sees their own checklist (sanity, reverse direction)', async () => {
    const res = await request(app)
      .get(`/api/v1/transition-checklists/${projectBId}/checklist/${checklistBId}`)
      .set('Authorization', `Bearer ${tokenB}`)
    expect(res.status).toBe(200)
  })
})
