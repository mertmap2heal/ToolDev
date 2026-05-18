/**
 * NX-9 (#466) — Safety Analysis module integration tests.
 *
 * Covers: Hazard / FailureCondition / Fmea / FmeaRow CRUD; tenant scoping
 * (401 unauthenticated, 403 non-member); FMEA auto-RPN (server-computed,
 * client value rejected, 1-10 score bounds); severity->DAL derivation
 * (server-derived, client value rejected); central AuditLog rows on the
 * safety:<kebab-verb> convention; soft-delete behaviour.
 *
 * Hits the real DB (Docker must be running). Isolated timestamped data,
 * cleaned up in afterAll in reverse dependency order.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../../server'
import { prisma } from '../../lib/prisma'

describe('Safety Analysis module integration', () => {
  const stamp = Date.now()
  const secret = process.env.JWT_SECRET || 'secret'

  let memberId: string
  let outsiderId: string
  let memberToken: string
  let outsiderToken: string
  let projectId: string

  const SAFETY = (path: string) => `/api/v1/safety-analysis/projects/${projectId}${path}`

  beforeAll(async () => {
    const member = await prisma.user.create({
      data: {
        email: `safety-member-${stamp}@example.com`,
        password: 'hashed',
        name: 'Safety Member',
      },
    })
    const outsider = await prisma.user.create({
      data: {
        email: `safety-outsider-${stamp}@example.com`,
        password: 'hashed',
        name: 'Safety Outsider',
      },
    })
    memberId = member.id
    outsiderId = outsider.id
    memberToken = jwt.sign({ userId: memberId }, secret)
    outsiderToken = jwt.sign({ userId: outsiderId }, secret)

    const slug = `safety-${stamp}`
    const project = await prisma.project.create({
      data: { name: `Safety Project ${stamp}`, domain: slug, slug, userId: memberId },
    })
    projectId = project.id

    await prisma.projectMember.create({
      data: { projectId, userId: memberId, role: 'owner', status: 'accepted' },
    })
  })

  afterAll(async () => {
    // Reverse dependency order: child rows first.
    await prisma.fmeaHazardLink.deleteMany({ where: { projectId } })
    await prisma.fmeaRow.deleteMany({ where: { projectId } })
    await prisma.fmea.deleteMany({ where: { projectId } })
    await prisma.failureCondition.deleteMany({ where: { projectId } })
    await prisma.hazard.deleteMany({ where: { projectId } })
    await prisma.auditLog.deleteMany({ where: { projectId } })
    await prisma.projectMember.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } })
    await prisma.user.deleteMany({ where: { id: { in: [memberId, outsiderId] } } })
  })

  // --- Tenant scoping -------------------------------------------------------

  describe('tenant scoping', () => {
    it('rejects an unauthenticated hazard list with 401', async () => {
      const res = await request(app).get(SAFETY('/hazards'))
      expect(res.status).toBe(401)
    })

    it('rejects a non-member hazard list with 403', async () => {
      const res = await request(app)
        .get(SAFETY('/hazards'))
        .set('Authorization', `Bearer ${outsiderToken}`)
      expect(res.status).toBe(403)
    })

    it('rejects an unauthenticated FMEA list with 401', async () => {
      const res = await request(app).get(SAFETY('/fmea'))
      expect(res.status).toBe(401)
    })

    it('rejects a non-member FMEA create with 403', async () => {
      const res = await request(app)
        .post(SAFETY('/fmea'))
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ title: 'Nope' })
      expect(res.status).toBe(403)
    })
  })

  // --- Hazard CRUD + severity->DAL -----------------------------------------

  describe('Hazard CRUD and severity->DAL derivation', () => {
    let hazardId: string

    it('creates a hazard and derives dal=C from severity Major', async () => {
      const res = await request(app)
        .post(SAFETY('/hazards'))
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          title: 'Loss of braking',
          description: 'Brake actuator fails to decelerate the aircraft.',
          severity: 'Major',
        })
      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.dal).toBe('C')
      expect(res.body.data.identifier).toMatch(/^HAZ-\d{3}$/)
      expect(res.body.data.status).toBe('Open')
      hazardId = res.body.data.id
    })

    it('re-derives dal=A when severity is updated to Catastrophic', async () => {
      const res = await request(app)
        .patch(SAFETY(`/hazards/${hazardId}`))
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ severity: 'Catastrophic' })
      expect(res.status).toBe(200)
      expect(res.body.data.dal).toBe('A')
    })

    it('derives the full severity->DAL map (Catastrophic->A ... NoSafetyEffect->E)', async () => {
      const cases: Array<[string, string]> = [
        ['Catastrophic', 'A'],
        ['Hazardous', 'B'],
        ['Major', 'C'],
        ['Minor', 'D'],
        ['NoSafetyEffect', 'E'],
      ]
      for (const [severity, dal] of cases) {
        const res = await request(app)
          .post(SAFETY('/hazards'))
          .set('Authorization', `Bearer ${memberToken}`)
          .send({
            title: `Hazard ${severity}`,
            description: `A ${severity} hazard for DAL derivation.`,
            severity,
          })
        expect(res.status).toBe(201)
        expect(res.body.data.dal).toBe(dal)
      }
    })

    it('rejects a client-supplied dal with 400', async () => {
      const res = await request(app)
        .post(SAFETY('/hazards'))
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          title: 'DAL injection attempt',
          description: 'Client tries to set dal directly.',
          severity: 'Minor',
          dal: 'A',
        })
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/dal is server-derived/i)
    })

    it('rejects an invalid severity with 400', async () => {
      const res = await request(app)
        .post(SAFETY('/hazards'))
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          title: 'Bad severity',
          description: 'Severity not in the enum.',
          severity: 'NotAValue',
        })
      expect(res.status).toBe(400)
    })

    it('returns 404 for a hazard that does not exist', async () => {
      const res = await request(app)
        .get(SAFETY('/hazards/00000000-0000-0000-0000-000000000000'))
        .set('Authorization', `Bearer ${memberToken}`)
      expect(res.status).toBe(404)
    })

    it('filters hazards by ?severity= and ?status=', async () => {
      const bySeverity = await request(app)
        .get(SAFETY('/hazards?severity=Hazardous'))
        .set('Authorization', `Bearer ${memberToken}`)
      expect(bySeverity.status).toBe(200)
      expect(bySeverity.body.data.every((h: { severity: string }) => h.severity === 'Hazardous')).toBe(
        true,
      )

      const byStatus = await request(app)
        .get(SAFETY('/hazards?status=Open'))
        .set('Authorization', `Bearer ${memberToken}`)
      expect(byStatus.status).toBe(200)
      expect(byStatus.body.data.every((h: { status: string }) => h.status === 'Open')).toBe(true)
    })

    it('soft-deletes a hazard — excluded by default, visible with ?includeDeleted=true', async () => {
      const created = await request(app)
        .post(SAFETY('/hazards'))
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          title: 'To be deleted',
          description: 'A hazard that will be soft-deleted.',
          severity: 'Minor',
        })
      const delId = created.body.data.id

      const del = await request(app)
        .delete(SAFETY(`/hazards/${delId}`))
        .set('Authorization', `Bearer ${memberToken}`)
      expect(del.status).toBe(200)

      const plain = await request(app)
        .get(SAFETY('/hazards'))
        .set('Authorization', `Bearer ${memberToken}`)
      expect(plain.body.data.some((h: { id: string }) => h.id === delId)).toBe(false)

      const withDeleted = await request(app)
        .get(SAFETY('/hazards?includeDeleted=true'))
        .set('Authorization', `Bearer ${memberToken}`)
      expect(withDeleted.body.data.some((h: { id: string }) => h.id === delId)).toBe(true)

      // The soft-deleted row is still in the DB with deletedAt set.
      const row = await prisma.hazard.findUnique({ where: { id: delId } })
      expect(row?.deletedAt).not.toBeNull()
    })
  })

  // --- FailureCondition CRUD -----------------------------------------------

  describe('FailureCondition CRUD', () => {
    let hazardId: string
    let fcId: string

    beforeAll(async () => {
      const res = await request(app)
        .post(SAFETY('/hazards'))
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          title: 'FC parent hazard',
          description: 'Parent hazard for failure conditions.',
          severity: 'Hazardous',
        })
      hazardId = res.body.data.id
    })

    it('creates a failure condition with level AFHA', async () => {
      const res = await request(app)
        .post(SAFETY(`/hazards/${hazardId}/failure-conditions`))
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ level: 'AFHA', description: 'Aircraft-level failure condition.' })
      expect(res.status).toBe(201)
      expect(res.body.data.level).toBe('AFHA')
      fcId = res.body.data.id
    })

    it('accepts level SFHA and rejects any other value with 400', async () => {
      const sfha = await request(app)
        .post(SAFETY(`/hazards/${hazardId}/failure-conditions`))
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ level: 'SFHA', description: 'System-level failure condition.' })
      expect(sfha.status).toBe(201)

      const bad = await request(app)
        .post(SAFETY(`/hazards/${hazardId}/failure-conditions`))
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ level: 'XFHA', description: 'Invalid level.' })
      expect(bad.status).toBe(400)
    })

    it('updates and lists failure conditions under the hazard', async () => {
      const upd = await request(app)
        .patch(SAFETY(`/hazards/${hazardId}/failure-conditions/${fcId}`))
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ description: 'Updated description.' })
      expect(upd.status).toBe(200)
      expect(upd.body.data.description).toBe('Updated description.')

      const list = await request(app)
        .get(SAFETY(`/hazards/${hazardId}/failure-conditions`))
        .set('Authorization', `Bearer ${memberToken}`)
      expect(list.status).toBe(200)
      expect(list.body.data.length).toBeGreaterThanOrEqual(2)
    })

    it('soft-deletes a failure condition', async () => {
      const del = await request(app)
        .delete(SAFETY(`/hazards/${hazardId}/failure-conditions/${fcId}`))
        .set('Authorization', `Bearer ${memberToken}`)
      expect(del.status).toBe(200)
      const row = await prisma.failureCondition.findUnique({ where: { id: fcId } })
      expect(row?.deletedAt).not.toBeNull()
    })

    it('rejects a non-member failure-condition create with 403', async () => {
      const res = await request(app)
        .post(SAFETY(`/hazards/${hazardId}/failure-conditions`))
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ level: 'AFHA', description: 'No access.' })
      expect(res.status).toBe(403)
    })
  })

  // --- FMEA + FmeaRow + auto-RPN -------------------------------------------

  describe('FMEA worksheet, rows, and auto-RPN', () => {
    let fmeaId: string
    let rowId: string

    it('creates an FMEA worksheet', async () => {
      const res = await request(app)
        .post(SAFETY('/fmea'))
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ title: 'Brake system FMEA' })
      expect(res.status).toBe(201)
      expect(res.body.data.status).toBe('Draft')
      fmeaId = res.body.data.id
    })

    it('creates a row and computes rpn = severity*occurrence*detection (7*4*3=84)', async () => {
      const res = await request(app)
        .post(SAFETY(`/fmea/${fmeaId}/rows`))
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          component: 'Brake actuator',
          failureMode: 'Stuck closed',
          effect: 'Loss of braking',
          severity: 7,
          occurrence: 4,
          detection: 3,
        })
      expect(res.status).toBe(201)
      expect(res.body.data.rpn).toBe(84)
      rowId = res.body.data.id
    })

    it('recomputes rpn server-side when a factor is PATCHed', async () => {
      const res = await request(app)
        .patch(SAFETY(`/fmea/${fmeaId}/rows/${rowId}`))
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ severity: 10 })
      expect(res.status).toBe(200)
      // 10 * 4 * 3 = 120
      expect(res.body.data.rpn).toBe(120)
    })

    it('rejects a row payload carrying its own rpn with 400', async () => {
      const res = await request(app)
        .post(SAFETY(`/fmea/${fmeaId}/rows`))
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          component: 'RPN injection',
          failureMode: 'Mode',
          effect: 'Effect',
          severity: 5,
          occurrence: 5,
          detection: 5,
          rpn: 1,
        })
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/rpn is server-computed/i)
    })

    it('rejects a score above 10 with 400', async () => {
      const res = await request(app)
        .post(SAFETY(`/fmea/${fmeaId}/rows`))
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          component: 'Out of range',
          failureMode: 'Mode',
          effect: 'Effect',
          severity: 11,
          occurrence: 4,
          detection: 3,
        })
      expect(res.status).toBe(400)
    })

    it('rejects a score below 1 with 400', async () => {
      const res = await request(app)
        .post(SAFETY(`/fmea/${fmeaId}/rows`))
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          component: 'Zero score',
          failureMode: 'Mode',
          effect: 'Effect',
          severity: 7,
          occurrence: 0,
          detection: 3,
        })
      expect(res.status).toBe(400)
    })

    it('rejects an occurrence above 10 with 400', async () => {
      const res = await request(app)
        .post(SAFETY(`/fmea/${fmeaId}/rows`))
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          component: 'Bad occurrence',
          failureMode: 'Mode',
          effect: 'Effect',
          severity: 7,
          occurrence: 11,
          detection: 3,
        })
      expect(res.status).toBe(400)
    })

    it('lists rows and soft-deletes a row', async () => {
      const list = await request(app)
        .get(SAFETY(`/fmea/${fmeaId}/rows`))
        .set('Authorization', `Bearer ${memberToken}`)
      expect(list.status).toBe(200)
      expect(list.body.data.length).toBeGreaterThanOrEqual(1)

      const del = await request(app)
        .delete(SAFETY(`/fmea/${fmeaId}/rows/${rowId}`))
        .set('Authorization', `Bearer ${memberToken}`)
      expect(del.status).toBe(200)
      const row = await prisma.fmeaRow.findUnique({ where: { id: rowId } })
      expect(row?.deletedAt).not.toBeNull()
    })

    it('updates and soft-deletes the FMEA worksheet', async () => {
      const upd = await request(app)
        .patch(SAFETY(`/fmea/${fmeaId}`))
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ status: 'InReview' })
      expect(upd.status).toBe(200)
      expect(upd.body.data.status).toBe('InReview')

      const del = await request(app)
        .delete(SAFETY(`/fmea/${fmeaId}`))
        .set('Authorization', `Bearer ${memberToken}`)
      expect(del.status).toBe(200)
      const row = await prisma.fmea.findUnique({ where: { id: fmeaId } })
      expect(row?.deletedAt).not.toBeNull()
    })

    it('returns 404 when adding a row to a missing FMEA worksheet', async () => {
      const res = await request(app)
        .post(SAFETY('/fmea/00000000-0000-0000-0000-000000000000/rows'))
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          component: 'X',
          failureMode: 'Y',
          effect: 'Z',
          severity: 1,
          occurrence: 1,
          detection: 1,
        })
      expect(res.status).toBe(404)
    })
  })

  // --- Central AuditLog ----------------------------------------------------

  describe('central AuditLog (safety:<kebab-verb> convention)', () => {
    it('writes safety:<kebab-verb> rows with structured detailsJson for every write', async () => {
      const created = await request(app)
        .post(SAFETY('/hazards'))
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          title: 'Audited hazard',
          description: 'A hazard whose create is audited.',
          severity: 'Major',
        })
      const auditedId = created.body.data.id

      const rows = await prisma.auditLog.findMany({
        where: { projectId, action: 'safety:hazard-create' },
      })
      expect(rows.length).toBeGreaterThanOrEqual(1)
      const match = rows.find(
        (r) =>
          r.detailsJson != null &&
          typeof r.detailsJson === 'object' &&
          (r.detailsJson as Record<string, unknown>).hazardId === auditedId,
      )
      expect(match).toBeDefined()
      expect(match?.userId).toBe(memberId)
      const details = match?.detailsJson as Record<string, unknown>
      expect(details.dal).toBe('C')
      expect(details.severity).toBe('Major')

      // Every Safety action string uses the safety: namespace.
      const allSafety = await prisma.auditLog.findMany({
        where: { projectId, action: { startsWith: 'safety:' } },
      })
      expect(allSafety.length).toBeGreaterThan(0)
      expect(allSafety.every((r) => /^safety:[a-z-]+$/.test(r.action))).toBe(true)

      // No private SafetyAuditLog table exists — confirm the action set
      // includes the FMEA + failure-condition verbs too.
      const actions = new Set(allSafety.map((r) => r.action))
      expect(actions.has('safety:fmea-create')).toBe(true)
      expect(actions.has('safety:fmea-row-create')).toBe(true)
      expect(actions.has('safety:failure-condition-create')).toBe(true)
    })
  })
})
