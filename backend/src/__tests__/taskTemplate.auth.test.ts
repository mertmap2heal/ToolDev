/**
 * Regression tests for #292 — task-template CRUD was behind only
 * authenticateToken.
 *
 * Pre-fix: any signed-in user could
 *   - create a template under another project's projectId,
 *   - edit / delete any template by id,
 *   - toggle isGlobal to poison the global template picker for every
 *     tenant.
 *
 * Post-fix:
 *   - create requires project membership unless isGlobal+superior,
 *   - get/update/delete require membership or (for global) SUPERIOR_ADMIN,
 *   - only SUPERIOR_ADMIN may create or modify isGlobal.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Task templates — access control (#292)', () => {
  const stamp = Date.now()

  let userAId: string
  let userBId: string
  let superiorId: string
  let tokenA: string
  let tokenB: string
  let tokenSuperior: string
  let projectAId: string
  let projectBId: string
  let templateAId: string
  let globalTemplateId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'

    const userA = await prisma.user.create({
      data: { email: `tt-a-${stamp}@example.test`, password: 'x', name: 'A' },
    })
    userAId = userA.id
    tokenA = jwt.sign({ userId: userA.id }, secret)

    const userB = await prisma.user.create({
      data: { email: `tt-b-${stamp}@example.test`, password: 'x', name: 'B' },
    })
    userBId = userB.id
    tokenB = jwt.sign({ userId: userB.id }, secret)

    const superior = await prisma.user.create({
      data: {
        email: `tt-super-${stamp}@example.test`,
        password: 'x',
        name: 'Super',
        role: 'SUPERIOR_ADMIN',
      },
    })
    superiorId = superior.id
    tokenSuperior = jwt.sign({ userId: superior.id }, secret)

    const slugA = `tt-a-${stamp}`
    const slugB = `tt-b-${stamp}`
    const pA = await prisma.project.create({
      data: { name: `TT A ${stamp}`, domain: slugA, slug: slugA, userId: userAId },
    })
    projectAId = pA.id
    const pB = await prisma.project.create({
      data: { name: `TT B ${stamp}`, domain: slugB, slug: slugB, userId: userBId },
    })
    projectBId = pB.id

    await prisma.projectMember.createMany({
      data: [
        { projectId: projectAId, userId: userAId, role: 'owner', status: 'accepted' },
        { projectId: projectBId, userId: userBId, role: 'owner', status: 'accepted' },
      ],
    })

    const tpl = await prisma.taskTemplate.create({
      data: {
        projectId: projectAId,
        name: `A tpl ${stamp}`,
        title: 'Task A',
        isGlobal: false,
      },
    })
    templateAId = tpl.id

    const gtpl = await prisma.taskTemplate.create({
      data: {
        name: `Global tpl ${stamp}`,
        title: 'Global',
        isGlobal: true,
      },
    })
    globalTemplateId = gtpl.id
  })

  afterAll(async () => {
    await prisma.taskTemplate.deleteMany({ where: { id: { in: [templateAId, globalTemplateId] } } }).catch(() => {})
    await prisma.projectMember.deleteMany({ where: { projectId: { in: [projectAId, projectBId] } } }).catch(() => {})
    await prisma.project.deleteMany({ where: { id: { in: [projectAId, projectBId] } } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId, superiorId] } } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('rejects create against a foreign projectId (#292)', async () => {
    const res = await request(app)
      .post('/api/v1/task-templates')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        projectId: projectBId,
        name: `hack-${stamp}`,
        title: 'hack',
      })
    expect(res.status).toBe(403)
    const ghost = await prisma.taskTemplate.findFirst({ where: { name: `hack-${stamp}` } })
    expect(ghost).toBeNull()
  })

  it('rejects create with isGlobal=true from non-superior (#292)', async () => {
    const res = await request(app)
      .post('/api/v1/task-templates')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: `global-hack-${stamp}`,
        title: 'poison',
        isGlobal: true,
      })
    expect(res.status).toBe(403)
    const ghost = await prisma.taskTemplate.findFirst({ where: { name: `global-hack-${stamp}` } })
    expect(ghost).toBeNull()
  })

  it('SUPERIOR_ADMIN can create a global template', async () => {
    const res = await request(app)
      .post('/api/v1/task-templates')
      .set('Authorization', `Bearer ${tokenSuperior}`)
      .send({
        name: `superior-global-${stamp}`,
        title: 'legit',
        isGlobal: true,
      })
    expect(res.status).toBe(201)
    await prisma.taskTemplate.delete({ where: { id: res.body.data.id } }).catch(() => {})
  })

  it('rejects update of another tenant\'s template (#292)', async () => {
    const res = await request(app)
      .patch(`/api/v1/task-templates/${templateAId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'pwned' })
    expect(res.status).toBe(404)
    const after = await prisma.taskTemplate.findUnique({ where: { id: templateAId } })
    expect(after!.name).not.toBe('pwned')
  })

  it('rejects toggling isGlobal by non-superior (#292)', async () => {
    const res = await request(app)
      .patch(`/api/v1/task-templates/${templateAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ isGlobal: true })
    expect(res.status).toBe(403)
    const after = await prisma.taskTemplate.findUnique({ where: { id: templateAId } })
    expect(after!.isGlobal).toBe(false)
  })

  it('rejects delete of a global template by non-superior (#292)', async () => {
    const res = await request(app)
      .delete(`/api/v1/task-templates/${globalTemplateId}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(403)
    const stillThere = await prisma.taskTemplate.findUnique({ where: { id: globalTemplateId } })
    expect(stillThere).not.toBeNull()
  })

  it('allows owner to update their own project template', async () => {
    const res = await request(app)
      .patch(`/api/v1/task-templates/${templateAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: `updated-${stamp}` })
    expect(res.status).toBe(200)
    const after = await prisma.taskTemplate.findUnique({ where: { id: templateAId } })
    expect(after!.name).toBe(`updated-${stamp}`)
  })
})
