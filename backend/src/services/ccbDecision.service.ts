// NX-3 (#443) — Configuration Management: CCB decision business logic.
//
// A CcbDecision is the recorded vote of a Change Control Board on a
// ChangeRequest (IEEE 828 §6.3). A CR is 1:N with CCB decisions; the existing
// Requirements-module CR flow is untouched and writes zero CcbDecision rows.
//
// The `sign` path is the transactional ceremony (CM-N3): one action records
// the decision, bumps every impacted ConfigItem version, and records a CFR 21
// Part 11 SignatureEvent — atomically. Services throw; controllers translate.
import type { CcbDecision, Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { isAdminUser } from '../lib/adminAuth'
import { createSignature } from './signature.service'
import { CmError } from './configItem.service'

// --- Controlled vocabularies -----------------------------------------------

export const CCB_LEVELS = ['SystemCCB', 'SafetyCCB', 'SoftwareCCB'] as const
export type CcbLevel = (typeof CCB_LEVELS)[number]

export const CCB_DECISIONS = ['Approved', 'Rejected', 'Deferred'] as const
export type CcbDecisionValue = (typeof CCB_DECISIONS)[number]

// --- DTOs -------------------------------------------------------------------

export interface ImpactedConfigItemRef {
  itemType: string
  itemId: string
}

export interface CreateCcbDecisionInput {
  changeRequestId: string
  ccbLevel: string
  safetyImpact?: boolean
  decision: string
  decisionRationale?: string
  impactedConfigItemIds?: ImpactedConfigItemRef[]
}

// --- Audit ------------------------------------------------------------------

async function writeAudit(
  client: Prisma.TransactionClient | typeof prisma,
  projectId: string,
  userId: string,
  action: string,
  details: Prisma.InputJsonValue,
): Promise<void> {
  await client.auditLog.create({
    data: { projectId, userId, action, detailsJson: details },
  })
}

/** Parse a raw impacted-CI list into a strongly-typed array (for in-memory use). */
function parseImpacted(raw: unknown): ImpactedConfigItemRef[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(
      (x): x is ImpactedConfigItemRef =>
        !!x && typeof x === 'object' && typeof (x as ImpactedConfigItemRef).itemId === 'string',
    )
    .map((x) => ({ itemType: String(x.itemType ?? 'configItem'), itemId: String(x.itemId) }))
}

/** Same as parseImpacted but typed as `Prisma.InputJsonValue` for a Json column write. */
function normaliseImpacted(raw: unknown): Prisma.InputJsonValue {
  return parseImpacted(raw) as unknown as Prisma.InputJsonValue
}

/** Bump the minor segment of a semver-ish version string (2.1.0 -> 2.1.1). */
function bumpVersion(v: string): string {
  const parts = v.split('.')
  if (parts.length >= 2) {
    const last = parseInt(parts[parts.length - 1], 10)
    if (!Number.isNaN(last)) {
      parts[parts.length - 1] = String(last + 1)
      return parts.join('.')
    }
  }
  return `${v}.1`
}

/**
 * Increment a spreadsheet-style (bijective base-26) revision label:
 * A -> B, ..., Z -> AA, AA -> AB, ..., AZ -> BA, ..., ZZ -> AAA.
 * The label never wraps Z -> A — colliding revision identifiers in a CFR 21
 * Part 11 CM trail would corrupt the audit history.
 */
function nextRevisionLetters(letters: string): string {
  const chars = letters.toUpperCase().split('')
  let i = chars.length - 1
  while (i >= 0) {
    if (chars[i] === 'Z') {
      chars[i] = 'A'
      i -= 1
    } else {
      chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1)
      return chars.join('')
    }
  }
  // Every position carried over (…ZZ) — grow the label by one place.
  return `A${chars.join('')}`
}

/** Advance a `Rev X` revision (Rev B -> Rev C; Rev Z -> Rev AA; Rev 0 -> Rev A). */
function bumpRevision(rev: string): string {
  const m = rev.match(/Rev\s*([A-Z]+)/i)
  if (m) {
    return `Rev ${nextRevisionLetters(m[1])}`
  }
  return 'Rev A'
}

// --- strictMode + role helpers ---------------------------------------------

/** Read `Project.strictMode` in-transaction. Fails closed — unreadable = strict. */
async function readStrictMode(tx: Prisma.TransactionClient, projectId: string): Promise<boolean> {
  const project = await tx.project.findUnique({
    where: { id: projectId },
    select: { strictMode: true },
  })
  return project?.strictMode ?? true
}

/**
 * Derive the safety-impact of a CCB decision server-side (Security hardening).
 *
 * The client-supplied `safetyImpact` flag is NOT trusted on its own — a
 * careless or malicious CCB Member could clear it to skip the strict-mode
 * Safety-Engineer narrowing. The server OR-combines the client flag with two
 * facts it owns:
 *   - the linked ChangeRequest's `risk` is `critical`, and
 *   - any impacted ConfigItem is flagged `safetyCritical`.
 * A client can RAISE the flag (claim safety impact) but never LOWER it.
 */
async function deriveSafetyImpact(
  tx: Prisma.TransactionClient,
  projectId: string,
  clientFlag: boolean,
  changeRequestId: string,
  impacted: ImpactedConfigItemRef[],
): Promise<boolean> {
  if (clientFlag) return true

  const cr = await tx.changeRequest.findFirst({
    where: { id: changeRequestId, projectId },
    select: { risk: true },
  })
  if ((cr?.risk ?? '').toLowerCase() === 'critical') return true

  if (impacted.length > 0) {
    const safetyCi = await tx.configItem.findFirst({
      where: {
        projectId,
        deletedAt: null,
        id: { in: impacted.map((r) => r.itemId) },
        safetyCritical: true,
      },
      select: { id: true },
    })
    if (safetyCi) return true
  }
  return false
}

/** True if the user holds the Safety Engineer engineering role on the project. */
async function holdsSafetyEngineerRole(
  tx: Prisma.TransactionClient,
  projectId: string,
  userId: string,
): Promise<boolean> {
  const role = await tx.engineeringRole.findUnique({
    where: { name: 'Safety Engineer' },
    select: { id: true },
  })
  if (!role) return false
  const assignment = await tx.projectUserEngineeringRole.findFirst({
    where: { projectId, userId, roleId: role.id },
    select: { id: true },
  })
  return !!assignment
}

// --- Queries ----------------------------------------------------------------

/** All CCB decisions for a project, newest first. */
export async function listCcbDecisions(projectId: string): Promise<CcbDecision[]> {
  return prisma.ccbDecision.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  })
}

/** The CCB-decision ledger for one change request, oldest first. */
export async function listCcbDecisionsForChangeRequest(
  projectId: string,
  changeRequestId: string,
): Promise<CcbDecision[]> {
  return prisma.ccbDecision.findMany({
    where: { projectId, changeRequestId },
    orderBy: { createdAt: 'asc' },
  })
}

// --- Mutations --------------------------------------------------------------

/**
 * Create a CCB decision in `Deferred`-or-recorded state without signing. This
 * records the vote intent; the signed ceremony is `signCcbDecision`. The CR
 * must belong to the project. Used when a board records a decision that does
 * not yet need a CFR 21 Part 11 signature (e.g. a deferral).
 */
export async function createCcbDecision(
  projectId: string,
  userId: string,
  input: CreateCcbDecisionInput,
): Promise<CcbDecision> {
  if (!input.changeRequestId?.trim()) throw new CmError('changeRequestId is required')
  if (!CCB_LEVELS.includes(input.ccbLevel as CcbLevel)) {
    throw new CmError(`ccbLevel must be one of: ${CCB_LEVELS.join(', ')}`)
  }
  if (!CCB_DECISIONS.includes(input.decision as CcbDecisionValue)) {
    throw new CmError(`decision must be one of: ${CCB_DECISIONS.join(', ')}`)
  }

  return prisma.$transaction(async (tx) => {
    const cr = await tx.changeRequest.findFirst({
      where: { id: input.changeRequestId, projectId },
      select: { id: true, crId: true },
    })
    if (!cr) throw new CmError('Change request not found in this project', 404)

    const row = await tx.ccbDecision.create({
      data: {
        projectId,
        changeRequestId: cr.id,
        ccbLevel: input.ccbLevel,
        safetyImpact: input.safetyImpact ?? false,
        decision: input.decision,
        decisionRationale: input.decisionRationale?.trim() ?? '',
        impactedConfigItemIds: normaliseImpacted(input.impactedConfigItemIds),
      },
    })
    await writeAudit(tx, projectId, userId, 'cm:ccb-decision-create', {
      ccbDecisionId: row.id,
      changeRequestId: cr.id,
      crId: cr.crId,
      decision: row.decision,
    })
    return row
  })
}

/** Serialise a CCB decision into a stable canonical string for the content hash. */
function canonicalCcbPayload(d: CcbDecision, crId: string | null): string {
  return JSON.stringify({
    id: d.id,
    changeRequestId: d.changeRequestId,
    crId,
    ccbLevel: d.ccbLevel,
    safetyImpact: d.safetyImpact,
    decision: d.decision,
    decisionRationale: d.decisionRationale,
    impactedConfigItemIds: d.impactedConfigItemIds,
  })
}

/**
 * Sign a CCB decision — the transactional ceremony (CM-N3). In ONE transaction:
 *  1. records the CcbDecision (signer + signedAt + meaningCode),
 *  2. when the decision is `Approved`, bumps the version + revision of every
 *     impacted ConfigItem,
 *  3. records a CFR 21 Part 11 SignatureEvent (R-3),
 *  4. writes one audit row.
 *
 * R-6 strictMode: when the project is strict AND `safetyImpact` is true, the
 * signer MUST hold the Safety Engineer role (a platform admin bypasses — the
 * break-glass posture of the R-7 middleware). The flag and the role are read
 * INSIDE the transaction so a concurrent toggle cannot race the gate.
 *
 * Either creates a fresh decision (`input` given) or signs an existing one
 * (`decisionId` given). The signer is always `signerUserId` (from req.user).
 */
export async function signCcbDecision(
  projectId: string,
  signerUserId: string,
  reauthAt: Date,
  args:
    | { decisionId: string; input?: undefined }
    | { decisionId?: undefined; input: CreateCcbDecisionInput },
): Promise<CcbDecision | null> {
  // Validate up front when creating fresh.
  if (args.input) {
    if (!args.input.changeRequestId?.trim()) throw new CmError('changeRequestId is required')
    if (!CCB_LEVELS.includes(args.input.ccbLevel as CcbLevel)) {
      throw new CmError(`ccbLevel must be one of: ${CCB_LEVELS.join(', ')}`)
    }
    if (!CCB_DECISIONS.includes(args.input.decision as CcbDecisionValue)) {
      throw new CmError(`decision must be one of: ${CCB_DECISIONS.join(', ')}`)
    }
  }

  return prisma.$transaction(async (tx) => {
    // Resolve or create the decision row.
    let decision: CcbDecision
    let crId: string | null = null

    if (args.decisionId) {
      const existing = await tx.ccbDecision.findFirst({
        where: { id: args.decisionId, projectId },
      })
      if (!existing) return null
      if (existing.signedById) {
        throw new CmError('This CCB decision is already signed.', 409)
      }
      decision = existing
      const cr = await tx.changeRequest.findUnique({
        where: { id: existing.changeRequestId },
        select: { crId: true },
      })
      crId = cr?.crId ?? null
    } else {
      const cr = await tx.changeRequest.findFirst({
        where: { id: args.input!.changeRequestId, projectId },
        select: { id: true, crId: true },
      })
      if (!cr) throw new CmError('Change request not found in this project', 404)
      crId = cr.crId
      decision = await tx.ccbDecision.create({
        data: {
          projectId,
          changeRequestId: cr.id,
          ccbLevel: args.input!.ccbLevel,
          safetyImpact: args.input!.safetyImpact ?? false,
          decision: args.input!.decision,
          decisionRationale: args.input!.decisionRationale?.trim() ?? '',
          impactedConfigItemIds: normaliseImpacted(args.input!.impactedConfigItemIds),
        },
      })
    }

    // Security hardening — the per-decision safety-impact flag is derived
    // server-side, not trusted from the client. A client can claim safety
    // impact but cannot clear it: the server OR-combines its stored flag with
    // the linked CR's `critical` risk and any impacted CI's `safetyCritical`.
    const decisionImpacted = parseImpacted(decision.impactedConfigItemIds)
    const safetyImpact = await deriveSafetyImpact(
      tx,
      projectId,
      decision.safetyImpact,
      decision.changeRequestId,
      decisionImpacted,
    )

    // R-6: safety-impact decisions in a strict project need a Safety Engineer.
    if (safetyImpact) {
      const strict = await readStrictMode(tx, projectId)
      if (strict) {
        const admin = await isAdminUser(signerUserId)
        const isSafetyEngineer = admin || (await holdsSafetyEngineerRole(tx, projectId, signerUserId))
        if (!isSafetyEngineer) {
          throw new CmError(
            'This CCB decision impacts safety (project in strict mode) — ' +
              'it must be signed by a Safety Engineer.',
            403,
          )
        }
      }
    }

    // Record the signature on the decision. The server-derived `safetyImpact`
    // is persisted so the SignatureEvent content hash and the audit row carry
    // the authoritative value, not the client claim.
    const signed = await tx.ccbDecision.update({
      where: { id: decision.id },
      data: {
        safetyImpact,
        signedById: signerUserId,
        signedAt: reauthAt,
        meaningCode: 'approval',
        provenanceReviewStatus: 'approved',
        reviewerUserId: signerUserId,
        reviewTimestamp: reauthAt,
      },
    })

    // Approved decision -> bump every impacted ConfigItem version + revision.
    const impacted = parseImpacted(signed.impactedConfigItemIds)
    const bumped: string[] = []
    if (signed.decision === 'Approved' && impacted.length > 0) {
      const ciIds = impacted.map((r) => r.itemId)
      const cis = await tx.configItem.findMany({
        where: { id: { in: ciIds }, projectId, deletedAt: null },
      })
      for (const ci of cis) {
        await tx.configItem.update({
          where: { id: ci.id },
          data: { version: bumpVersion(ci.version), revision: bumpRevision(ci.revision) },
        })
        bumped.push(ci.ciKey)
      }
    }

    // R-3: record the CFR 21 Part 11 signature atomically with the ceremony.
    await createSignature(
      {
        linkedEntityType: 'CcbDecision',
        linkedEntityId: signed.id,
        signerUserId,
        meaningCode: 'approval',
        reauthAt,
        signedPayload: canonicalCcbPayload(signed, crId),
      },
      tx,
    )

    await writeAudit(tx, projectId, signerUserId, 'cm:ccb-decision-sign', {
      ccbDecisionId: signed.id,
      changeRequestId: signed.changeRequestId,
      crId,
      decision: signed.decision,
      safetyImpact: signed.safetyImpact,
      versionsBumped: bumped,
    })
    return signed
  })
}

/**
 * Reject a CCB decision — records an unsigned `Rejected` decision row for the
 * change request. A rejection is a recorded board outcome, not a signature
 * event, so it does not go through the reauth ceremony.
 */
export async function rejectCcbDecision(
  projectId: string,
  userId: string,
  input: { changeRequestId: string; ccbLevel: string; decisionRationale?: string },
): Promise<CcbDecision> {
  if (!input.changeRequestId?.trim()) throw new CmError('changeRequestId is required')
  if (!CCB_LEVELS.includes(input.ccbLevel as CcbLevel)) {
    throw new CmError(`ccbLevel must be one of: ${CCB_LEVELS.join(', ')}`)
  }

  return prisma.$transaction(async (tx) => {
    const cr = await tx.changeRequest.findFirst({
      where: { id: input.changeRequestId, projectId },
      select: { id: true, crId: true },
    })
    if (!cr) throw new CmError('Change request not found in this project', 404)

    const row = await tx.ccbDecision.create({
      data: {
        projectId,
        changeRequestId: cr.id,
        ccbLevel: input.ccbLevel,
        decision: 'Rejected',
        decisionRationale: input.decisionRationale?.trim() ?? '',
        impactedConfigItemIds: [],
      },
    })
    await writeAudit(tx, projectId, userId, 'cm:ccb-decision-reject', {
      ccbDecisionId: row.id,
      changeRequestId: cr.id,
      crId: cr.crId,
    })
    return row
  })
}
