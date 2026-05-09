/**
 * Tests for /api/v1/ai/credentials — BYOK credential CRUD.
 *
 * The controller is user-scoped: a credential row belongs to the
 * authenticated user and cannot be reached by another user, even an
 * admin. Plaintext is encrypted at rest; only `maskedTail` and the row
 * id are returned to the caller. These tests exercise the happy path
 * (list, create, revoke), validation, auth guard, and the user-isolation
 * contract.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('AI credentials — /api/v1/ai/credentials', () => {
  const stamp = Date.now()
  let userAId: string
  let userBId: string
  let tokenA: string
  let tokenB: string
  // Track every credential we create so afterAll can purge them even
  // when a test bails out before its own cleanup.
  const createdCredentialIds: string[] = []

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    if (!process.env.AI_CREDENTIAL_KEY && !process.env.JWT_SECRET) {
      // The encryptor needs *some* key. The service falls back to
      // JWT_SECRET; vitest env always sets it, but be explicit.
      process.env.JWT_SECRET = 'secret'
    }

    const userA = await prisma.user.create({
      data: { email: `aicred-a-${stamp}@example.test`, password: 'x', name: 'AICred A' },
    })
    userAId = userA.id
    tokenA = jwt.sign({ userId: userA.id }, secret)

    const userB = await prisma.user.create({
      data: { email: `aicred-b-${stamp}@example.test`, password: 'x', name: 'AICred B' },
    })
    userBId = userB.id
    tokenB = jwt.sign({ userId: userB.id }, secret)
  })

  afterAll(async () => {
    await prisma.userAiCredential
      .deleteMany({ where: { userId: { in: [userAId, userBId] } } })
      .catch(() => {})
    await prisma.user
      .deleteMany({ where: { id: { in: [userAId, userBId] } } })
      .catch(() => {})
    await prisma.$disconnect()
  })

  it('GET /credentials returns 401 without a token', async () => {
    const res = await request(app).get('/api/v1/ai/credentials')
    expect(res.status).toBe(401)
  })

  it('GET /credentials returns an empty array for a user with no credentials', async () => {
    const res = await request(app)
      .get('/api/v1/ai/credentials')
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBe(0)
  })

  it('POST /credentials rejects payload missing required fields with 400', async () => {
    const res = await request(app)
      .post('/api/v1/ai/credentials')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ provider: 'anthropic' })
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('POST /credentials rejects an unsupported provider with 400', async () => {
    const res = await request(app)
      .post('/api/v1/ai/credentials')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ provider: 'not-a-real-provider', label: 'x', plaintextKey: 'sk-12345678' })
    expect(res.status).toBe(400)
  })

  it('POST /credentials creates an encrypted row, returns id + maskedTail (no plaintext)', async () => {
    const res = await request(app)
      .post('/api/v1/ai/credentials')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        provider: 'anthropic',
        label: `lbl-${stamp}`,
        plaintextKey: 'sk-ant-abcd1234EFGH',
        scopes: ['draft'],
      })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.id).toBeDefined()
    expect(res.body.data.maskedTail).toBe('EFGH')
    // Plaintext must NOT be echoed back in any field.
    const blob = JSON.stringify(res.body.data)
    expect(blob).not.toContain('sk-ant-abcd1234EFGH')

    createdCredentialIds.push(res.body.data.id)

    // Verify on-disk shape: row is owned by user A, ciphertext non-empty.
    const row = await prisma.userAiCredential.findUnique({ where: { id: res.body.data.id } })
    expect(row?.userId).toBe(userAId)
    expect(row?.keyCiphertext.length).toBeGreaterThan(0)
    expect(row?.keyCiphertext).not.toContain('sk-ant-abcd1234EFGH')
  })

  it('GET /credentials only returns credentials owned by the caller', async () => {
    // Pre-condition: user A has the row from the previous test, user B
    // has none.
    const aRes = await request(app)
      .get('/api/v1/ai/credentials')
      .set('Authorization', `Bearer ${tokenA}`)
    expect(aRes.status).toBe(200)
    const aIds = (aRes.body.data as Array<{ id: string }>).map((r) => r.id)
    expect(aIds).toEqual(expect.arrayContaining(createdCredentialIds))

    const bRes = await request(app)
      .get('/api/v1/ai/credentials')
      .set('Authorization', `Bearer ${tokenB}`)
    expect(bRes.status).toBe(200)
    const bIds = (bRes.body.data as Array<{ id: string }>).map((r) => r.id)
    for (const id of createdCredentialIds) expect(bIds).not.toContain(id)
  })

  it('DELETE /credentials/:id by a non-owner returns 404 and does not revoke the row', async () => {
    const target = createdCredentialIds[0]
    expect(target).toBeDefined()
    const res = await request(app)
      .delete(`/api/v1/ai/credentials/${target}`)
      .set('Authorization', `Bearer ${tokenB}`)
    expect(res.status).toBe(404)
    const row = await prisma.userAiCredential.findUnique({ where: { id: target } })
    expect(row?.revokedAt).toBeNull()
  })

  it('DELETE /credentials/:id by the owner soft-revokes the row', async () => {
    const target = createdCredentialIds[0]
    const res = await request(app)
      .delete(`/api/v1/ai/credentials/${target}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    const row = await prisma.userAiCredential.findUnique({ where: { id: target } })
    expect(row?.revokedAt).not.toBeNull()
  })

  it('Subsequent LIST omits the revoked credential', async () => {
    const res = await request(app)
      .get('/api/v1/ai/credentials')
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(200)
    const ids = (res.body.data as Array<{ id: string }>).map((r) => r.id)
    expect(ids).not.toContain(createdCredentialIds[0])
  })

  it('DELETE on an unknown id returns 404', async () => {
    const res = await request(app)
      .delete('/api/v1/ai/credentials/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(404)
  })
})
