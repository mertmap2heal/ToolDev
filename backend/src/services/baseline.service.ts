// R-4 (#401) — unified baseline primitive.
//
// Business logic for the BaselineRoot / BaselineRootItem tables — a kind-agnostic,
// per-item content-hashed snapshot of any cert-relevant artefact set. Replaces
// the five divergent legacy baseline tables (Baseline, VerBaseline, CertBaseline,
// ParameterBaseline, ValidationBaseline); migrating those to reference BaselineRoot
// is per-module work (V-L2) and is NOT done here.
//
// A baseline is signed by reusing R-3's SignatureEvent (linkedEntityType=
// 'BaselineRoot') — there is no separate signature table.
//
// Services throw plain Errors; controllers translate them to HTTP responses
// (per .claude/kb/backend-patterns.md). This file wires no endpoint — per-module
// consumers wire it in their own tickets.
import { createHash } from 'crypto'
import type { BaselineRoot, BaselineRootItem } from '@prisma/client'
import { prisma } from '../lib/prisma'

// Controlled vocabulary for BaselineRoot.kind — one value per cert-relevant
// module that snapshots state (Verification / Certification / Parameters /
// Validation / Configuration Management).
export const BASELINE_KINDS = ['VER', 'CERT', 'PARAM', 'VALIDATION', 'CM'] as const
export type BaselineKind = (typeof BASELINE_KINDS)[number]

/** Throws if kind is not in the controlled vocabulary. */
function assertValidKind(kind: string): void {
  if (!BASELINE_KINDS.includes(kind as BaselineKind)) {
    throw new Error(
      `Invalid baseline kind "${kind}" — must be one of: ${BASELINE_KINDS.join(', ')}`,
    )
  }
}

/** sha256 hash of the serialised artefact payload at baseline time. */
function hashPayload(payload: string): string {
  return createHash('sha256').update(payload, 'utf8').digest('hex')
}

/**
 * Create a new baseline header in `draft` status. `kind` is validated against
 * the controlled vocabulary — an invalid kind throws.
 */
export async function createBaselineRoot(input: {
  projectId: string
  kind: string
  name: string
  description?: string | null
  createdByUserId: string
}): Promise<BaselineRoot> {
  assertValidKind(input.kind)

  return prisma.baselineRoot.create({
    data: {
      projectId: input.projectId,
      kind: input.kind,
      name: input.name,
      description: input.description ?? null,
      createdByUserId: input.createdByUserId,
    },
  })
}

/**
 * Add a snapshot item to a baseline. The caller serialises the artefact it is
 * baselining into a stable string (`payload`); the service computes the
 * canonical sha256 `contentHash` from it — there is one hashing path and a
 * caller cannot pass a forged hash.
 *
 * Throws if the baseline root does not exist or its status is `frozen`.
 */
export async function addBaselineItem(input: {
  baselineRootId: string
  linkedEntityType: string
  linkedEntityId: string
  payload: string
}): Promise<BaselineRootItem> {
  const root = await prisma.baselineRoot.findUnique({
    where: { id: input.baselineRootId },
  })
  if (!root) {
    throw new Error(`BaselineRoot ${input.baselineRootId} not found`)
  }
  if (root.status === 'frozen') {
    throw new Error(
      `BaselineRoot ${input.baselineRootId} is frozen — items cannot be added`,
    )
  }

  return prisma.baselineRootItem.create({
    data: {
      baselineRootId: input.baselineRootId,
      linkedEntityType: input.linkedEntityType,
      linkedEntityId: input.linkedEntityId,
      contentHash: hashPayload(input.payload),
    },
  })
}

/**
 * Freeze a baseline — transitions status `draft` -> `frozen`. After this no
 * further items can be added (enforced by addBaselineItem). Throws if the root
 * does not exist.
 */
export async function freezeBaselineRoot(baselineRootId: string): Promise<BaselineRoot> {
  const root = await prisma.baselineRoot.findUnique({
    where: { id: baselineRootId },
  })
  if (!root) {
    throw new Error(`BaselineRoot ${baselineRootId} not found`)
  }

  return prisma.baselineRoot.update({
    where: { id: baselineRootId },
    data: { status: 'frozen' },
  })
}

/** A baseline root with its snapshot items, or null if the root does not exist. */
export async function getBaselineRoot(
  baselineRootId: string,
): Promise<(BaselineRoot & { items: BaselineRootItem[] }) | null> {
  return prisma.baselineRoot.findUnique({
    where: { id: baselineRootId },
    include: { items: true },
  })
}

/** List baseline roots for a project, optionally filtered by kind, newest first. */
export async function listBaselineRoots(
  projectId: string,
  kind?: string,
): Promise<BaselineRoot[]> {
  return prisma.baselineRoot.findMany({
    where: { projectId, ...(kind ? { kind } : {}) },
    orderBy: { createdAt: 'desc' },
  })
}

export interface BaselineComparison {
  added: BaselineRootItem[] // in B, not in A
  removed: BaselineRootItem[] // in A, not in B
  changed: { a: BaselineRootItem; b: BaselineRootItem }[] // same entity, different contentHash
}

/**
 * Kind-agnostic diff of two baseline roots over their BaselineRootItem sets.
 * Items are keyed by `${linkedEntityType}:${linkedEntityId}`:
 *   - key only in B  -> added
 *   - key only in A  -> removed
 *   - key in both, different contentHash -> changed
 * Identical roots produce all-empty buckets.
 */
export async function compareBaselineRoots(
  rootIdA: string,
  rootIdB: string,
): Promise<BaselineComparison> {
  const [itemsA, itemsB] = await Promise.all([
    prisma.baselineRootItem.findMany({ where: { baselineRootId: rootIdA } }),
    prisma.baselineRootItem.findMany({ where: { baselineRootId: rootIdB } }),
  ])

  const key = (item: BaselineRootItem) => `${item.linkedEntityType}:${item.linkedEntityId}`
  const mapA = new Map(itemsA.map((item) => [key(item), item]))
  const mapB = new Map(itemsB.map((item) => [key(item), item]))

  const added: BaselineRootItem[] = []
  const removed: BaselineRootItem[] = []
  const changed: { a: BaselineRootItem; b: BaselineRootItem }[] = []

  for (const [k, b] of mapB) {
    if (!mapA.has(k)) {
      added.push(b)
    }
  }
  for (const [k, a] of mapA) {
    const b = mapB.get(k)
    if (!b) {
      removed.push(a)
    } else if (a.contentHash !== b.contentHash) {
      changed.push({ a, b })
    }
  }

  return { added, removed, changed }
}
