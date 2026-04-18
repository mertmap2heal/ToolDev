/**
 * Regression tests for #293 — syncPBSToComponents trusted client-supplied
 * ids and parentIds.
 *
 * Pre-fix: a member of project A could sync a node whose parentId pointed
 * at a component in project B, silently linking two tenants' PBS trees.
 * Supplying a foreign component's id in the create branch produced a
 * unique-constraint error that leaked the existence of that foreign id.
 *
 * Post-fix:
 *   - parentId must resolve inside the same project (or inside the batch).
 *   - new node ids must not collide with components in any other project.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('PBS sync — cross-project validation (#293)', () => {
  const stamp = Date.now()

  let userAId: string
  let userBId: string
  let tokenA: string
  let projectAId: string
  let projectBId: string
  let foreignComponentId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const userA = await prisma.user.create({
      data: { email: `pbs-a-${stamp}@example.test`, password: 'x', name: 'A' },
    })
    userAId = userA.id
    tokenA = jwt.sign({ userId: userA.id }, secret)

    const userB = await prisma.user.create({
      data: { email: `pbs-b-${stamp}@example.test`, password: 'x', name: 'B' },
    })
    userBId = userB.id

    const slugA = `pbs-a-${stamp}`
    const slugB = `pbs-b-${stamp}`
    const pA = await prisma.project.create({
      data: { name: `PBS A ${stamp}`, domain: slugA, slug: slugA, userId: userAId },
    })
    projectAId = pA.id
    const pB = await prisma.project.create({
      data: { name: `PBS B ${stamp}`, domain: slugB, slug: slugB, userId: userBId },
    })
    projectBId = pB.id

    await prisma.projectMember.createMany({
      data: [
        { projectId: projectAId, userId: userAId, role: 'owner', status: 'accepted' },
        { projectId: projectBId, userId: userBId, role: 'owner', status: 'accepted' },
      ],
    })

    const foreignComp = await prisma.component.create({
      data: {
        projectId: projectBId,
        name: `Foreign B ${stamp}`,
      },
    })
    foreignComponentId = foreignComp.id
  })

  afterAll(async () => {
    await prisma.component.deleteMany({ where: { projectId: { in: [projectAId, projectBId] } } }).catch(() => {})
    await prisma.projectMember.deleteMany({ where: { projectId: { in: [projectAId, projectBId] } } }).catch(() => {})
    await prisma.project.deleteMany({ where: { id: { in: [projectAId, projectBId] } } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('rejects sync with a parentId pointing at a foreign-project component (#293)', async () => {
    const newId = randomUUID()
    const res = await request(app)
      .post(`/api/v1/projects/${projectAId}/components/sync-pbs`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        nodes: [
          {
            id: newId,
            parentId: foreignComponentId, // belongs to project B
            name: 'trying to reparent',
          },
        ],
      })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/parentId/i)
    // Nothing created in project A.
    const created = await prisma.component.findFirst({ where: { id: newId } })
    expect(created).toBeNull()
  })

  it('rejects sync that tries to claim a foreign-project component id (#293)', async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectAId}/components/sync-pbs`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        nodes: [
          {
            id: foreignComponentId, // exists in project B
            name: 'id-hijack attempt',
          },
        ],
      })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/collision/i)
    // Foreign component still belongs to project B untouched.
    const foreign = await prisma.component.findUnique({ where: { id: foreignComponentId } })
    expect(foreign!.projectId).toBe(projectBId)
    expect(foreign!.name).toContain(`Foreign B ${stamp}`)
  })

  it('accepts sync with parentId pointing to a node created in the same batch', async () => {
    const rootId = randomUUID()
    const childId = randomUUID()
    const res = await request(app)
      .post(`/api/v1/projects/${projectAId}/components/sync-pbs`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        nodes: [
          { id: rootId, parentId: null, name: `root-${stamp}` },
          { id: childId, parentId: rootId, name: `child-${stamp}` },
        ],
      })
    expect(res.status).toBe(200)
    const root = await prisma.component.findUnique({ where: { id: rootId } })
    const child = await prisma.component.findUnique({ where: { id: childId } })
    expect(root!.projectId).toBe(projectAId)
    expect(child!.parentId).toBe(rootId)
  })
})
