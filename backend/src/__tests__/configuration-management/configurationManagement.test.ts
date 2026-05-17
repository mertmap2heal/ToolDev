/**
 * NX-3 (#443) — Configuration Management integration tests.
 *
 * Covers the three new endpoint groups — ConfigItem, Deviation/Waiver,
 * CcbDecision — end to end against the real database:
 *  - happy paths (200 / 201) for list / get / create / update / lifecycle,
 *  - auth guard (401),
 *  - validation (400) and not-found (404),
 *  - the R-6 strictMode-gated path (a locked CI in a strict project is 409),
 *  - the CFR 21 Part 11 sign-off path (deviation sign + CCB ceremony) — which
 *    consumes requireReauth (R-2), requireEngineeringRole (R-7), and records a
 *    SignatureEvent (R-3).
 *
 * No mocks — the suite hits Postgres (Docker must be running).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../../server'
import { prisma } from '../../lib/prisma'

describe('Configuration Management — NX-3 integration', () => {
  const ts = Date.now()
  const secret = process.env.JWT_SECRET || 'secret'

  // requireReauth validates a signed reauth JWT (not the password) — a
  // directly-minted 60s token is sufficient here.
  const reauthHeader = (uid: string): Record<string, string> => ({
    'X-Reauth-Token': jwt.sign({ userId: uid, purpose: 'reauth' }, secret, { expiresIn: '60s' }),
  })

  let memberId: string
  let outsiderId: string
  let memberToken: string
  let outsiderToken: string
  let strictProjectId: string
  let openProjectId: string
  let ccbRoleId: string

  beforeAll(async () => {
    const member = await prisma.user.create({
      data: { email: `cm-member-${ts}@example.com`, password: 'hashed', name: 'CM Member' },
    })
    const outsider = await prisma.user.create({
      data: { email: `cm-outsider-${ts}@example.com`, password: 'hashed', name: 'CM Outsider' },
    })
    memberId = member.id
    outsiderId = outsider.id
    memberToken = jwt.sign({ userId: memberId }, secret)
    outsiderToken = jwt.sign({ userId: outsiderId }, secret)

    // A strict-mode project and a non-strict project.
    const strict = await prisma.project.create({
      data: {
        name: `CM Strict ${ts}`,
        domain: `cm-strict-${ts}`,
        slug: `cm-strict-${ts}`,
        userId: memberId,
        strictMode: true,
      },
    })
    const open = await prisma.project.create({
      data: {
        name: `CM Open ${ts}`,
        domain: `cm-open-${ts}`,
        slug: `cm-open-${ts}`,
        userId: memberId,
        strictMode: false,
      },
    })
    strictProjectId = strict.id
    openProjectId = open.id

    await prisma.projectMember.createMany({
      data: [
        { projectId: strictProjectId, userId: memberId, role: 'owner', status: 'accepted' },
        { projectId: openProjectId, userId: memberId, role: 'owner', status: 'accepted' },
      ],
    })

    // The CCB Member engineering role gates the sign-off endpoints (R-7).
    const role = await prisma.engineeringRole.upsert({
      where: { name: 'CCB Member' },
      update: {},
      create: { name: 'CCB Member', description: 'CCB voting member', isSystem: true },
    })
    ccbRoleId = role.id
    await prisma.projectUserEngineeringRole.createMany({
      data: [
        { projectId: strictProjectId, userId: memberId, roleId: ccbRoleId },
        { projectId: openProjectId, userId: memberId, roleId: ccbRoleId },
      ],
    })
  })

  afterAll(async () => {
    const projectIds = [strictProjectId, openProjectId]
    // SignatureEvent is append-only — the $use guard blocks Prisma deletes,
    // so clean its rows with raw SQL before the user delete.
    await prisma.$executeRaw`DELETE FROM "SignatureEvent" WHERE "signerUserId" = ANY(${[
      memberId,
      outsiderId,
    ]})`
    await prisma.ccbDecision.deleteMany({ where: { projectId: { in: projectIds } } })
    await prisma.deviation.deleteMany({ where: { projectId: { in: projectIds } } })
    // CM-N6 — BaselineRootItem rows cascade with their BaselineRoot.
    await prisma.baselineRoot.deleteMany({ where: { projectId: { in: projectIds } } })
    await prisma.configItem.deleteMany({ where: { projectId: { in: projectIds } } })
    await prisma.changeRequest.deleteMany({ where: { projectId: { in: projectIds } } })
    await prisma.issue.deleteMany({ where: { projectId: { in: projectIds } } })
    await prisma.auditLog.deleteMany({ where: { projectId: { in: projectIds } } })
    await prisma.projectUserEngineeringRole.deleteMany({
      where: { projectId: { in: projectIds } },
    })
    await prisma.projectMember.deleteMany({ where: { projectId: { in: projectIds } } })
    await prisma.project.deleteMany({ where: { id: { in: projectIds } } })
    await prisma.user.deleteMany({ where: { id: { in: [memberId, outsiderId] } } })
  })

  // --- ConfigItem ----------------------------------------------------------

  describe('ConfigItem', () => {
    let ciId: string

    it('rejects an unauthenticated request (401)', async () => {
      const res = await request(app).get(`/api/v1/config-items/${openProjectId}`)
      expect(res.status).toBe(401)
    })

    it('rejects a non-member (403)', async () => {
      const res = await request(app)
        .get(`/api/v1/config-items/${openProjectId}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
      expect(res.status).toBe(403)
    })

    it('creates a configuration item (201) with opinionated defaults', async () => {
      const res = await request(app)
        .post(`/api/v1/config-items/${openProjectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ name: 'Flight control CI', type: 'Requirement', ownerName: 'J. Smith' })
      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.ciKey).toMatch(/^CI-REQ-\d{3}$/)
      expect(res.body.data.status).toBe('Draft')
      expect(res.body.data.lockState).toBe('Unlocked')
      expect(res.body.data.version).toBe('0.1.0')
      expect(res.body.data.authorType).toBe('human')
      ciId = res.body.data.id
    })

    it('rejects a create with no name (400)', async () => {
      const res = await request(app)
        .post(`/api/v1/config-items/${openProjectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ type: 'Software' })
      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
    })

    it('rejects a create with an invalid type (400)', async () => {
      const res = await request(app)
        .post(`/api/v1/config-items/${openProjectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ name: 'Bad type CI', type: 'NotAType' })
      expect(res.status).toBe(400)
    })

    it('lists configuration items (200)', async () => {
      const res = await request(app)
        .get(`/api/v1/config-items/${openProjectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.data)).toBe(true)
      expect(res.body.data.some((c: { id: string }) => c.id === ciId)).toBe(true)
    })

    it('gets a single configuration item (200)', async () => {
      const res = await request(app)
        .get(`/api/v1/config-items/${openProjectId}/${ciId}`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe(ciId)
    })

    it('returns 404 for an unknown configuration item', async () => {
      const res = await request(app)
        .get(`/api/v1/config-items/${openProjectId}/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(res.status).toBe(404)
    })

    it('updates a configuration item (200) and advances its lifecycle', async () => {
      const res = await request(app)
        .put(`/api/v1/config-items/${openProjectId}/${ciId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ status: 'InReview', ownerName: 'A. Lee' })
      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('InReview')
      expect(res.body.data.ownerName).toBe('A. Lee')
    })

    it('locks and unlocks a configuration item (200)', async () => {
      const locked = await request(app)
        .post(`/api/v1/config-items/${openProjectId}/${ciId}/lock`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ lockState: 'FrozenByBaseline' })
      expect(locked.status).toBe(200)
      expect(locked.body.data.lockState).toBe('FrozenByBaseline')

      const unlocked = await request(app)
        .post(`/api/v1/config-items/${openProjectId}/${ciId}/unlock`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(unlocked.status).toBe(200)
      expect(unlocked.body.data.lockState).toBe('Unlocked')
    })

    it('R-6: editing a locked CI in a STRICT project is rejected (409)', async () => {
      // Create + lock a CI in the strict project.
      const created = await request(app)
        .post(`/api/v1/config-items/${strictProjectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ name: 'Locked strict CI', type: 'Software' })
      const strictCiId = created.body.data.id
      await request(app)
        .post(`/api/v1/config-items/${strictProjectId}/${strictCiId}/lock`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ lockState: 'FrozenByBaseline' })

      // A content edit while locked + strict must fail closed with 409.
      const blocked = await request(app)
        .put(`/api/v1/config-items/${strictProjectId}/${strictCiId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ name: 'Renamed while locked' })
      expect(blocked.status).toBe(409)
    })

    it('R-6: editing a locked CI in a NON-strict project is allowed (200)', async () => {
      const created = await request(app)
        .post(`/api/v1/config-items/${openProjectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ name: 'Locked open CI', type: 'Software' })
      const openCiId = created.body.data.id
      await request(app)
        .post(`/api/v1/config-items/${openProjectId}/${openCiId}/lock`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ lockState: 'FrozenByBaseline' })

      const allowed = await request(app)
        .put(`/api/v1/config-items/${openProjectId}/${openCiId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ name: 'Renamed in non-strict mode' })
      expect(allowed.status).toBe(200)
      expect(allowed.body.data.name).toBe('Renamed in non-strict mode')
    })

    it('soft-deletes a configuration item and drops it from the default list', async () => {
      const del = await request(app)
        .delete(`/api/v1/config-items/${openProjectId}/${ciId}`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(del.status).toBe(200)
      expect(del.body.data.deletedAt).toBeTruthy()

      const list = await request(app)
        .get(`/api/v1/config-items/${openProjectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(list.body.data.some((c: { id: string }) => c.id === ciId)).toBe(false)
    })
  })

  // --- Deviation / Waiver --------------------------------------------------

  describe('Deviation / Waiver', () => {
    let dwId: string

    it('rejects an unauthenticated request (401)', async () => {
      const res = await request(app).get(`/api/v1/deviations-waivers/${openProjectId}`)
      expect(res.status).toBe(401)
    })

    it('creates a deviation (201)', async () => {
      const res = await request(app)
        .post(`/api/v1/deviations-waivers/${openProjectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ type: 'Deviation', title: 'ICD timing deviation', riskLevel: 'Medium' })
      expect(res.status).toBe(201)
      expect(res.body.data.dwKey).toMatch(/^DW-\d{3}$/)
      expect(res.body.data.status).toBe('Draft')
      dwId = res.body.data.id
    })

    it('rejects a create with no title (400)', async () => {
      const res = await request(app)
        .post(`/api/v1/deviations-waivers/${openProjectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ type: 'Waiver' })
      expect(res.status).toBe(400)
    })

    it('rejects a create with an invalid type (400)', async () => {
      const res = await request(app)
        .post(`/api/v1/deviations-waivers/${openProjectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ type: 'Exemption', title: 'Bad type' })
      expect(res.status).toBe(400)
    })

    it('lists and gets a deviation (200)', async () => {
      const list = await request(app)
        .get(`/api/v1/deviations-waivers/${openProjectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(list.status).toBe(200)
      expect(list.body.data.some((d: { id: string }) => d.id === dwId)).toBe(true)

      const get = await request(app)
        .get(`/api/v1/deviations-waivers/${openProjectId}/${dwId}`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(get.status).toBe(200)
      expect(get.body.data.id).toBe(dwId)
    })

    it('returns 404 for an unknown deviation', async () => {
      const res = await request(app)
        .get(`/api/v1/deviations-waivers/${openProjectId}/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(res.status).toBe(404)
    })

    it('submits the deviation for review (200)', async () => {
      const res = await request(app)
        .put(`/api/v1/deviations-waivers/${openProjectId}/${dwId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ status: 'Submitted' })
      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('Submitted')
    })

    it('the sign endpoint rejects a missing reauth token (401)', async () => {
      const res = await request(app)
        .post(`/api/v1/deviations-waivers/${openProjectId}/${dwId}/sign`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(res.status).toBe(401)
    })

    it('CFR 21 Part 11: signs a deviation and records a SignatureEvent (200)', async () => {
      const res = await request(app)
        .post(`/api/v1/deviations-waivers/${openProjectId}/${dwId}/sign`)
        .set('Authorization', `Bearer ${memberToken}`)
        .set(reauthHeader(memberId))
      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('Approved')

      const sig = await prisma.signatureEvent.findFirst({
        where: { linkedEntityType: 'Deviation', linkedEntityId: dwId },
      })
      expect(sig).not.toBeNull()
      expect(sig?.signerUserId).toBe(memberId)
      expect(sig?.meaningCode).toBe('approval')
      expect(sig?.contentHash).toMatch(/^[0-9a-f]{64}$/)
    })

    it('an approved deviation is append-only — a content edit is rejected (409)', async () => {
      const res = await request(app)
        .put(`/api/v1/deviations-waivers/${openProjectId}/${dwId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ title: 'Renamed after approval' })
      expect(res.status).toBe(409)
    })

    it('closes the approved deviation (200)', async () => {
      const res = await request(app)
        .post(`/api/v1/deviations-waivers/${openProjectId}/${dwId}/close`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('Closed')
    })

    it('the deviation-expiry job generates an Issue for a soon-expiring waiver', async () => {
      // A waiver, signed, expiring in 7 days.
      const created = await request(app)
        .post(`/api/v1/deviations-waivers/${openProjectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          type: 'Waiver',
          title: 'Expiring soon waiver',
          validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
      const expiringId = created.body.data.id
      await request(app)
        .put(`/api/v1/deviations-waivers/${openProjectId}/${expiringId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ status: 'Submitted' })
      await request(app)
        .post(`/api/v1/deviations-waivers/${openProjectId}/${expiringId}/sign`)
        .set('Authorization', `Bearer ${memberToken}`)
        .set(reauthHeader(memberId))

      const { generateExpiringDeviationIssues } = await import(
        '../../services/deviationWaiver.service'
      )
      const created1 = await generateExpiringDeviationIssues(14)
      expect(created1).toBeGreaterThanOrEqual(1)
      // Idempotent — a second run creates no further Issue for the same DW.
      const created2 = await generateExpiringDeviationIssues(14)
      expect(created2).toBe(0)

      const issue = await prisma.issue.findFirst({
        where: { projectId: openProjectId, issueType: 'cm:deviation-expiring' },
      })
      expect(issue).not.toBeNull()
    })
  })

  // --- CcbDecision ---------------------------------------------------------

  describe('CcbDecision', () => {
    let changeRequestId: string

    beforeAll(async () => {
      const cr = await prisma.changeRequest.create({
        data: {
          projectId: openProjectId,
          crId: `CR-CM-${ts}`,
          title: 'CM change request',
          description: 'Routes through the CCB',
          sourceType: 'requirement',
          sourceId: 'seed-source',
        },
      })
      changeRequestId = cr.id
    })

    it('rejects an unauthenticated request (401)', async () => {
      const res = await request(app).get(`/api/v1/ccb-decisions/${openProjectId}`)
      expect(res.status).toBe(401)
    })

    it('creates an unsigned CCB decision (201)', async () => {
      const res = await request(app)
        .post(`/api/v1/ccb-decisions/${openProjectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ changeRequestId, ccbLevel: 'SystemCCB', decision: 'Deferred' })
      expect(res.status).toBe(201)
      expect(res.body.data.decision).toBe('Deferred')
      expect(res.body.data.signedById).toBeNull()
    })

    it('rejects a create for an unknown change request (404)', async () => {
      const res = await request(app)
        .post(`/api/v1/ccb-decisions/${openProjectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          changeRequestId: '00000000-0000-0000-0000-000000000000',
          ccbLevel: 'SystemCCB',
          decision: 'Approved',
        })
      expect(res.status).toBe(404)
    })

    it('rejects a create with an invalid ccbLevel (400)', async () => {
      const res = await request(app)
        .post(`/api/v1/ccb-decisions/${openProjectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ changeRequestId, ccbLevel: 'BadCCB', decision: 'Approved' })
      expect(res.status).toBe(400)
    })

    it('the sign endpoint rejects a missing reauth token (401)', async () => {
      const res = await request(app)
        .post(`/api/v1/ccb-decisions/${openProjectId}/sign`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ changeRequestId, ccbLevel: 'SystemCCB', decision: 'Approved' })
      expect(res.status).toBe(401)
    })

    it('CCB ceremony: signing an Approved decision bumps impacted CI versions', async () => {
      // A fresh CI to be impacted by the decision.
      const ci = await request(app)
        .post(`/api/v1/config-items/${openProjectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ name: 'Impacted CI', type: 'Software' })
      const impactedCiId = ci.body.data.id
      expect(ci.body.data.version).toBe('0.1.0')

      const res = await request(app)
        .post(`/api/v1/ccb-decisions/${openProjectId}/sign`)
        .set('Authorization', `Bearer ${memberToken}`)
        .set(reauthHeader(memberId))
        .send({
          changeRequestId,
          ccbLevel: 'SystemCCB',
          decision: 'Approved',
          decisionRationale: 'Stability improvement',
          impactedConfigItemIds: [{ itemType: 'configItem', itemId: impactedCiId }],
        })
      expect(res.status).toBe(201)
      expect(res.body.data.decision).toBe('Approved')
      expect(res.body.data.signedById).toBe(memberId)

      // The signature was recorded.
      const sig = await prisma.signatureEvent.findFirst({
        where: { linkedEntityType: 'CcbDecision', linkedEntityId: res.body.data.id },
      })
      expect(sig).not.toBeNull()

      // The impacted CI's version was bumped (0.1.0 -> 0.1.1).
      const bumped = await prisma.configItem.findUnique({ where: { id: impactedCiId } })
      expect(bumped?.version).toBe('0.1.1')
    })

    it('NIT-1: a CCB-bumped revision advances Rev Z -> Rev AA, never wrapping to Rev A', async () => {
      // A CI seeded at the last single-letter revision. The CCB ceremony's
      // revision bump must go Z -> AA (a non-colliding label), not wrap to A.
      const ci = await prisma.configItem.create({
        data: {
          projectId: openProjectId,
          ciKey: `CI-MDL-REVZ-${ts}`,
          name: 'Rev-Z CI',
          type: 'Model',
          status: 'Draft',
          lockState: 'Unlocked',
          version: '1.0.0',
          revision: 'Rev Z',
        },
      })
      const res = await request(app)
        .post(`/api/v1/ccb-decisions/${openProjectId}/sign`)
        .set('Authorization', `Bearer ${memberToken}`)
        .set(reauthHeader(memberId))
        .send({
          changeRequestId,
          ccbLevel: 'SystemCCB',
          decision: 'Approved',
          impactedConfigItemIds: [{ itemType: 'configItem', itemId: ci.id }],
        })
      expect(res.status).toBe(201)

      const bumped = await prisma.configItem.findUnique({ where: { id: ci.id } })
      expect(bumped?.revision).toBe('Rev AA')
    })

    it('lists CCB decisions for a project and for a change request (200)', async () => {
      const byProject = await request(app)
        .get(`/api/v1/ccb-decisions/${openProjectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(byProject.status).toBe(200)
      expect(byProject.body.data.length).toBeGreaterThanOrEqual(2)

      const byCr = await request(app)
        .get(`/api/v1/ccb-decisions/${openProjectId}/by-change-request/${changeRequestId}`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(byCr.status).toBe(200)
      expect(byCr.body.data.every((d: { changeRequestId: string }) => d.changeRequestId === changeRequestId)).toBe(true)
    })

    it('R-6: a safety-impacting CCB decision in a STRICT project needs a Safety Engineer (403)', async () => {
      // The member holds CCB Member but NOT Safety Engineer on the strict project.
      const cr = await prisma.changeRequest.create({
        data: {
          projectId: strictProjectId,
          crId: `CR-CM-STRICT-${ts}`,
          title: 'Strict safety CR',
          description: 'Safety-impacting',
          sourceType: 'requirement',
          sourceId: 'seed-source',
        },
      })
      const res = await request(app)
        .post(`/api/v1/ccb-decisions/${strictProjectId}/sign`)
        .set('Authorization', `Bearer ${memberToken}`)
        .set(reauthHeader(memberId))
        .send({
          changeRequestId: cr.id,
          ccbLevel: 'SafetyCCB',
          decision: 'Approved',
          safetyImpact: true,
        })
      expect(res.status).toBe(403)
    })

    it('R-6: a NON-safety CCB decision in a strict project signs without a Safety Engineer (201)', async () => {
      const cr = await prisma.changeRequest.create({
        data: {
          projectId: strictProjectId,
          crId: `CR-CM-STRICT2-${ts}`,
          title: 'Strict non-safety CR',
          description: 'No safety impact',
          sourceType: 'requirement',
          sourceId: 'seed-source',
        },
      })
      const res = await request(app)
        .post(`/api/v1/ccb-decisions/${strictProjectId}/sign`)
        .set('Authorization', `Bearer ${memberToken}`)
        .set(reauthHeader(memberId))
        .send({
          changeRequestId: cr.id,
          ccbLevel: 'SystemCCB',
          decision: 'Approved',
          safetyImpact: false,
        })
      expect(res.status).toBe(201)
    })

    it('R-6: a CCB decision impacting a safety-critical CI is treated as safety-impacting server-side (403)', async () => {
      // The client claims safetyImpact:false, but an impacted CI is
      // safety-critical — the server-derived flag raises it to true, so the
      // strict-mode Safety-Engineer gate fires (the member is CCB Member only).
      const safetyCi = await prisma.configItem.create({
        data: {
          projectId: strictProjectId,
          ciKey: `CI-SAF-${ts}`,
          name: 'Server-derived safety CI',
          type: 'SafetyArtifact',
          status: 'Draft',
          lockState: 'Unlocked',
          version: '0.1.0',
          revision: 'Rev 0',
          safetyCritical: true,
        },
      })
      const cr = await prisma.changeRequest.create({
        data: {
          projectId: strictProjectId,
          crId: `CR-CM-SAFEDERIVE-${ts}`,
          title: 'Strict CR impacting a safety CI',
          description: 'Client under-claims safety impact',
          sourceType: 'requirement',
          sourceId: 'seed-source',
        },
      })
      const res = await request(app)
        .post(`/api/v1/ccb-decisions/${strictProjectId}/sign`)
        .set('Authorization', `Bearer ${memberToken}`)
        .set(reauthHeader(memberId))
        .send({
          changeRequestId: cr.id,
          ccbLevel: 'SystemCCB',
          decision: 'Approved',
          safetyImpact: false, // client under-claims — server overrides
          impactedConfigItemIds: [{ itemType: 'configItem', itemId: safetyCi.id }],
        })
      expect(res.status).toBe(403)
    })
  })

  // --- CM Baseline (CM-N6) -------------------------------------------------

  describe('CM Baseline (CM-N6)', () => {
    let baselineCiId: string

    beforeAll(async () => {
      const ci = await request(app)
        .post(`/api/v1/config-items/${openProjectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ name: 'Baseline-target CI', type: 'Document' })
      baselineCiId = ci.body.data.id
    })

    it('rejects an unauthenticated request (401)', async () => {
      const res = await request(app).get(`/api/v1/config-items/${openProjectId}/baselines`)
      expect(res.status).toBe(401)
    })

    it('creates a CM baseline (kind=CM) snapshotting the project ConfigItems (201)', async () => {
      const res = await request(app)
        .post(`/api/v1/config-items/${openProjectId}/baselines`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ name: 'CDR baseline' })
      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.kind).toBe('CM')
      expect(res.body.data.status).toBe('draft')
      // Every non-deleted CI in the project is snapshotted as a ConfigItem item.
      expect(Array.isArray(res.body.data.items)).toBe(true)
      expect(res.body.data.items.length).toBeGreaterThan(0)
      expect(
        res.body.data.items.every(
          (i: { linkedEntityType: string }) => i.linkedEntityType === 'ConfigItem',
        ),
      ).toBe(true)
      // The target CI is in the snapshot, content-hashed.
      const item = res.body.data.items.find(
        (i: { linkedEntityId: string }) => i.linkedEntityId === baselineCiId,
      )
      expect(item).toBeTruthy()
      expect(item.contentHash).toMatch(/^[0-9a-f]{64}$/)
    })

    it('rejects a baseline create with no name (400)', async () => {
      const res = await request(app)
        .post(`/api/v1/config-items/${openProjectId}/baselines`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({})
      expect(res.status).toBe(400)
    })

    it('lists CM baselines (200) and reads one back with its items (200)', async () => {
      const list = await request(app)
        .get(`/api/v1/config-items/${openProjectId}/baselines`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(list.status).toBe(200)
      expect(list.body.data.length).toBeGreaterThanOrEqual(1)
      expect(list.body.data.every((b: { kind: string }) => b.kind === 'CM')).toBe(true)

      const one = await request(app)
        .get(`/api/v1/config-items/${openProjectId}/baselines/${list.body.data[0].id}`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(one.status).toBe(200)
      expect(Array.isArray(one.body.data.items)).toBe(true)
    })

    it('adds a single ConfigItem snapshot to a draft baseline, freezes it, then rejects further adds (409)', async () => {
      // A fresh draft baseline scoped to one CI.
      const created = await request(app)
        .post(`/api/v1/config-items/${openProjectId}/baselines`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ name: 'Freeze-test baseline', configItemIds: [baselineCiId] })
      const baselineId = created.body.data.id

      // A second CI added one at a time while the baseline is still draft.
      const extra = await request(app)
        .post(`/api/v1/config-items/${openProjectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ name: 'Late-added CI', type: 'Model' })
      const added = await request(app)
        .post(`/api/v1/config-items/${openProjectId}/baselines/${baselineId}/items`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ configItemId: extra.body.data.id })
      expect(added.status).toBe(201)
      expect(added.body.data.linkedEntityType).toBe('ConfigItem')

      // Freeze — draft -> frozen.
      const frozen = await request(app)
        .post(`/api/v1/config-items/${openProjectId}/baselines/${baselineId}/freeze`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(frozen.status).toBe(200)
      expect(frozen.body.data.status).toBe('frozen')

      // A frozen baseline rejects further items (409).
      const blocked = await request(app)
        .post(`/api/v1/config-items/${openProjectId}/baselines/${baselineId}/items`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ configItemId: baselineCiId })
      expect(blocked.status).toBe(409)
    })

    it('compares two CM baselines and reports the added ConfigItem (200)', async () => {
      // Baseline A — only the original target CI.
      const a = await request(app)
        .post(`/api/v1/config-items/${openProjectId}/baselines`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ name: 'Compare A', configItemIds: [baselineCiId] })
      // A new CI, then baseline B — the target CI plus the new one.
      const newCi = await request(app)
        .post(`/api/v1/config-items/${openProjectId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ name: 'Added-since-A CI', type: 'Hardware' })
      const b = await request(app)
        .post(`/api/v1/config-items/${openProjectId}/baselines`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ name: 'Compare B', configItemIds: [baselineCiId, newCi.body.data.id] })

      const diff = await request(app)
        .get(`/api/v1/config-items/${openProjectId}/baselines/compare`)
        .query({ aId: a.body.data.id, bId: b.body.data.id })
        .set('Authorization', `Bearer ${memberToken}`)
      expect(diff.status).toBe(200)
      expect(
        diff.body.data.added.some(
          (i: { linkedEntityId: string }) => i.linkedEntityId === newCi.body.data.id,
        ),
      ).toBe(true)
      expect(diff.body.data.removed.length).toBe(0)
    })

    it('returns 404 for a baseline id from another project', async () => {
      // A CM baseline created in the strict project is not visible from the
      // open project — the kind+project scope guards cross-tenant reads.
      const foreign = await request(app)
        .post(`/api/v1/config-items/${strictProjectId}/baselines`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ name: 'Foreign baseline' })
      const res = await request(app)
        .get(`/api/v1/config-items/${openProjectId}/baselines/${foreign.body.data.id}`)
        .set('Authorization', `Bearer ${memberToken}`)
      expect(res.status).toBe(404)
    })
  })
})
