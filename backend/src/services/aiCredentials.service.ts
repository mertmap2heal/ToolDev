import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto'
import { prisma } from '../lib/prisma'

/**
 * BYOK (bring-your-own-key) storage. AES-256-GCM envelope per credential:
 *
 *   envelope = base64( iv(12B) || tag(16B) || ciphertext )
 *
 * The 32-byte DEK (data encryption key) is derived from
 * `AI_CREDENTIAL_KEY` env via SHA-256 so the operator can rotate without
 * changing the DB encoding. In production the DEK should come from a
 * managed KMS (Vault / AWS KMS / Azure Key Vault); this is the dev path.
 *
 * Plaintext never leaves `encryptKey` / `decryptKey`. Callers pass the
 * credential ID around, and the outbound HTTP handler calls `decryptKey`
 * exactly once for the single request.
 */

const ALGO = 'aes-256-gcm'
const IV_BYTES = 12
const TAG_BYTES = 16
const SUPPORTED_PROVIDERS = ['anthropic', 'openai', 'azure', 'google', 'self_hosted'] as const
export type AiProvider = (typeof SUPPORTED_PROVIDERS)[number]

function dek(): Buffer {
  const secret = process.env.AI_CREDENTIAL_KEY || process.env.JWT_SECRET
  if (!secret) {
    throw new Error('AI_CREDENTIAL_KEY (or JWT_SECRET fallback) must be set for BYOK')
  }
  return createHash('sha256').update(secret).digest()
}

export function encryptKey(plaintext: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGO, dek(), iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ct]).toString('base64')
}

export function decryptKey(envelope: string): string {
  const buf = Buffer.from(envelope, 'base64')
  if (buf.length < IV_BYTES + TAG_BYTES + 1) {
    throw new Error('malformed AI credential envelope')
  }
  const iv = buf.subarray(0, IV_BYTES)
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
  const ct = buf.subarray(IV_BYTES + TAG_BYTES)
  const decipher = createDecipheriv(ALGO, dek(), iv)
  decipher.setAuthTag(tag)
  const pt = Buffer.concat([decipher.update(ct), decipher.final()])
  return pt.toString('utf8')
}

function maskedTail(plaintext: string): string {
  return plaintext.slice(-4)
}

function assertProvider(p: string): AiProvider {
  if (!SUPPORTED_PROVIDERS.includes(p as AiProvider)) {
    throw new Error(`unsupported provider: ${p}`)
  }
  return p as AiProvider
}

export interface CreateCredentialInput {
  userId: string
  provider: string
  label: string
  plaintextKey: string
  scopes?: string[]
}

export async function createCredential(input: CreateCredentialInput) {
  const provider = assertProvider(input.provider)
  if (!input.plaintextKey || input.plaintextKey.length < 8) {
    throw new Error('API key must be at least 8 characters')
  }
  if (!input.label || input.label.trim().length === 0) {
    throw new Error('label is required')
  }
  const envelope = encryptKey(input.plaintextKey)
  return prisma.userAiCredential.create({
    data: {
      userId: input.userId,
      provider,
      label: input.label.trim(),
      keyCiphertext: envelope,
      maskedTail: maskedTail(input.plaintextKey),
      scopes: input.scopes ?? [],
    },
    select: publicFields,
  })
}

const publicFields = {
  id: true,
  userId: true,
  provider: true,
  label: true,
  maskedTail: true,
  scopes: true,
  lastUsedAt: true,
  revokedAt: true,
  createdAt: true,
  updatedAt: true,
} as const

export async function listCredentialsForUser(userId: string) {
  return prisma.userAiCredential.findMany({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: 'desc' },
    select: publicFields,
  })
}

export async function revokeCredential(userId: string, credentialId: string) {
  const existing = await prisma.userAiCredential.findFirst({
    where: { id: credentialId, userId, revokedAt: null },
  })
  if (!existing) {
    throw new Error('credential not found')
  }
  return prisma.userAiCredential.update({
    where: { id: credentialId },
    data: { revokedAt: new Date() },
    select: publicFields,
  })
}

/**
 * Returns the decrypted key for the user's active credential for the
 * given provider. Internal only - never expose this over HTTP. Caller
 * must pin the result to a single outbound request.
 */
export async function resolveUserKey(userId: string, provider: string): Promise<string | null> {
  const cred = await prisma.userAiCredential.findFirst({
    where: { userId, provider, revokedAt: null },
    orderBy: { createdAt: 'desc' },
  })
  if (!cred) return null
  await prisma.userAiCredential.update({
    where: { id: cred.id },
    data: { lastUsedAt: new Date() },
  })
  return decryptKey(cred.keyCiphertext)
}
