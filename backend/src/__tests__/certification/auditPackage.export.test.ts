// N-2.2 (#425) — tests for the audit-package export endpoint + renderers.
//
// Hits the real DB + the Express app via supertest (no mocks). Covers the
// route contract: happy path -> a ZIP, project-scope rejection -> 403,
// non-PSAC artefactType -> 400, no auth -> 401. Also asserts the JSON renderer
// emits the full 14-section PSAC structure.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../../server'
import { prisma } from '../../lib/prisma'
import { composePsac } from '../../services/auditPackage/composer.service'
import { renderPsacJson } from '../../services/auditPackage/render/jsonRenderer'
import { renderPsacDocx } from '../../services/auditPackage/render/docxRenderer'
import { renderPsacPdf } from '../../services/auditPackage/render/pdfRenderer'
import { buildManifest } from '../../services/auditPackage/render/manifest'
import { PSAC_SECTION_MAP } from '../../services/auditPackage/sectionMaps/psac.sectionMap'

describe('Audit package export (#425)', () => {
  const ts = Date.now()
  let memberUserId = ''
  let memberToken = ''
  let outsiderUserId = ''
  let outsiderToken = ''
  let projectId = ''

  beforeAll(async () => {
    const member = await prisma.user.create({
      data: {
        email: `audit-export-member-${ts}@example.com`,
        password: 'x',
        name: `Audit Export Member ${ts}`,
      },
    })
    memberUserId = member.id
    memberToken = jwt.sign({ userId: memberUserId }, process.env.JWT_SECRET || 'secret')

    const outsider = await prisma.user.create({
      data: {
        email: `audit-export-outsider-${ts}@example.com`,
        password: 'x',
        name: `Audit Export Outsider ${ts}`,
      },
    })
    outsiderUserId = outsider.id
    outsiderToken = jwt.sign({ userId: outsiderUserId }, process.env.JWT_SECRET || 'secret')

    const project = await prisma.project.create({
      data: {
        name: `Audit Export Project ${ts}`,
        domain: 'test',
        slug: `audit-export-${ts}`,
        userId: memberUserId,
      },
    })
    projectId = project.id
    await prisma.projectMember.create({
      data: { projectId, userId: memberUserId, role: 'owner', status: 'accepted' },
    })

    // A minimal cert graph so the composed package is non-trivial.
    await prisma.certContext.create({
      data: { projectId, authority: 'EASA', certBasis: 'CS-25', standards: ['DO-178C'] },
    })
    await prisma.certObjective.create({
      data: {
        projectId,
        objId: `OBJ-EXP-${ts}`,
        regRef: 'CS-25.1309',
        title: 'Export-test objective',
        moc: 'Test',
        status: 'Open',
        criticality: 'Medium',
      },
    })
  })

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { projectId } })
    await prisma.certObjective.deleteMany({ where: { projectId } })
    await prisma.certContext.deleteMany({ where: { projectId } })
    await prisma.projectMember.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } })
    await prisma.user.deleteMany({ where: { id: { in: [memberUserId, outsiderUserId] } } })
    await prisma.$disconnect()
  })

  describe('POST /api/v1/certification/:projectId/audit-package', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app)
        .post(`/api/v1/certification/${projectId}/audit-package`)
        .send({ artefactType: 'PSAC' })
      expect(res.status).toBe(401)
    })

    it('rejects a caller who is not a project member with 403', async () => {
      const res = await request(app)
        .post(`/api/v1/certification/${projectId}/audit-package`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ artefactType: 'PSAC' })
      expect(res.status).toBe(403)
    })

    it('rejects a non-PSAC artefactType with 400', async () => {
      const res = await request(app)
        .post(`/api/v1/certification/${projectId}/audit-package`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ artefactType: 'SDP' })
      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
      expect(res.body.error).toMatch(/PSAC/)
    })

    it('happy path: returns a ZIP for a project member', async () => {
      const res = await request(app)
        .post(`/api/v1/certification/${projectId}/audit-package`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ artefactType: 'PSAC' })
        .buffer(true)
        .parse((response, cb) => {
          const chunks: Buffer[] = []
          response.on('data', (c: Buffer) => chunks.push(c))
          response.on('end', () => cb(null, Buffer.concat(chunks)))
        })
      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toBe('application/zip')
      const body = res.body as Buffer
      expect(body.byteLength).toBeGreaterThan(0)
      // ZIP local-file-header magic bytes: 'PK\x03\x04'
      expect(body[0]).toBe(0x50)
      expect(body[1]).toBe(0x4b)
      expect(body[2]).toBe(0x03)
      expect(body[3]).toBe(0x04)
    })

    it('writes a certification:audit-package-export audit-log row', async () => {
      await request(app)
        .post(`/api/v1/certification/${projectId}/audit-package`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ artefactType: 'PSAC' })
        .buffer(true)
        .parse((response, cb) => {
          const chunks: Buffer[] = []
          response.on('data', (c: Buffer) => chunks.push(c))
          response.on('end', () => cb(null, Buffer.concat(chunks)))
        })
      const audit = await prisma.auditLog.findFirst({
        where: { projectId, action: 'certification:audit-package-export' },
        orderBy: { createdAt: 'desc' },
      })
      expect(audit).not.toBeNull()
      expect(audit!.userId).toBe(memberUserId)
    })

    it('defaults to PSAC when no artefactType is supplied', async () => {
      const res = await request(app)
        .post(`/api/v1/certification/${projectId}/audit-package`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({})
        .buffer(true)
        .parse((response, cb) => {
          const chunks: Buffer[] = []
          response.on('data', (c: Buffer) => chunks.push(c))
          response.on('end', () => cb(null, Buffer.concat(chunks)))
        })
      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toBe('application/zip')
    })
  })

  describe('PSAC renderers', () => {
    it('the JSON renderer emits all 14 PSAC sections in section-map order', async () => {
      const composed = await composePsac(projectId)
      expect(composed).not.toBeNull()
      const manifest = buildManifest(composed!, memberUserId, [])
      const jsonBuf = renderPsacJson(composed!, manifest)
      const parsed = JSON.parse(jsonBuf.toString('utf8'))
      expect(parsed.artefactType).toBe('PSAC')
      expect(Array.isArray(parsed.sections)).toBe(true)
      expect(parsed.sections).toHaveLength(PSAC_SECTION_MAP.length)
      expect(parsed.sections).toHaveLength(14)
      // section order is exactly the section-map order
      expect(parsed.sections.map((s: { number: string }) => s.number)).toEqual(
        PSAC_SECTION_MAP.map((s) => s.number),
      )
    })

    it('the DOCX and PDF renderers each produce a non-empty buffer', async () => {
      const composed = await composePsac(projectId)
      const manifest = buildManifest(composed!, memberUserId, [])
      const docxBuf = await renderPsacDocx(composed!, manifest)
      const pdfBuf = await renderPsacPdf(composed!, manifest)
      expect(docxBuf.byteLength).toBeGreaterThan(0)
      expect(pdfBuf.byteLength).toBeGreaterThan(0)
      // DOCX is a ZIP container — magic bytes 'PK'
      expect(docxBuf[0]).toBe(0x50)
      expect(docxBuf[1]).toBe(0x4b)
      // PDF starts with '%PDF'
      expect(pdfBuf.toString('ascii', 0, 4)).toBe('%PDF')
    })

    it('never omits a numbered section — an empty section still renders', async () => {
      // The export-test project has one objective with no requirements and no
      // milestones, so several sections have no composed data; all 14 must
      // still be present.
      const composed = await composePsac(projectId)
      const manifest = buildManifest(composed!, memberUserId, [])
      const parsed = JSON.parse(renderPsacJson(composed!, manifest).toString('utf8'))
      const scheduleSection = parsed.sections.find((s: { number: string }) => s.number === '5')
      expect(scheduleSection).toBeDefined()
      // section 5 has no milestones — it carries an `empty` block, not nothing
      expect(scheduleSection.blocks.some((b: { type: string }) => b.type === 'empty')).toBe(true)
    })
  })
})
