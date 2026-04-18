/**
 * Regression tests for #291 — POST /csv/export and POST /csv/import
 * trusted project_id from the body with no membership check. Any
 * authenticated user could dump any project's task list or inject
 * phantom tasks into any project.
 *
 * The export handler also wrote user strings verbatim into CSV cells,
 * so formula triggers (=, +, -, @, tab, CR) would execute in Excel.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('CSV import/export — project membership + formula injection (#291)', () => {
  const stamp = Date.now()

  let userAId: string
  let userBId: string
  let tokenA: string
  let tokenB: string
  let projectAId: string
  let projectBId: string
  let injectedTaskId: string
  let importTaskIds: string[] = []

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const userA = await prisma.user.create({
      data: { email: `csv-a-${stamp}@example.test`, password: 'x', name: 'A' },
    })
    userAId = userA.id
    tokenA = jwt.sign({ userId: userA.id }, secret)

    const userB = await prisma.user.create({
      data: { email: `csv-b-${stamp}@example.test`, password: 'x', name: 'B' },
    })
    userBId = userB.id
    tokenB = jwt.sign({ userId: userB.id }, secret)

    const slugA = `csv-a-${stamp}`
    const slugB = `csv-b-${stamp}`
    const pA = await prisma.project.create({
      data: { name: `CSV A ${stamp}`, domain: slugA, slug: slugA, userId: userAId },
    })
    projectAId = pA.id
    const pB = await prisma.project.create({
      data: { name: `CSV B ${stamp}`, domain: slugB, slug: slugB, userId: userBId },
    })
    projectBId = pB.id

    await prisma.projectMember.createMany({
      data: [
        { projectId: projectAId, userId: userAId, role: 'owner', status: 'accepted' },
        { projectId: projectBId, userId: userBId, role: 'owner', status: 'accepted' },
      ],
    })

    // Seed a task in project B with a malicious formula title so the export
    // test can confirm the neutralising apostrophe is applied.
    const evilTask = await prisma.task.create({
      data: {
        projectId: projectBId,
        title: '=HYPERLINK("https://attacker/x","click")',
      },
    })
    injectedTaskId = evilTask.id
  })

  afterAll(async () => {
    await prisma.task.deleteMany({ where: { id: injectedTaskId } }).catch(() => {})
    if (importTaskIds.length > 0) {
      await prisma.task.deleteMany({ where: { id: { in: importTaskIds } } }).catch(() => {})
    }
    // Clean up anything created in project B by import attempts.
    await prisma.task.deleteMany({ where: { projectId: projectBId } }).catch(() => {})
    await prisma.task.deleteMany({ where: { projectId: projectAId } }).catch(() => {})
    await prisma.projectMember.deleteMany({ where: { projectId: { in: [projectAId, projectBId] } } }).catch(() => {})
    await prisma.project.deleteMany({ where: { id: { in: [projectAId, projectBId] } } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('POST /csv/export without project_id returns 400 (#291)', async () => {
    const res = await request(app)
      .post('/api/v1/csv/export')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({})
    expect(res.status).toBe(400)
  })

  it('POST /csv/export with foreign project_id returns 403 (#291)', async () => {
    const res = await request(app)
      .post('/api/v1/csv/export')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ project_id: projectBId })
    expect(res.status).toBe(403)
  })

  it('POST /csv/export with own project_id succeeds and neutralises formula cells (#291)', async () => {
    // Seed a malicious task in project A so we can round-trip through export.
    const evilA = await prisma.task.create({
      data: {
        projectId: projectAId,
        title: '=SUM(1,2)',
      },
    })
    try {
      const res = await request(app)
        .post('/api/v1/csv/export')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ project_id: projectAId, columns: ['title', 'status'] })
      expect(res.status).toBe(200)
      const body = String(res.text ?? res.body)
      // Pre-fix the cell would start with '=SUM(1,2)' which Excel evaluates.
      // Post-fix it starts with a single-quote apostrophe.
      expect(body).toContain("'=SUM(1,2)")
      // Must NOT contain the raw unescaped form at line start.
      expect(body).not.toMatch(/\n=SUM/)
    } finally {
      await prisma.task.delete({ where: { id: evilA.id } })
    }
  })

  it('POST /csv/import without project_id returns 400 (#291)', async () => {
    const res = await request(app)
      .post('/api/v1/csv/import')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ csv_data: 'title\nhello' })
    expect(res.status).toBe(400)
  })

  it('POST /csv/import with foreign project_id returns 403 (#291)', async () => {
    const res = await request(app)
      .post('/api/v1/csv/import')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ project_id: projectBId, csv_data: 'title\nHacked by A' })
    expect(res.status).toBe(403)
    // Confirm no phantom task was created in project B.
    const ghost = await prisma.task.findFirst({ where: { projectId: projectBId, title: 'Hacked by A' } })
    expect(ghost).toBeNull()
  })

  it('POST /csv/import with own project_id succeeds', async () => {
    const payload = {
      project_id: projectAId,
      csv_data: 'title\nLegit import task',
    }
    const res = await request(app)
      .post('/api/v1/csv/import')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(payload)
    expect(res.status).toBe(200)
    expect(res.body.data.imported).toBe(1)
    const created = await prisma.task.findFirst({ where: { projectId: projectAId, title: 'Legit import task' } })
    expect(created).not.toBeNull()
    if (created) importTaskIds.push(created.id)
  })
})
