/**
 * Regression tests for #289 — cross-project IDOR on the Communications
 * nested routes (bus / message / field tiers).
 *
 * Before the fix the nested /comm routes did not carry :projectId, so the
 * projectIdParam membership middleware never fired. Any authenticated user
 * could read, mutate or delete rows in a project they were not a member of
 * by supplying a foreign busId / messageId / fieldId.
 *
 * These tests create two completely independent projects owned by two
 * different users. For each nested endpoint we assert that user A cannot
 * reach user B's rows: membership middleware returns 403 at the URL tier,
 * and the service-layer ownership check returns 404 for any code path
 * that somehow bypasses the middleware.
 *
 * Additionally the suite verifies that:
 *  - deleteMessage / deleteField / reorderFields do NOT mutate rows in the
 *    foreign project (read-after-write assertions).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Communications — cross-project IDOR (#289)', () => {
  const stamp = Date.now()

  let userAId: string
  let userBId: string
  let tokenA: string
  let tokenB: string
  let projectAId: string
  let projectBId: string
  let busAId: string
  let busBId: string
  let msgAId: string
  let msgBId: string
  let fieldAId: string
  let fieldBId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'

    const userA = await prisma.user.create({
      data: { email: `comm-a-${stamp}@example.test`, password: 'hashed', name: 'CommA' },
    })
    userAId = userA.id
    tokenA = jwt.sign({ userId: userA.id }, secret)

    const userB = await prisma.user.create({
      data: { email: `comm-b-${stamp}@example.test`, password: 'hashed', name: 'CommB' },
    })
    userBId = userB.id
    tokenB = jwt.sign({ userId: userB.id }, secret)

    const slugA = `comm-a-${stamp}`
    const slugB = `comm-b-${stamp}`
    const projectA = await prisma.project.create({
      data: { name: `Comm A ${stamp}`, domain: slugA, slug: slugA, userId: userAId },
    })
    projectAId = projectA.id
    const projectB = await prisma.project.create({
      data: { name: `Comm B ${stamp}`, domain: slugB, slug: slugB, userId: userBId },
    })
    projectBId = projectB.id

    const busA = await prisma.commBus.create({
      data: { projectId: projectAId, name: `bus-a-${stamp}`, protocol: 'can' },
    })
    busAId = busA.id
    const busB = await prisma.commBus.create({
      data: { projectId: projectBId, name: `bus-b-${stamp}`, protocol: 'can' },
    })
    busBId = busB.id

    const msgA = await prisma.commMessage.create({
      data: { busId: busAId, name: `msg-a-${stamp}` },
    })
    msgAId = msgA.id
    const msgB = await prisma.commMessage.create({
      data: { busId: busBId, name: `msg-b-${stamp}` },
    })
    msgBId = msgB.id

    const fieldA = await prisma.commField.create({
      data: { messageId: msgAId, fieldName: `field-a-${stamp}`, order: 0 },
    })
    fieldAId = fieldA.id
    const fieldB = await prisma.commField.create({
      data: { messageId: msgBId, fieldName: `field-b-${stamp}`, order: 0 },
    })
    fieldBId = fieldB.id
  })

  afterAll(async () => {
    // Clean up in reverse-dependency order. Best-effort — a failing test
    // may have deleted some rows, but if the fix is correct nothing
    // cross-project was mutated.
    await prisma.commField.deleteMany({ where: { id: { in: [fieldAId, fieldBId] } } }).catch(() => {})
    await prisma.commMessage.deleteMany({ where: { id: { in: [msgAId, msgBId] } } }).catch(() => {})
    await prisma.commBus.deleteMany({ where: { id: { in: [busAId, busBId] } } }).catch(() => {})
    await prisma.project.deleteMany({ where: { id: { in: [projectAId, projectBId] } } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } }).catch(() => {})
    await prisma.$disconnect()
  })

  // Sanity check: owners can reach their own rows.
  it('owner can list their own project buses', async () => {
    const res = await request(app)
      .get(`/api/v1/comm/${projectAId}/buses`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    const ids = (res.body.data as Array<{ id: string }>).map(b => b.id)
    expect(ids).toContain(busAId)
  })

  // 1. Membership middleware rejects foreign projectId.
  it('rejects listing messages under foreign projectId with 403', async () => {
    const res = await request(app)
      .get(`/api/v1/comm/${projectBId}/buses/${busBId}/messages`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect([403, 404]).toContain(res.status)
    expect(res.body.success).toBe(false)
  })

  // 2. Service layer rejects mismatched projectId + busId (attacker uses own
  // project in URL but a foreign busId).
  it('rejects listing foreign bus messages under own projectId with 404', async () => {
    const res = await request(app)
      .get(`/api/v1/comm/${projectAId}/buses/${busBId}/messages`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(404)
    expect(res.body.success).toBe(false)
  })

  // 3. Foreign message update under own projectId rejected.
  it('rejects updating foreign message under own projectId with 404', async () => {
    const before = await prisma.commMessage.findUnique({ where: { id: msgBId } })
    const res = await request(app)
      .patch(`/api/v1/comm/${projectAId}/messages/${msgBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'pwned' })
    expect(res.status).toBe(404)
    const after = await prisma.commMessage.findUnique({ where: { id: msgBId } })
    expect(after!.name).toBe(before!.name)
  })

  // 4. Foreign message delete under own projectId rejected AND row preserved.
  it('rejects deleting foreign message under own projectId with 404 (row preserved)', async () => {
    const res = await request(app)
      .delete(`/api/v1/comm/${projectAId}/messages/${msgBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(404)
    const stillThere = await prisma.commMessage.findUnique({ where: { id: msgBId } })
    expect(stillThere).not.toBeNull()
  })

  // 5. Foreign field update under own projectId rejected.
  it('rejects updating foreign field under own projectId with 404', async () => {
    const before = await prisma.commField.findUnique({ where: { id: fieldBId } })
    const res = await request(app)
      .patch(`/api/v1/comm/${projectAId}/fields/${fieldBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ fieldName: 'pwned' })
    expect(res.status).toBe(404)
    const after = await prisma.commField.findUnique({ where: { id: fieldBId } })
    expect(after!.fieldName).toBe(before!.fieldName)
  })

  // 6. Foreign field delete rejected.
  it('rejects deleting foreign field under own projectId with 404 (row preserved)', async () => {
    const res = await request(app)
      .delete(`/api/v1/comm/${projectAId}/fields/${fieldBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(404)
    const stillThere = await prisma.commField.findUnique({ where: { id: fieldBId } })
    expect(stillThere).not.toBeNull()
  })

  // 7. Reorder with foreign field ids does not mutate foreign field order.
  it('reorderFields ignores field ids not owned by the supplied message+project', async () => {
    const before = await prisma.commField.findUnique({ where: { id: fieldBId } })
    const res = await request(app)
      .put(`/api/v1/comm/${projectAId}/messages/${msgAId}/fields/reorder`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ orderedIds: [fieldBId, fieldAId] })
    expect(res.status).toBe(200)
    const after = await prisma.commField.findUnique({ where: { id: fieldBId } })
    expect(after!.order).toBe(before!.order)
    expect(after!.messageId).toBe(msgBId)
  })

  // 8. Foreign createMessage under own projectId rejected (cannot attach new
  // rows to someone else's bus).
  it('rejects creating a message on a foreign bus with 404', async () => {
    const res = await request(app)
      .post(`/api/v1/comm/${projectAId}/buses/${busBId}/messages`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'should-not-exist' })
    expect(res.status).toBe(404)
    const msgs = await prisma.commMessage.findMany({ where: { busId: busBId } })
    // Only the original seeded message should be under busB.
    expect(msgs.length).toBe(1)
    expect(msgs[0]!.id).toBe(msgBId)
  })
})
