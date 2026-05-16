/**
 * N-2.1 — CFR 21 Part 11 electronic signature on the Validation item sign-off.
 *
 * Covers issue #422 acceptance criteria 1, 2, 3, 5, 6:
 *  - AC #1: the sign-off / revoke routes are gated by authenticateToken then
 *    requireReauth — a request with no / expired / wrong-user X-Reauth-Token
 *    is rejected 401.
 *  - AC #2: a successful sign-off records a SignatureEvent via createSignature
 *    with the signer from req.user (never the body), reauthAt, signedAt, a
 *    valid Part 11 meaningCode, and a server-computed contentHash.
 *  - AC #3: a signed item is immutable — a post-sign content edit is rejected;
 *    a pure status change is still allowed; revoke lifts the lock.
 *  - revoke appends a superseding SignatureEvent.
 *  - AC #5: an AuditLog row records the signing event.
 *
 * Real DB, no mocks (.claude/testing.md). Isolated data, unique timestamps,
 * full afterAll cleanup.
 *
 * Cleanup caveat: the SignatureEvent append-only $use middleware blocks Prisma
 * deletes — test SignatureEvent rows are removed with prisma.$executeRaw
 * (raw SQL bypasses the middleware), the pattern in signatureEvent.test.ts.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { app } from '../../server'
import { prisma } from '../../lib/prisma'

describe('N-2.1 — CFR 21 Part 11 e-signature on Validation sign-off', () => {
  const stamp = Date.now()
  const secret = process.env.JWT_SECRET || 'secret'
  const approverPassword = 'val-signoff-pw-12345'

  let authorId: string
  let approverId: string
  let approverToken: string
  let projectId: string
  const itemIds: string[] = []

  /** A fresh 60s reauth token for the approver via POST /auth/reauth. */
  async function freshReauthToken(): Promise<string> {
    const res = await request(app)
      .post('/api/v1/auth/reauth')
      .set('Authorization', `Bearer ${approverToken}`)
      .send({ password: approverPassword })
    expect(res.status).toBe(200)
    return res.body.data.reauthToken as string
  }

  /** Create an EXECUTED item authored by `authorId` (so the approver may sign). */
  async function makeExecutedItem(title: string): Promise<string> {
    const item = await prisma.validationItem.create({
      data: {
        projectId,
        key: `VAL-SIG-${stamp}-${itemIds.length + 1}`,
        title,
        description: 'Signature test item',
        methodType: 'DEMONSTRATION',
        targetMilestone: 'CDR',
        status: 'EXECUTED',
        priority: 'medium',
        criteria: [],
        createdById: authorId,
      },
    })
    itemIds.push(item.id)
    return item.id
  }

  beforeAll(async () => {
    const author = await prisma.user.create({
      data: {
        email: `val-sig-author-${stamp}@example.com`,
        password: 'hashed',
        name: 'Sig Author',
      },
    })
    // The reauth endpoint validates the password with bcrypt — the approver
    // needs a real hash, not the plain 'hashed' placeholder.
    const approver = await prisma.user.create({
      data: {
        email: `val-sig-approver-${stamp}@example.com`,
        password: await bcrypt.hash(approverPassword, 10),
        name: 'Sig Approver',
      },
    })
    authorId = author.id
    approverId = approver.id

    const slug = `val-sig-${stamp}`
    const project = await prisma.project.create({
      data: { name: `Val Sig ${stamp}`, domain: slug, slug, userId: authorId },
    })
    projectId = project.id

    await prisma.projectMember.createMany({
      data: [
        { projectId, userId: authorId, role: 'owner', status: 'accepted' },
        { projectId, userId: approverId, role: 'editor', status: 'accepted' },
      ],
    })

    // Sign-off requires the Validation Approver engineering role on the project.
    const approverRole = await prisma.engineeringRole.upsert({
      where: { name: 'Validation Approver' },
      update: {},
      create: {
        name: 'Validation Approver',
        description: 'Authorised to sign off Validation items.',
        isSystem: true,
      },
    })
    await prisma.projectUserEngineeringRole.create({
      data: { projectId, userId: approverId, roleId: approverRole.id },
    })

    // Session token via the real login flow so the approver token is genuine.
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: approver.email, password: approverPassword })
    approverToken = login.body.data.token
  })

  afterAll(async () => {
    // SignatureEvent is append-only — raw SQL bypasses the $use guard.
    await prisma.$executeRaw`DELETE FROM "SignatureEvent" WHERE "linkedEntityType" = 'ValidationItem' AND "linkedEntityId" = ANY(${itemIds})`
    await prisma.validationSignOff.deleteMany({
      where: { validationItem: { projectId } },
    })
    await prisma.validationItem.deleteMany({ where: { projectId } })
    // Delete by userId too: POST /auth/reauth writes auth:reauth-* rows scoped
    // to the user with no projectId, so a projectId-only filter leaves them and
    // the user delete fails the AuditLog_userId_fkey.
    await prisma.auditLog.deleteMany({
      where: { OR: [{ projectId }, { userId: { in: [authorId, approverId] } }] },
    })
    await prisma.projectUserEngineeringRole.deleteMany({ where: { projectId } })
    await prisma.projectMember.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } })
    await prisma.user.deleteMany({ where: { id: { in: [authorId, approverId] } } })
    await prisma.$disconnect()
  })

  // ---- AC #1: requireReauth gates the sign-off route -----------------------

  it('rejects a sign-off with no X-Reauth-Token header (401)', async () => {
    const itemId = await makeExecutedItem('No reauth header')
    const res = await request(app)
      .post(`/api/v1/validation/projects/${projectId}/items/${itemId}/sign-off`)
      .set('Authorization', `Bearer ${approverToken}`)
      .send({ signerRoleLabel: 'Customer Lead' })
    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
    expect(res.body.error).toMatch(/reauthentication required/i)
    // The item did NOT sign off.
    const item = await prisma.validationItem.findUniqueOrThrow({ where: { id: itemId } })
    expect(item.status).toBe('EXECUTED')
  })

  it('rejects a sign-off with an expired reauth token (401)', async () => {
    const itemId = await makeExecutedItem('Expired reauth token')
    const expired = jwt.sign(
      { userId: approverId, purpose: 'reauth' },
      secret,
      { expiresIn: -10 },
    )
    const res = await request(app)
      .post(`/api/v1/validation/projects/${projectId}/items/${itemId}/sign-off`)
      .set('Authorization', `Bearer ${approverToken}`)
      .set('X-Reauth-Token', expired)
      .send({ signerRoleLabel: 'Customer Lead' })
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/expired/i)
  })

  it('rejects a sign-off with a wrong-user reauth token (401)', async () => {
    const itemId = await makeExecutedItem('Wrong-user reauth token')
    // A token minted for the author, presented on the approver's session.
    const wrongUser = jwt.sign(
      { userId: authorId, purpose: 'reauth' },
      secret,
      { expiresIn: '60s' },
    )
    const res = await request(app)
      .post(`/api/v1/validation/projects/${projectId}/items/${itemId}/sign-off`)
      .set('Authorization', `Bearer ${approverToken}`)
      .set('X-Reauth-Token', wrongUser)
      .send({ signerRoleLabel: 'Customer Lead' })
    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/does not match/i)
  })

  // ---- AC #2: happy path records a SignatureEvent --------------------------

  it('signs off with a valid reauth token, flips status, records a SignatureEvent', async () => {
    const itemId = await makeExecutedItem('Happy path sign-off')
    const before = new Date()
    const res = await request(app)
      .post(`/api/v1/validation/projects/${projectId}/items/${itemId}/sign-off`)
      .set('Authorization', `Bearer ${approverToken}`)
      .set('X-Reauth-Token', await freshReauthToken())
      .send({ signerRoleLabel: 'Customer Operations Lead', comment: 'Looks good' })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)

    // The item is now VALIDATED.
    const item = await prisma.validationItem.findUniqueOrThrow({ where: { id: itemId } })
    expect(item.status).toBe('VALIDATED')

    // A SignatureEvent row was recorded with the correct fields.
    const sigs = await prisma.signatureEvent.findMany({
      where: { linkedEntityType: 'ValidationItem', linkedEntityId: itemId },
    })
    expect(sigs.length).toBe(1)
    const sig = sigs[0]
    // Signer is the session user (approver), NOT taken from any body field.
    expect(sig.signerUserId).toBe(approverId)
    expect(sig.meaningCode).toBe('approval')
    // contentHash is a deterministic 64-char sha256 hex digest.
    expect(sig.contentHash).toMatch(/^[0-9a-f]{64}$/)
    // reauthAt + signedAt are server-stamped at sign time.
    expect(sig.reauthAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(sig.signedAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(sig.supersededById).toBeNull()
  })

  it('does not let the request body forge the signer identity', async () => {
    const itemId = await makeExecutedItem('Body cannot forge signer')
    const res = await request(app)
      .post(`/api/v1/validation/projects/${projectId}/items/${itemId}/sign-off`)
      .set('Authorization', `Bearer ${approverToken}`)
      .set('X-Reauth-Token', await freshReauthToken())
      // A hostile body attempts to attribute the signature to the author.
      .send({ signerRoleLabel: 'QA', signerUserId: authorId, signerId: authorId })
    expect(res.status).toBe(201)
    const sig = await prisma.signatureEvent.findFirstOrThrow({
      where: { linkedEntityType: 'ValidationItem', linkedEntityId: itemId },
    })
    // The signer is the authenticated approver — the body fields are ignored.
    expect(sig.signerUserId).toBe(approverId)
  })

  // ---- AC #5: AuditLog records the signing event ---------------------------

  it('writes a validation:sign-off AuditLog row for the signing event', async () => {
    const itemId = await makeExecutedItem('Audit row on sign-off')
    const before = new Date()
    const res = await request(app)
      .post(`/api/v1/validation/projects/${projectId}/items/${itemId}/sign-off`)
      .set('Authorization', `Bearer ${approverToken}`)
      .set('X-Reauth-Token', await freshReauthToken())
      .send({ signerRoleLabel: 'Customer Lead' })
    expect(res.status).toBe(201)
    const row = await prisma.auditLog.findFirst({
      where: {
        projectId,
        action: 'validation:sign-off',
        userId: approverId,
        createdAt: { gte: before },
      },
      orderBy: { createdAt: 'desc' },
    })
    expect(row).not.toBeNull()
  })

  // ---- AC #3: a signed item is immutable -----------------------------------

  it('rejects a content edit to a signed item, but allows a pure status change', async () => {
    const itemId = await makeExecutedItem('Immutable when signed')
    const signRes = await request(app)
      .post(`/api/v1/validation/projects/${projectId}/items/${itemId}/sign-off`)
      .set('Authorization', `Bearer ${approverToken}`)
      .set('X-Reauth-Token', await freshReauthToken())
      .send({ signerRoleLabel: 'Customer Lead' })
    expect(signRes.status).toBe(201)

    // A content-field edit (title) is rejected with 400.
    const editRes = await request(app)
      .put(`/api/v1/validation/projects/${projectId}/items/${itemId}`)
      .set('Authorization', `Bearer ${approverToken}`)
      .send({ title: 'Renamed after signing' })
    expect(editRes.status).toBe(400)
    expect(editRes.body.error).toMatch(/active sign-off/i)
    // The title is genuinely unchanged.
    const stillSigned = await prisma.validationItem.findUniqueOrThrow({
      where: { id: itemId },
    })
    expect(stillSigned.title).toBe('Immutable when signed')

    // A pure status change (VALIDATED -> EXECUTED, a legal transition) is
    // still allowed — only content fields are frozen.
    const statusRes = await request(app)
      .put(`/api/v1/validation/projects/${projectId}/items/${itemId}`)
      .set('Authorization', `Bearer ${approverToken}`)
      .send({ status: 'EXECUTED' })
    expect(statusRes.status).toBe(200)
  })

  // ---- revoke appends a superseding SignatureEvent + lifts the lock --------

  it('revoke supersedes the SignatureEvent, demotes the item, lifts the immutability lock', async () => {
    const itemId = await makeExecutedItem('Revoke flow')
    const signRes = await request(app)
      .post(`/api/v1/validation/projects/${projectId}/items/${itemId}/sign-off`)
      .set('Authorization', `Bearer ${approverToken}`)
      .set('X-Reauth-Token', await freshReauthToken())
      .send({ signerRoleLabel: 'Customer Lead' })
    expect(signRes.status).toBe(201)
    const signOffId = signRes.body.data.id as string

    const original = await prisma.signatureEvent.findFirstOrThrow({
      where: { linkedEntityType: 'ValidationItem', linkedEntityId: itemId },
    })

    // Revoke also requires reauth.
    const before = new Date()
    const revokeRes = await request(app)
      .post(
        `/api/v1/validation/projects/${projectId}/items/${itemId}/sign-off/${signOffId}/revoke`,
      )
      .set('Authorization', `Bearer ${approverToken}`)
      .set('X-Reauth-Token', await freshReauthToken())
      .send({})
    expect(revokeRes.status).toBe(200)

    // The original SignatureEvent now carries supersededById on a NEW row.
    const chain = await prisma.signatureEvent.findMany({
      where: { linkedEntityType: 'ValidationItem', linkedEntityId: itemId },
      orderBy: { signedAt: 'asc' },
    })
    expect(chain.length).toBe(2)
    const revocation = chain.find((s) => s.supersededById === original.id)
    expect(revocation).toBeDefined()
    expect(revocation!.signerUserId).toBe(approverId)
    expect(revocation!.meaningCode).toBe('approval')
    // The superseded original row is intact.
    const rereadOriginal = chain.find((s) => s.id === original.id)
    expect(rereadOriginal!.supersededById).toBeNull()
    expect(rereadOriginal!.contentHash).toBe(original.contentHash)

    // The item dropped back to EXECUTED.
    const item = await prisma.validationItem.findUniqueOrThrow({ where: { id: itemId } })
    expect(item.status).toBe('EXECUTED')

    // An AuditLog row recorded the revocation.
    const auditRow = await prisma.auditLog.findFirst({
      where: {
        projectId,
        action: 'validation:sign-off-revoke',
        userId: approverId,
        createdAt: { gte: before },
      },
    })
    expect(auditRow).not.toBeNull()

    // The immutability lock is lifted — a content edit now succeeds.
    const editRes = await request(app)
      .put(`/api/v1/validation/projects/${projectId}/items/${itemId}`)
      .set('Authorization', `Bearer ${approverToken}`)
      .send({ title: 'Editable again after revoke' })
    expect(editRes.status).toBe(200)
    expect(editRes.body.data.title).toBe('Editable again after revoke')
  })

  it('rejects a revoke with no reauth token (401)', async () => {
    const itemId = await makeExecutedItem('Revoke needs reauth')
    const signRes = await request(app)
      .post(`/api/v1/validation/projects/${projectId}/items/${itemId}/sign-off`)
      .set('Authorization', `Bearer ${approverToken}`)
      .set('X-Reauth-Token', await freshReauthToken())
      .send({ signerRoleLabel: 'Customer Lead' })
    expect(signRes.status).toBe(201)
    const signOffId = signRes.body.data.id as string

    const revokeRes = await request(app)
      .post(
        `/api/v1/validation/projects/${projectId}/items/${itemId}/sign-off/${signOffId}/revoke`,
      )
      .set('Authorization', `Bearer ${approverToken}`)
      .send({})
    expect(revokeRes.status).toBe(401)
    expect(revokeRes.body.error).toMatch(/reauthentication required/i)
    // The sign-off is untouched — still active, item still VALIDATED.
    const item = await prisma.validationItem.findUniqueOrThrow({ where: { id: itemId } })
    expect(item.status).toBe('VALIDATED')
  })
})
