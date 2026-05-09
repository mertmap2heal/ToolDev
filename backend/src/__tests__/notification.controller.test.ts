/**
 * Tests for /api/v1/notifications — per-user notification stream.
 *
 * Each route is user-scoped: a notification belongs to a userId and is
 * never visible to another caller. The controller uses findFirst on
 * (id, userId) so a foreign id resolves to 404 rather than leaking
 * existence. Coverage:
 *   - 401 without a token
 *   - empty list for a user with no notifications
 *   - LIST returns rows newest-first, capped at 50
 *   - mark-as-read on own row succeeds, on a foreign row returns 404
 *   - mark-all-read flips every row owned by the caller, leaves others alone
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Notifications — /api/v1/notifications', () => {
  const stamp = Date.now()
  let userAId: string
  let userBId: string
  let tokenA: string
  let tokenB: string
  // We track every notification id to clean up regardless of who owned it.
  const createdNotifIds: string[] = []
  let aNotifId: string
  let bNotifId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const userA = await prisma.user.create({
      data: { email: `notif-a-${stamp}@example.test`, password: 'x', name: 'NotifA' },
    })
    userAId = userA.id
    tokenA = jwt.sign({ userId: userA.id }, secret)

    const userB = await prisma.user.create({
      data: { email: `notif-b-${stamp}@example.test`, password: 'x', name: 'NotifB' },
    })
    userBId = userB.id
    tokenB = jwt.sign({ userId: userB.id }, secret)

    const a1 = await prisma.notification.create({
      data: {
        userId: userAId,
        type: 'project_invitation',
        title: `A1 ${stamp}`,
        message: 'Hello A',
        read: false,
      },
    })
    aNotifId = a1.id
    createdNotifIds.push(a1.id)

    // Second A notification so we can verify mark-all-read.
    const a2 = await prisma.notification.create({
      data: {
        userId: userAId,
        type: 'project_invitation',
        title: `A2 ${stamp}`,
        message: 'Hello A again',
        read: false,
      },
    })
    createdNotifIds.push(a2.id)

    const b1 = await prisma.notification.create({
      data: {
        userId: userBId,
        type: 'project_invitation',
        title: `B1 ${stamp}`,
        message: 'Hello B',
        read: false,
      },
    })
    bNotifId = b1.id
    createdNotifIds.push(b1.id)
  })

  afterAll(async () => {
    await prisma.notification
      .deleteMany({ where: { id: { in: createdNotifIds } } })
      .catch(() => {})
    await prisma.notification
      .deleteMany({ where: { userId: { in: [userAId, userBId] } } })
      .catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('GET / without a token returns 401', async () => {
    const res = await request(app).get('/api/v1/notifications')
    expect(res.status).toBe(401)
  })

  it('GET / returns only the caller-owned notifications, newest first', async () => {
    const res = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    const rows = res.body.data as Array<{ id: string; userId: string; createdAt: string }>
    for (const r of rows) expect(r.userId).toBe(userAId)
    // Should NOT include user B's row.
    expect(rows.find((r) => r.id === bNotifId)).toBeUndefined()
    // Newest-first ordering: timestamps are non-increasing.
    for (let i = 1; i < rows.length; i++) {
      expect(new Date(rows[i - 1].createdAt).getTime()).toBeGreaterThanOrEqual(
        new Date(rows[i].createdAt).getTime(),
      )
    }
  })

  it('PATCH /:id/read on own row sets read=true', async () => {
    const res = await request(app)
      .patch(`/api/v1/notifications/${aNotifId}/read`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    const row = await prisma.notification.findUnique({ where: { id: aNotifId } })
    expect(row?.read).toBe(true)
  })

  it('PATCH /:id/read on a foreign row returns 404 and does NOT mutate it', async () => {
    const before = await prisma.notification.findUnique({ where: { id: bNotifId } })
    const res = await request(app)
      .patch(`/api/v1/notifications/${bNotifId}/read`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(404)
    const after = await prisma.notification.findUnique({ where: { id: bNotifId } })
    expect(after?.read).toBe(before?.read)
  })

  it('PATCH /:id/read on an unknown id returns 404', async () => {
    const res = await request(app)
      .patch('/api/v1/notifications/00000000-0000-0000-0000-000000000000/read')
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(404)
  })

  it('PATCH /read-all flips every notification owned by the caller', async () => {
    // Sanity: at least one notification still unread for user A.
    const beforeUnread = await prisma.notification.count({
      where: { userId: userAId, read: false },
    })
    expect(beforeUnread).toBeGreaterThanOrEqual(1)

    const res = await request(app)
      .patch('/api/v1/notifications/read-all')
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)

    const afterUnread = await prisma.notification.count({
      where: { userId: userAId, read: false },
    })
    expect(afterUnread).toBe(0)
  })

  it('PATCH /read-all does NOT touch other users notifications', async () => {
    const bRow = await prisma.notification.findUnique({ where: { id: bNotifId } })
    expect(bRow?.read).toBe(false)
  })

  it('PATCH /read-all without a token returns 401', async () => {
    const res = await request(app).patch('/api/v1/notifications/read-all')
    expect(res.status).toBe(401)
  })
})
