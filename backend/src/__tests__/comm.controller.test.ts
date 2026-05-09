/**
 * Tests for /api/v1/comm/:projectId — communication buses, messages, and
 * fields.
 *
 * Covers the happy-path CRUD flow on top of the IDOR guards already
 * exercised by `comm.idor.test.ts`.
 *
 * Coverage:
 *   - 401 unauthenticated, 403 outsider on list buses
 *   - Bus: create (validate name+protocol), list, update, delete
 *   - Message: create under a bus (validate name), list, update, delete
 *   - Field: create under a message (validate fieldName), list, reorder,
 *     update, delete
 *   - Reorder validates orderedIds is an array
 *   - Update unknown bus/message/field returns 404
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Communication API — /api/v1/comm', () => {
  const stamp = Date.now()
  let ownerId: string
  let outsiderId: string
  let tokenOwner: string
  let tokenOutsider: string
  let projectId: string
  let busId: string
  let messageId: string
  let fieldId: string
  let secondFieldId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const owner = await prisma.user.create({
      data: { email: `cm-o-${stamp}@example.test`, password: 'x', name: 'Owner' },
    })
    ownerId = owner.id
    tokenOwner = jwt.sign({ userId: owner.id }, secret)

    const outsider = await prisma.user.create({
      data: { email: `cm-x-${stamp}@example.test`, password: 'x', name: 'Outsider' },
    })
    outsiderId = outsider.id
    tokenOutsider = jwt.sign({ userId: outsider.id }, secret)

    const slug = `cm-${stamp}`
    const p = await prisma.project.create({
      data: { name: `Cm ${stamp}`, domain: slug, slug, userId: ownerId },
    })
    projectId = p.id
  })

  afterAll(async () => {
    await prisma.commField.deleteMany({ where: { message: { bus: { projectId } } } }).catch(() => {})
    await prisma.commMessage.deleteMany({ where: { bus: { projectId } } }).catch(() => {})
    await prisma.commBus.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.deleteMany({ where: { id: projectId } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, outsiderId] } } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('GET buses without a token returns 401', async () => {
    const res = await request(app).get(`/api/v1/comm/${projectId}/buses`)
    expect(res.status).toBe(401)
  })

  it('GET buses by an outsider returns 403', async () => {
    const res = await request(app)
      .get(`/api/v1/comm/${projectId}/buses`)
      .set('Authorization', `Bearer ${tokenOutsider}`)
    expect(res.status).toBe(403)
  })

  it('GET buses on a fresh project returns []', async () => {
    const res = await request(app)
      .get(`/api/v1/comm/${projectId}/buses`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })

  it('POST bus without name+protocol returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/comm/${projectId}/buses`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ name: 'only name' })
    expect(res.status).toBe(400)
  })

  it('POST bus creates one', async () => {
    const res = await request(app)
      .post(`/api/v1/comm/${projectId}/buses`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({
        name: `CAN bus ${stamp}`,
        protocol: 'can',
        description: 'main vehicle bus',
        config: { baudrate: 500000 },
      })
    expect(res.status).toBe(201)
    busId = res.body.data.id
  })

  it('PATCH bus updates description', async () => {
    const res = await request(app)
      .patch(`/api/v1/comm/${projectId}/buses/${busId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ description: 'updated' })
    expect(res.status).toBe(200)
    expect(res.body.data.description).toBe('updated')
  })

  it('PATCH unknown bus returns 404', async () => {
    const res = await request(app)
      .patch(`/api/v1/comm/${projectId}/buses/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ description: 'no such' })
    expect(res.status).toBe(404)
  })

  // Messages

  it('POST message without name returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/comm/${projectId}/buses/${busId}/messages`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ direction: 'publish' })
    expect(res.status).toBe(400)
  })

  it('POST message creates one under a bus', async () => {
    const res = await request(app)
      .post(`/api/v1/comm/${projectId}/buses/${busId}/messages`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({
        name: `Heartbeat ${stamp}`,
        messageId: '0x100',
        direction: 'publish',
        description: 'node heartbeat',
      })
    expect(res.status).toBe(201)
    messageId = res.body.data.id
  })

  it('GET messages for the bus returns the new message', async () => {
    const res = await request(app)
      .get(`/api/v1/comm/${projectId}/buses/${busId}/messages`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBe(1)
  })

  it('PATCH message updates direction', async () => {
    const res = await request(app)
      .patch(`/api/v1/comm/${projectId}/messages/${messageId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ direction: 'subscribe' })
    expect(res.status).toBe(200)
    expect(res.body.data.direction).toBe('subscribe')
  })

  it('PATCH unknown message returns 404', async () => {
    const res = await request(app)
      .patch(`/api/v1/comm/${projectId}/messages/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ direction: 'send' })
    expect(res.status).toBe(404)
  })

  // Fields

  it('POST field without fieldName returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/comm/${projectId}/messages/${messageId}/fields`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ dataType: 'uint8' })
    expect(res.status).toBe(400)
  })

  it('POST creates a field', async () => {
    const a = await request(app)
      .post(`/api/v1/comm/${projectId}/messages/${messageId}/fields`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ fieldName: `counter_${stamp}`, dataType: 'uint8', order: 0 })
    expect(a.status).toBe(201)
    fieldId = a.body.data.id

    const b = await request(app)
      .post(`/api/v1/comm/${projectId}/messages/${messageId}/fields`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ fieldName: `temperature_${stamp}`, dataType: 'float', order: 1 })
    expect(b.status).toBe(201)
    secondFieldId = b.body.data.id
  })

  it('GET fields for a message returns the rows', async () => {
    const res = await request(app)
      .get(`/api/v1/comm/${projectId}/messages/${messageId}/fields`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBe(2)
  })

  it('PUT reorder rejects non-array body', async () => {
    const res = await request(app)
      .put(`/api/v1/comm/${projectId}/messages/${messageId}/fields/reorder`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ orderedIds: 'not-an-array' })
    expect(res.status).toBe(400)
  })

  it('PUT reorder updates field order', async () => {
    const res = await request(app)
      .put(`/api/v1/comm/${projectId}/messages/${messageId}/fields/reorder`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ orderedIds: [secondFieldId, fieldId] })
    expect(res.status).toBe(200)
  })

  it('PATCH field updates dataType', async () => {
    const res = await request(app)
      .patch(`/api/v1/comm/${projectId}/fields/${fieldId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ dataType: 'uint16' })
    expect(res.status).toBe(200)
    expect(res.body.data.dataType).toBe('uint16')
  })

  it('PATCH unknown field returns 404', async () => {
    const res = await request(app)
      .patch(`/api/v1/comm/${projectId}/fields/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ dataType: 'int8' })
    expect(res.status).toBe(404)
  })

  it('DELETE field removes it', async () => {
    const res = await request(app)
      .delete(`/api/v1/comm/${projectId}/fields/${fieldId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
  })

  it('DELETE unknown field returns 404', async () => {
    const res = await request(app)
      .delete(`/api/v1/comm/${projectId}/fields/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(404)
  })

  it('DELETE message removes it', async () => {
    const res = await request(app)
      .delete(`/api/v1/comm/${projectId}/messages/${messageId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
  })

  it('DELETE bus removes it', async () => {
    const res = await request(app)
      .delete(`/api/v1/comm/${projectId}/buses/${busId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    const gone = await prisma.commBus.findUnique({ where: { id: busId } })
    expect(gone).toBeNull()
  })
})
