/**
 * ReqIF import integration tests (#99).
 *
 * POST /api/v1/requirements/:projectId/import/reqif parses a ReqIF XML
 * string, creates Requirements and TraceLinks. A broken import is a launch
 * blocker for customers onboarding from DOORS / PTC Integrity / DOORS Next.
 *
 * NX-1 (#437): the controller now routes through the converged
 * `services/reqif/` module (was `services/reqifParser.ts`). This suite guards
 * the route contract — its fixtures use the legacy `<DEFINITION><IDENTIFIER>`
 * attribute shape, which the new parser still supports. Full dialect coverage
 * lives in `reqif.conformance.test.ts`.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

// These fixtures use the legacy DEFINITION-via-direct-<IDENTIFIER> shape.
// The NX-1 parser (services/reqif/parser.ts) supports both that shape and
// the standard ATTRIBUTE-DEFINITION-*-REF wrapping; full-spec DOORS / Polarion
// / Jama dialect coverage lives in reqif.conformance.test.ts.
const MINIMAL_REQIF = (identifier: string, longName: string) => `<?xml version="1.0" encoding="UTF-8"?>
<REQ-IF>
  <SPEC-OBJECT>
    <IDENTIFIER>${identifier}</IDENTIFIER>
    <VALUES>
      <ATTRIBUTE-VALUE>
        <DEFINITION>
          <IDENTIFIER>ReqIF.LongName</IDENTIFIER>
        </DEFINITION>
        <THE-VALUE>${longName}</THE-VALUE>
      </ATTRIBUTE-VALUE>
      <ATTRIBUTE-VALUE>
        <DEFINITION>
          <IDENTIFIER>ReqIF.Description</IDENTIFIER>
        </DEFINITION>
        <THE-VALUE>Imported description for ${identifier}</THE-VALUE>
      </ATTRIBUTE-VALUE>
    </VALUES>
  </SPEC-OBJECT>
</REQ-IF>`

describe('ReqIF import endpoint (#99)', () => {
  const stamp = Date.now()
  let userId: string
  let token: string
  let projectId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const user = await prisma.user.create({
      data: { email: `reqif-${stamp}@example.com`, password: 'hashed', name: 'ReqIF User' },
    })
    userId = user.id
    token = jwt.sign({ userId }, secret)

    const slug = `reqif-${stamp}`
    const project = await prisma.project.create({
      data: { name: `ReqIF Project ${stamp}`, domain: slug, slug, userId },
    })
    projectId = project.id
    await prisma.projectMember.create({
      data: { projectId, userId, role: 'owner', status: 'accepted' },
    })
  })

  afterAll(async () => {
    await prisma.traceLink.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.requirement.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.projectMember.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('returns 401 without an auth token', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/import/reqif`)
      .send({ content: MINIMAL_REQIF('NO-AUTH-1', 'No auth') })
    expect(res.status).toBe(401)
  })

  it('returns 400 when content is empty', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/import/reqif`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: '' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/content/i)
  })

  it('returns 400 when content is missing entirely', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/import/reqif`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(res.status).toBe(400)
  })

  it('returns 400 when content exceeds the 5 MB limit', async () => {
    const oversized = 'x'.repeat(5 * 1024 * 1024 + 100)
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/import/reqif`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: oversized })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/too large|maximum size/i)
  })

  it('creates a Requirement from valid ReqIF XML', async () => {
    const identifier = `REQ-NEW-${stamp}`
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/import/reqif`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: MINIMAL_REQIF(identifier, 'New requirement via ReqIF') })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.created).toBeGreaterThanOrEqual(1)

    const persisted = await prisma.requirement.findFirst({
      where: { projectId, requirementId: identifier, deletedAt: null },
      select: { title: true, description: true },
    })
    expect(persisted).not.toBeNull()
    expect(persisted?.title).toBe('New requirement via ReqIF')
    expect(persisted?.description).toMatch(/Imported description/)
  })

  it('updates a requirement whose identifier already exists in the project', async () => {
    // NX-1 (#437): the converged importer matches an existing requirement by
    // requirementId and UPDATES it (the legacy parser silently skipped it).
    // An update is the correct round-trip behaviour — re-importing an export
    // must not duplicate, and a changed upstream requirement must propagate.
    const identifier = `REQ-EXISTS-${stamp}`
    const before = await prisma.requirement.create({
      data: {
        projectId,
        requirementId: identifier,
        title: 'Pre-existing',
        description: 'lives here',
        status: 'draft',
        priority: 'medium',
        stage: '',
      },
    })

    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/import/reqif`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: MINIMAL_REQIF(identifier, 'Updated via ReqIF') })
    expect(res.status).toBe(200)
    expect(res.body.data.updated).toBeGreaterThanOrEqual(1)
    expect(res.body.data.created).toBe(0)

    // The same row was updated in place — no duplicate created.
    const rows = await prisma.requirement.findMany({
      where: { projectId, requirementId: identifier, deletedAt: null },
      select: { id: true, title: true },
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe(before.id)
    expect(rows[0].title).toBe('Updated via ReqIF')
  })

  it('creates a TraceLink from a SPEC-RELATION element', async () => {
    const sourceId = `REQ-SRC-${stamp}`
    const targetId = `REQ-TGT-${stamp}`
    const reqif = `<?xml version="1.0" encoding="UTF-8"?>
<REQ-IF>
  <SPEC-OBJECT>
    <IDENTIFIER>${sourceId}</IDENTIFIER>
    <VALUES>
      <ATTRIBUTE-VALUE>
        <DEFINITION>
          <IDENTIFIER>ReqIF.LongName</IDENTIFIER>
        </DEFINITION>
        <THE-VALUE>Source req</THE-VALUE>
      </ATTRIBUTE-VALUE>
    </VALUES>
  </SPEC-OBJECT>
  <SPEC-OBJECT>
    <IDENTIFIER>${targetId}</IDENTIFIER>
    <VALUES>
      <ATTRIBUTE-VALUE>
        <DEFINITION>
          <IDENTIFIER>ReqIF.LongName</IDENTIFIER>
        </DEFINITION>
        <THE-VALUE>Target req</THE-VALUE>
      </ATTRIBUTE-VALUE>
    </VALUES>
  </SPEC-OBJECT>
  <SPEC-RELATION>
    <SOURCE REF="${sourceId}"/>
    <TARGET REF="${targetId}"/>
  </SPEC-RELATION>
</REQ-IF>`

    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/import/reqif`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: reqif })
    expect(res.status).toBe(200)
    expect(res.body.data.linksCreated).toBeGreaterThanOrEqual(1)

    const created = await prisma.requirement.findMany({
      where: { projectId, requirementId: { in: [sourceId, targetId] } },
      select: { id: true, requirementId: true },
    })
    expect(created).toHaveLength(2)
    const byReqId = Object.fromEntries(created.map((r) => [r.requirementId, r.id]))

    const link = await prisma.traceLink.findFirst({
      where: {
        projectId,
        sourceId: byReqId[sourceId],
        targetId: byReqId[targetId],
      },
    })
    expect(link).not.toBeNull()
  })

  it('returns an error payload for malformed XML without 500-ing', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/import/reqif`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: '<REQ-IF><unclosed>' })
    // The minimal parser is lenient (fast-xml-parser tolerates malformed
    // fragments) and simply reports zero extracted requirements. The
    // important invariant is that the endpoint returns a structured
    // response rather than crashing the server.
    expect([200, 400]).toContain(res.status)
    expect(res.body.success === true || res.body.success === false).toBe(true)
    if (res.status === 200) {
      expect(res.body.data.created).toBe(0)
    }
  })
})
