import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../server'
import { prisma } from '../lib/prisma'
import jwt from 'jsonwebtoken'

describe('Parameter ReqIF round-trip', () => {
  let projectId: string
  let userId: string
  let token: string

  beforeAll(async () => {
    const ts = Date.now()
    const user = await prisma.user.create({
      data: {
        email: `reqif-test-${ts}@example.com`,
        password: 'hashed',
        name: 'ReqIF Tester',
      },
    })
    userId = user.id
    token = jwt.sign({ userId }, process.env.JWT_SECRET || 'secret')
    const project = await prisma.project.create({
      data: {
        name: `ReqIF Project ${ts}`,
        domain: `rqf-${ts}`,
        slug: `rqf-${ts}`,
        userId,
      },
    })
    projectId = project.id
    await prisma.projectMember.create({ data: { projectId, userId, role: 'owner' } })

    // Seed two parameters.
    await prisma.parameter.create({
      data: {
        projectId,
        parameterId: `PARAM-A-${ts}`,
        name: `v_bus_${ts}`,
        dataType: 'float',
        defaultValue: '28',
        unit: 'V',
        status: 'draft',
        version: '1.0',
        description: 'Main 28V power-rail voltage',
        classification: 'internal',
      },
    })
    await prisma.parameter.create({
      data: {
        projectId,
        parameterId: `PARAM-B-${ts}`,
        name: `i_max_${ts}`,
        dataType: 'float',
        defaultValue: '12',
        unit: 'A',
        status: 'approved',
        version: '1.0',
        classification: 'internal',
      },
    })
  })

  afterAll(async () => {
    await prisma.parameter.deleteMany({ where: { projectId } })
    await prisma.projectMember.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } })
    await prisma.user.delete({ where: { id: userId } })
  })

  it('GET export?format=reqif returns valid ReqIF 1.2 XML', async () => {
    const res = await request(app)
      .get(`/api/v1/parameters/${projectId}/export/reqif`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('application/xml')
    expect(res.headers['content-disposition']).toContain('parameters.reqif')
    const xml = res.text
    expect(xml).toContain('<?xml version="1.0"')
    expect(xml).toContain('<REQ-IF')
    expect(xml).toContain('REQ-IF-VERSION>1.2')
    expect(xml).toContain('SPEC-OBJECT-TYPE-REF>SPEC-TYPE-PARAMETER')
    // Both parameters must appear.
    expect(xml).toContain('v_bus_')
    expect(xml).toContain('i_max_')
  })

  it('Export -> import round-trip updates existing parameters', async () => {
    // Capture export.
    const exp = await request(app)
      .get(`/api/v1/parameters/${projectId}/export/reqif`)
      .set('Authorization', `Bearer ${token}`)
    expect(exp.status).toBe(200)
    // Mutate one parameter so we can verify import overwrites it.
    const pBefore = await prisma.parameter.findFirst({
      where: { projectId, name: { startsWith: 'v_bus_' } },
    })
    expect(pBefore).not.toBeNull()
    await prisma.parameter.update({
      where: { id: pBefore!.id },
      data: { defaultValue: '999', description: 'mutated' },
    })

    // Re-import the original ReqIF.
    const imp = await request(app)
      .post(`/api/v1/parameters/${projectId}/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({ format: 'reqif', content: exp.text })
    expect(imp.status).toBe(200)
    expect(imp.body.success).toBe(true)
    expect(imp.body.data.format).toBe('reqif')
    expect(imp.body.data.updated).toBeGreaterThanOrEqual(2)

    // Mutated row should be back to '28'.
    const pAfter = await prisma.parameter.findUnique({ where: { id: pBefore!.id } })
    expect(pAfter?.defaultValue).toBe('28')
  })

  it('Import handles a non-ReqIF body with an error', async () => {
    const res = await request(app)
      .post(`/api/v1/parameters/${projectId}/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({ format: 'reqif', content: '<not-a-reqif/>' })
    // Either a 200 with errors[] or a 4xx — accept both shapes.
    expect([200, 400, 422]).toContain(res.status)
    if (res.body.success) {
      expect(res.body.data.errors.length).toBeGreaterThan(0)
    }
  })
})
