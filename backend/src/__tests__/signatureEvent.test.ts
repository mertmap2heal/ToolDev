import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '../lib/prisma'
import {
  createSignature,
  getSignatures,
  supersedeSignature,
} from '../services/signature.service'

/**
 * R-3 (#398) — universal CFR 21 Part 11 SignatureEvent primitive.
 *
 * Covers AC #6:
 *  - createSignature creates a row; getSignatures reads it back.
 *  - supersedeSignature appends a revocation row carrying supersededById; the
 *    superseded row stays intact and unchanged.
 *  - the append-only invariant: a direct prisma.signatureEvent.update / delete
 *    is rejected by the lib/prisma.ts $use middleware.
 *  - an invalid meaningCode is rejected by createSignature / supersedeSignature.
 *
 * Real DB, no mocks; isolated data with a unique timestamped linkedEntityId.
 *
 * Cleanup caveat: the append-only middleware blocks prisma.signatureEvent
 * .delete / .deleteMany — so afterAll cannot delete SignatureEvent rows via
 * the Prisma API. Test rows are removed with prisma.$executeRaw (raw SQL
 * bypasses the $use middleware). The test user is deleted normally.
 */
describe('R-3 — SignatureEvent universal sign-off primitive', () => {
  const ts = Date.now()
  const linkedEntityType = 'ValidationItem'
  const linkedEntityId = `signature-test-entity-${ts}`
  let userId: string

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `signature-test-${ts}@example.com`,
        password: 'hashedpassword',
        name: 'Signature Test User',
      },
    })
    userId = user.id
  })

  afterAll(async () => {
    // The append-only middleware blocks Prisma deletes on SignatureEvent —
    // clean test rows with raw SQL, which bypasses the $use middleware.
    await prisma.$executeRaw`DELETE FROM "SignatureEvent" WHERE "linkedEntityId" = ${linkedEntityId}`
    await prisma.user.delete({ where: { id: userId } })
    await prisma.$disconnect()
  })

  it('createSignature creates a row and getSignatures reads it back', async () => {
    const sig = await createSignature({
      linkedEntityType,
      linkedEntityId,
      signerUserId: userId,
      meaningCode: 'approval',
      reauthAt: new Date(),
      signedPayload: JSON.stringify({ artefact: 'snapshot-A' }),
    })

    expect(sig.id).toBeDefined()
    expect(sig.linkedEntityType).toBe(linkedEntityType)
    expect(sig.linkedEntityId).toBe(linkedEntityId)
    expect(sig.signerUserId).toBe(userId)
    expect(sig.meaningCode).toBe('approval')
    expect(sig.supersededById).toBeNull()
    // contentHash is a deterministic sha256 hex digest of the payload.
    expect(sig.contentHash).toMatch(/^[0-9a-f]{64}$/)

    const chain = await getSignatures(linkedEntityType, linkedEntityId)
    expect(chain.length).toBe(1)
    expect(chain[0].id).toBe(sig.id)
  })

  it('createSignature computes the same contentHash for the same payload', async () => {
    const payload = JSON.stringify({ artefact: 'deterministic' })
    const a = await createSignature({
      linkedEntityType,
      linkedEntityId,
      signerUserId: userId,
      meaningCode: 'review',
      reauthAt: new Date(),
      signedPayload: payload,
    })
    const b = await createSignature({
      linkedEntityType,
      linkedEntityId,
      signerUserId: userId,
      meaningCode: 'review',
      reauthAt: new Date(),
      signedPayload: payload,
    })
    expect(a.contentHash).toBe(b.contentHash)
  })

  it('supersedeSignature appends a revocation row; the superseded row is intact', async () => {
    const original = await createSignature({
      linkedEntityType,
      linkedEntityId,
      signerUserId: userId,
      meaningCode: 'approval',
      reauthAt: new Date(),
      signedPayload: JSON.stringify({ artefact: 'snapshot-to-revoke' }),
    })

    const revocation = await supersedeSignature({
      supersededSignatureId: original.id,
      signerUserId: userId,
      meaningCode: 'approval',
      reauthAt: new Date(),
      signedPayload: JSON.stringify({ artefact: 'revocation' }),
    })

    // The revocation is a NEW row carrying supersededById.
    expect(revocation.id).not.toBe(original.id)
    expect(revocation.supersededById).toBe(original.id)
    expect(revocation.linkedEntityType).toBe(linkedEntityType)
    expect(revocation.linkedEntityId).toBe(linkedEntityId)

    // The superseded row is untouched — same fields as at creation, no
    // supersededById written onto it.
    const reread = await prisma.signatureEvent.findUniqueOrThrow({
      where: { id: original.id },
    })
    expect(reread.supersededById).toBeNull()
    expect(reread.contentHash).toBe(original.contentHash)
    expect(reread.meaningCode).toBe(original.meaningCode)
    expect(reread.signedAt.getTime()).toBe(original.signedAt.getTime())

    // Both rows are reachable through the chain.
    const chain = await getSignatures(linkedEntityType, linkedEntityId)
    const ids = chain.map((s) => s.id)
    expect(ids).toContain(original.id)
    expect(ids).toContain(revocation.id)
  })

  it('append-only invariant: a direct prisma.signatureEvent.update is rejected', async () => {
    const sig = await createSignature({
      linkedEntityType,
      linkedEntityId,
      signerUserId: userId,
      meaningCode: 'authorship',
      reauthAt: new Date(),
      signedPayload: JSON.stringify({ artefact: 'no-update' }),
    })

    await expect(
      prisma.signatureEvent.update({
        where: { id: sig.id },
        data: { meaningCode: 'review' },
      }),
    ).rejects.toThrow(/append-only/i)

    // The row is genuinely unchanged.
    const reread = await prisma.signatureEvent.findUniqueOrThrow({ where: { id: sig.id } })
    expect(reread.meaningCode).toBe('authorship')
  })

  it('append-only invariant: a direct prisma.signatureEvent.delete is rejected', async () => {
    const sig = await createSignature({
      linkedEntityType,
      linkedEntityId,
      signerUserId: userId,
      meaningCode: 'responsibility',
      reauthAt: new Date(),
      signedPayload: JSON.stringify({ artefact: 'no-delete' }),
    })

    await expect(
      prisma.signatureEvent.delete({ where: { id: sig.id } }),
    ).rejects.toThrow(/append-only/i)

    // The row still exists.
    const reread = await prisma.signatureEvent.findUnique({ where: { id: sig.id } })
    expect(reread).not.toBeNull()
  })

  it('append-only invariant: deleteMany and updateMany on SignatureEvent are rejected', async () => {
    await expect(
      prisma.signatureEvent.deleteMany({ where: { linkedEntityId } }),
    ).rejects.toThrow(/append-only/i)

    await expect(
      prisma.signatureEvent.updateMany({
        where: { linkedEntityId },
        data: { meaningCode: 'review' },
      }),
    ).rejects.toThrow(/append-only/i)
  })

  it('createSignature rejects an invalid meaningCode', async () => {
    await expect(
      createSignature({
        linkedEntityType,
        linkedEntityId,
        signerUserId: userId,
        meaningCode: 'witness',
        reauthAt: new Date(),
        signedPayload: JSON.stringify({ artefact: 'bad-meaning' }),
      }),
    ).rejects.toThrow(/invalid signature meaningcode/i)

    // No row was written for the rejected call.
    const chain = await getSignatures(linkedEntityType, linkedEntityId)
    expect(chain.every((s) => s.meaningCode !== 'witness')).toBe(true)
  })

  it('supersedeSignature rejects an invalid meaningCode', async () => {
    const original = await createSignature({
      linkedEntityType,
      linkedEntityId,
      signerUserId: userId,
      meaningCode: 'approval',
      reauthAt: new Date(),
      signedPayload: JSON.stringify({ artefact: 'supersede-bad-meaning' }),
    })

    await expect(
      supersedeSignature({
        supersededSignatureId: original.id,
        signerUserId: userId,
        meaningCode: 'notarisation',
        reauthAt: new Date(),
        signedPayload: JSON.stringify({ artefact: 'revocation' }),
      }),
    ).rejects.toThrow(/invalid signature meaningcode/i)
  })

  it('supersedeSignature throws when the superseded signature does not exist', async () => {
    await expect(
      supersedeSignature({
        supersededSignatureId: `nonexistent-${ts}`,
        signerUserId: userId,
        meaningCode: 'approval',
        reauthAt: new Date(),
        signedPayload: JSON.stringify({ artefact: 'revocation' }),
      }),
    ).rejects.toThrow(/not found/i)
  })
})
