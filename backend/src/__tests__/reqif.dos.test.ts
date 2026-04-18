/**
 * Regression tests for #298 — ReqIF import had no size / count caps.
 *
 * Pre-fix a signed-in project member could feed up to 50 MB of XML into
 * fast-xml-parser (synchronous) and fire tens of thousands of Prisma
 * round-trips per request. Post-fix:
 *   - payload > 8 MB text -> 413
 *   - non-string payload -> 400
 *   - missing payload -> 400
 *   - SPEC-OBJECT count > 5000 -> 500 with explicit error message
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('ReqIF import — DoS limits (#298)', () => {
  const stamp = Date.now()

  let userId: string
  let token: string
  let projectId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const user = await prisma.user.create({
      data: { email: `reqif-dos-${stamp}@example.test`, password: 'x', name: 'R' },
    })
    userId = user.id
    token = jwt.sign({ userId: user.id }, secret)

    const slug = `reqif-dos-${stamp}`
    const pr = await prisma.project.create({
      data: { name: `RD ${stamp}`, domain: slug, slug, userId },
    })
    projectId = pr.id
    await prisma.projectMember.create({
      data: { projectId, userId, role: 'owner', status: 'accepted' },
    })
  })

  afterAll(async () => {
    await prisma.projectMember.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('returns 400 when reqifXml missing', async () => {
    const res = await request(app)
      .post(`/api/v1/reqif/${projectId}/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(res.status).toBe(400)
  })

  it('returns 400 when reqifXml is not a string (#298)', async () => {
    const res = await request(app)
      .post(`/api/v1/reqif/${projectId}/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reqifXml: { trick: 'object' } })
    expect(res.status).toBe(400)
  })

  it('returns 413 when reqifXml exceeds 8 MB (#298)', async () => {
    // Build a string just over the 8 MB limit. Keep it simple and repetitive;
    // the check is a length guard, not a structure guard.
    const big = 'A'.repeat(8 * 1024 * 1024 + 1)
    const res = await request(app)
      .post(`/api/v1/reqif/${projectId}/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reqifXml: big })
    expect(res.status).toBe(413)
  })

  it('rejects payloads with more than 5000 SPEC-OBJECTS (#298)', async () => {
    const specs = Array.from({ length: 5001 })
      .map(() => '<reqif:SPEC-OBJECT IDENTIFIER="x"><reqif:VALUES/></reqif:SPEC-OBJECT>')
      .join('')
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<reqif:REQ-IF xmlns:reqif="http://www.omg.org/spec/ReqIF/20110402/reqif.xsd">
  <reqif:CORE-CONTENT>
    <reqif:REQ-IF-CONTENT>
      <reqif:SPEC-OBJECTS>
        ${specs}
      </reqif:SPEC-OBJECTS>
    </reqif:REQ-IF-CONTENT>
  </reqif:CORE-CONTENT>
</reqif:REQ-IF>`
    const res = await request(app)
      .post(`/api/v1/reqif/${projectId}/import`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reqifXml: xml })
    expect(res.status).toBe(500)
    expect(String(res.body.error)).toMatch(/SPEC-OBJECT limit/i)
  })
})
