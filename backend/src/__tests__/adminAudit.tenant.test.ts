/**
 * Regression tests for #288 — /admin/audit-log and /admin/user-roles
 * were not tenant-scoped. A COMPANY_ADMIN at Company A could enumerate
 * every audit event and every admin-role assignment across every
 * company.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Admin audit log + user-roles — tenant scoping (#288)', () => {
  const stamp = Date.now()
  const companyA = `aud-a-${stamp}`
  const companyB = `aud-b-${stamp}`

  let adminAId: string
  let adminBId: string
  let superiorId: string
  let tokenAdminA: string
  let tokenSuperior: string
  let projectAId: string
  let projectBId: string
  let verEventAId: string
  let verEventBId: string
  let taskAId: string
  let taskAuditEventAId: string
  let taskAuditEventBId: string
  let adminRoleId: string
  let assignedAId: string
  let assignedBId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'

    const adminA = await prisma.user.create({
      data: {
        email: `aud-admin-a-${stamp}@example.test`,
        password: 'x',
        name: 'Admin A',
        role: 'COMPANY_ADMIN',
        company: companyA,
      },
    })
    adminAId = adminA.id
    tokenAdminA = jwt.sign({ userId: adminA.id }, secret)

    const adminB = await prisma.user.create({
      data: {
        email: `aud-admin-b-${stamp}@example.test`,
        password: 'x',
        name: 'Admin B',
        role: 'COMPANY_ADMIN',
        company: companyB,
      },
    })
    adminBId = adminB.id

    const superior = await prisma.user.create({
      data: {
        email: `aud-superior-${stamp}@example.test`,
        password: 'x',
        name: 'Superior',
        role: 'SUPERIOR_ADMIN',
        company: companyA,
      },
    })
    superiorId = superior.id
    tokenSuperior = jwt.sign({ userId: superior.id }, secret)

    // Projects — companyName is what the audit filter uses.
    const slugA = `aud-a-${stamp}`
    const slugB = `aud-b-${stamp}`
    const pA = await prisma.project.create({
      data: {
        name: `Aud A ${stamp}`,
        domain: slugA,
        slug: slugA,
        userId: adminAId,
        companyName: companyA,
      },
    })
    projectAId = pA.id
    const pB = await prisma.project.create({
      data: {
        name: `Aud B ${stamp}`,
        domain: slugB,
        slug: slugB,
        userId: adminBId,
        companyName: companyB,
      },
    })
    projectBId = pB.id

    // Seed a VerAuditEvent in each project.
    const vA = await prisma.verAuditEvent.create({
      data: {
        projectId: projectAId,
        entityType: 'TEST_CASE',
        entityId: 'tc-a',
        action: 'CREATE',
        performedByUserId: adminAId,
      },
    })
    verEventAId = vA.id
    const vB = await prisma.verAuditEvent.create({
      data: {
        projectId: projectBId,
        entityType: 'TEST_CASE',
        entityId: 'tc-b',
        action: 'CREATE',
        performedByUserId: adminBId,
      },
    })
    verEventBId = vB.id

    // Seed a task in project A + TaskAuditLog in each project (via
    // entityId pointing to a task).
    const taskA = await prisma.task.create({
      data: { projectId: projectAId, title: 'Task A' },
    })
    taskAId = taskA.id
    const taskB = await prisma.task.create({
      data: { projectId: projectBId, title: 'Task B' },
    })

    const tA = await prisma.taskAuditLog.create({
      data: {
        entityType: 'TASK',
        entityId: taskA.id,
        action: 'CREATE',
        userId: adminAId,
        userName: 'Admin A',
      },
    })
    taskAuditEventAId = tA.id
    const tB = await prisma.taskAuditLog.create({
      data: {
        entityType: 'TASK',
        entityId: taskB.id,
        action: 'CREATE',
        userId: adminBId,
        userName: 'Admin B',
      },
    })
    taskAuditEventBId = tB.id

    // Seed an AdminRole + assignments for both admins so we can test the
    // user-roles list tenant filter.
    const ar = await prisma.adminRole.create({
      data: {
        id: `ar-${stamp}`,
        companyKey: '__default__',
        name: `Aud Role ${stamp}`,
        defaultPermissions: {},
      },
    })
    adminRoleId = ar.id
    const aA = await prisma.userAdminRole.create({
      data: { userId: adminAId, adminRoleId },
    })
    assignedAId = aA.id
    const aB = await prisma.userAdminRole.create({
      data: { userId: adminBId, adminRoleId },
    })
    assignedBId = aB.id
  })

  afterAll(async () => {
    await prisma.userAdminRole.deleteMany({
      where: { id: { in: [assignedAId, assignedBId] } },
    }).catch(() => {})
    await prisma.adminRole.deleteMany({ where: { id: adminRoleId } }).catch(() => {})
    await prisma.taskAuditLog.deleteMany({
      where: { id: { in: [taskAuditEventAId, taskAuditEventBId] } },
    }).catch(() => {})
    await prisma.verAuditEvent.deleteMany({
      where: { id: { in: [verEventAId, verEventBId] } },
    }).catch(() => {})
    await prisma.task.deleteMany({ where: { projectId: { in: [projectAId, projectBId] } } }).catch(() => {})
    await prisma.project.deleteMany({ where: { id: { in: [projectAId, projectBId] } } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [adminAId, adminBId, superiorId] } } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('COMPANY_ADMIN /admin/audit-log returns only their company events (#288)', async () => {
    const res = await request(app)
      .get('/api/v1/admin/audit-log?limit=200')
      .set('Authorization', `Bearer ${tokenAdminA}`)
    expect(res.status).toBe(200)
    const entries = res.body.data as Array<{ id: string; target: string }>
    // Must contain company A's ver event and task event.
    expect(entries.some((e) => e.id === `ver-${verEventAId}`)).toBe(true)
    expect(entries.some((e) => e.id === `task-${taskAuditEventAId}`)).toBe(true)
    // Must NOT contain company B's events.
    expect(entries.some((e) => e.id === `ver-${verEventBId}`)).toBe(false)
    expect(entries.some((e) => e.id === `task-${taskAuditEventBId}`)).toBe(false)
  })

  it('SUPERIOR_ADMIN sees both companies in audit-log (bypass preserved)', async () => {
    const res = await request(app)
      .get('/api/v1/admin/audit-log?limit=200')
      .set('Authorization', `Bearer ${tokenSuperior}`)
    expect(res.status).toBe(200)
    const entries = res.body.data as Array<{ id: string }>
    expect(entries.some((e) => e.id === `ver-${verEventAId}`)).toBe(true)
    expect(entries.some((e) => e.id === `ver-${verEventBId}`)).toBe(true)
  })

  it('COMPANY_ADMIN /admin/user-roles returns only their company assignments (#288)', async () => {
    const res = await request(app)
      .get('/api/v1/admin/user-roles')
      .set('Authorization', `Bearer ${tokenAdminA}`)
    expect(res.status).toBe(200)
    const assignments = res.body.data as Array<{ id: string; userId: string }>
    expect(assignments.some((a) => a.id === assignedAId)).toBe(true)
    expect(assignments.some((a) => a.id === assignedBId)).toBe(false)
  })

  it('SUPERIOR_ADMIN /admin/user-roles returns all assignments', async () => {
    const res = await request(app)
      .get('/api/v1/admin/user-roles')
      .set('Authorization', `Bearer ${tokenSuperior}`)
    expect(res.status).toBe(200)
    const assignments = res.body.data as Array<{ id: string }>
    expect(assignments.some((a) => a.id === assignedAId)).toBe(true)
    expect(assignments.some((a) => a.id === assignedBId)).toBe(true)
  })
})
