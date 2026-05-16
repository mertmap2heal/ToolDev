// R-3 (#398) — universal CFR 21 Part 11 electronic-signature primitive.
//
// Business logic for the SignatureEvent table. The table is append-only: rows
// are never updated or deleted (enforced by the Prisma $use middleware in
// lib/prisma.ts). Revocation appends a NEW row carrying supersededById; the
// superseded row is never mutated.
//
// Services throw plain Errors; controllers translate them to HTTP responses
// (per .claude/kb/backend-patterns.md). This file wires no endpoint — per-module
// consumers (Validation / Certification / Requirements sign-off) wire it in
// their own tickets.
import { createHash } from 'crypto'
import type { Prisma, SignatureEvent } from '@prisma/client'
import { prisma } from '../lib/prisma'

/**
 * A Prisma client that can run `signatureEvent` writes. Either the global
 * singleton or a `$transaction` callback client. Consumers that must record a
 * signature ATOMICALLY with another write (e.g. the Validation sign-off, which
 * writes a `ValidationSignOff` row + flips the item status in the SAME
 * transaction) pass their `tx` here so a signature failure rolls everything
 * back. Omitting it uses the global client — fine for a standalone signature.
 */
export type SignatureWriteClient = Pick<
  Prisma.TransactionClient,
  'signatureEvent'
>

// CFR 21 Part 11 11.200(a)(2): the meaning associated with the signature.
export const SIGNATURE_MEANINGS = ['review', 'approval', 'responsibility', 'authorship'] as const
export type SignatureMeaning = (typeof SIGNATURE_MEANINGS)[number]

/** Throws if meaningCode is not in the Part 11 controlled vocabulary. */
function assertValidMeaning(meaningCode: string): void {
  if (!SIGNATURE_MEANINGS.includes(meaningCode as SignatureMeaning)) {
    throw new Error(
      `Invalid signature meaningCode "${meaningCode}" — must be one of: ${SIGNATURE_MEANINGS.join(', ')}`,
    )
  }
}

/** sha256 chain-of-custody hash of the serialised artefact snapshot. */
function hashPayload(signedPayload: string): string {
  return createHash('sha256').update(signedPayload, 'utf8').digest('hex')
}

/**
 * Record a new electronic signature. The caller serialises the artefact it is
 * signing into a stable string (`signedPayload`); the service computes the
 * canonical sha256 `contentHash` from it — there is one hashing path and a
 * caller cannot pass a forged hash.
 *
 * Pass `client` (a `$transaction` callback client) to record the signature
 * atomically with another write — see `SignatureWriteClient`. Omitted: the
 * global singleton is used.
 */
export async function createSignature(
  input: {
    linkedEntityType: string
    linkedEntityId: string
    signerUserId: string
    meaningCode: string
    reauthAt: Date
    signedPayload: string
    linkedBaselineId?: string | null
  },
  client: SignatureWriteClient = prisma,
): Promise<SignatureEvent> {
  assertValidMeaning(input.meaningCode)

  return client.signatureEvent.create({
    data: {
      linkedEntityType: input.linkedEntityType,
      linkedEntityId: input.linkedEntityId,
      linkedBaselineId: input.linkedBaselineId ?? null,
      signerUserId: input.signerUserId,
      meaningCode: input.meaningCode,
      reauthAt: input.reauthAt,
      contentHash: hashPayload(input.signedPayload),
    },
  })
}

/**
 * The full signature chain for an artefact — current and superseded rows,
 * ordered oldest-first by signedAt.
 */
export async function getSignatures(
  linkedEntityType: string,
  linkedEntityId: string,
): Promise<SignatureEvent[]> {
  return prisma.signatureEvent.findMany({
    where: { linkedEntityType, linkedEntityId },
    orderBy: { signedAt: 'asc' },
  })
}

/**
 * Revoke an existing signature. Append-only: this INSERTs a new SignatureEvent
 * whose supersededById points at the revoked row. The superseded row is never
 * mutated. The new row inherits the revoked row's linked entity so the chain
 * stays queryable via getSignatures().
 *
 * Pass `client` to run the revocation atomically with another write — see
 * `SignatureWriteClient`.
 */
export async function supersedeSignature(
  input: {
    supersededSignatureId: string
    signerUserId: string
    meaningCode: string
    reauthAt: Date
    signedPayload: string
  },
  client: SignatureWriteClient = prisma,
): Promise<SignatureEvent> {
  assertValidMeaning(input.meaningCode)

  const superseded = await client.signatureEvent.findUnique({
    where: { id: input.supersededSignatureId },
  })
  if (!superseded) {
    throw new Error(`SignatureEvent ${input.supersededSignatureId} not found`)
  }

  return client.signatureEvent.create({
    data: {
      linkedEntityType: superseded.linkedEntityType,
      linkedEntityId: superseded.linkedEntityId,
      linkedBaselineId: superseded.linkedBaselineId,
      signerUserId: input.signerUserId,
      meaningCode: input.meaningCode,
      reauthAt: input.reauthAt,
      contentHash: hashPayload(input.signedPayload),
      supersededById: superseded.id,
    },
  })
}
