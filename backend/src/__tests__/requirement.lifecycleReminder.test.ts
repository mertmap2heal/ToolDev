/**
 * Lifecycle transition reminder endpoint (#Batch8).
 *
 * Covers:
 *   POST /requirements/:projectId/:requirementId/lifecycle-transition-reminder
 *
 * Asserts:
 *   - 401 without auth
 *   - 400 when toStatusId or allowedEngineeringRoleIds missing
 *   - 400 when allowedEngineeringRoleIds is empty
 *   - 404 when requirement not found
 *   - 400 when none of the requested roleIds are valid (do not exist)
 *   - 200 with notifiedCount=0 when no project members hold those roles
 *   - 200 with notifiedCount=N when assigned engineers exist
 *   - actor is excluded from notification recipients
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Lifecycle transition reminder', () => {
  const stamp = Date.now()
  let actorId: string
  let actorToken: string
  let recipientId: string
  let projectId: string
  let requirementDbId: string
  let roleId: string
  let toStatusId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const actor = await prisma.user.create({
      data: {
        email: `req-life-actor-${stamp}@example.com`,
        password: 'hashed',
        name: 'Actor',
      },
    })
    actorId = actor.id
    actorToken = jwt.sign({ userId: actorId }, secret)

    const recipient = await prisma.user.create({
      data: {
        email: `req-life-rcpt-${stamp}@example.com`,
        password: 'hashed',
        name: 'Recipient',
      },
    })
    recipientId = recipient.id

    const slug = `req-life-${stamp}`
    const project = await prisma.project.create({
      data: { name: `Life Project ${stamp}`, domain: slug, slug, userId: actorId },
    })
    projectId = project.id

    await prisma.projectMember.createMany({
      data: [
        { projectId, userId: actorId, role: 'owner', status: 'accepted' },
        { projectId, userId: recipientId, role: 'member', status: 'accepted' },
      ],
    })

    const req = await prisma.requirement.create({
      data: {
        projectId,
        title: 'Lifecycle Test',
        description: '',
        status: 'draft',
        priority: 'medium',
        stage: '',
        requirementId: `LIFE-${stamp}-1`,
      },
    })
    requirementDbId = req.id

    const role = await prisma.engineeringRole.create({
      data: {
        name: `Tester-${stamp}`,
      },
    })
    roleId = role.id

    // Assign the recipient to the role on this project
    await prisma.projectUserEngineeringRole.create({
      data: { projectId, userId: recipientId, roleId },
    })

    // Use a dummy uuid as toStatusId since validation only checks string non-empty
    toStatusId = '00000000-0000-0000-0000-000000000abc'
  })

  afterAll(async () => {
    await prisma.notification
      .deleteMany({ where: { userId: { in: [actorId, recipientId] } } })
      .catch(() => {})
    await prisma.projectUserEngineeringRole
      .deleteMany({ where: { projectId } })
      .catch(() => {})
    await prisma.engineeringRole.delete({ where: { id: roleId } }).catch(() => {})
    await prisma.requirement.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.projectMember.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [actorId, recipientId] } } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post(
        `/api/v1/requirements/${projectId}/${requirementDbId}/lifecycle-transition-reminder`
      )
      .send({ toStatusId, allowedEngineeringRoleIds: [roleId] })
    expect(res.status).toBe(401)
  })

  it('returns 400 when toStatusId missing', async () => {
    const res = await request(app)
      .post(
        `/api/v1/requirements/${projectId}/${requirementDbId}/lifecycle-transition-reminder`
      )
      .set('Authorization', `Bearer ${actorToken}`)
      .send({ allowedEngineeringRoleIds: [roleId] })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/toStatusId/i)
  })

  it('returns 400 when allowedEngineeringRoleIds is empty', async () => {
    const res = await request(app)
      .post(
        `/api/v1/requirements/${projectId}/${requirementDbId}/lifecycle-transition-reminder`
      )
      .set('Authorization', `Bearer ${actorToken}`)
      .send({ toStatusId, allowedEngineeringRoleIds: [] })
    expect(res.status).toBe(400)
  })

  it('returns 404 for unknown requirement', async () => {
    const res = await request(app)
      .post(
        `/api/v1/requirements/${projectId}/00000000-0000-0000-0000-000000000000/lifecycle-transition-reminder`
      )
      .set('Authorization', `Bearer ${actorToken}`)
      .send({ toStatusId, allowedEngineeringRoleIds: [roleId] })
    expect(res.status).toBe(404)
  })

  it('returns 400 when none of the requested roleIds exist', async () => {
    const res = await request(app)
      .post(
        `/api/v1/requirements/${projectId}/${requirementDbId}/lifecycle-transition-reminder`
      )
      .set('Authorization', `Bearer ${actorToken}`)
      .send({
        toStatusId,
        allowedEngineeringRoleIds: ['00000000-0000-0000-0000-000000000000'],
      })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/no valid engineering roles/i)
  })

  it('returns notifiedCount=N for matching role assignments', async () => {
    const res = await request(app)
      .post(
        `/api/v1/requirements/${projectId}/${requirementDbId}/lifecycle-transition-reminder`
      )
      .set('Authorization', `Bearer ${actorToken}`)
      .send({
        toStatusId,
        allowedEngineeringRoleIds: [roleId],
        fromStatusName: 'Draft',
        toStatusName: 'Review',
        note: 'Please advance.',
      })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.notifiedCount).toBe(1)

    const note = await prisma.notification.findFirst({
      where: { userId: recipientId, type: 'lifecycle_transition_reminder' },
    })
    expect(note).not.toBeNull()
    expect(note?.title).toBe('Lifecycle transition reminder')
    expect(note?.message).toMatch(/please advance/i)
  })

  it('actor is excluded from recipients (notifiedCount=0 when actor is the only role-holder)', async () => {
    // Add the actor to the role and remove the recipient
    await prisma.projectUserEngineeringRole.deleteMany({ where: { projectId, userId: recipientId } })
    await prisma.projectUserEngineeringRole.create({
      data: { projectId, userId: actorId, roleId },
    })

    const res = await request(app)
      .post(
        `/api/v1/requirements/${projectId}/${requirementDbId}/lifecycle-transition-reminder`
      )
      .set('Authorization', `Bearer ${actorToken}`)
      .send({ toStatusId, allowedEngineeringRoleIds: [roleId] })
    expect(res.status).toBe(200)
    expect(res.body.data.notifiedCount).toBe(0)
    expect(res.body.data.message).toMatch(/no project members/i)
  })
})
