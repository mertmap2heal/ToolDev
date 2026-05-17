// NX-3 (#443) — Configuration Management: ConfigItem baselining (CM-N6).
//
// CM-N6's intent — "a ConfigItem can be entered into a baseline" — is delivered
// by CONSUMING R-4's unified BaselineRoot / BaselineRootItem primitive, not by
// extending the legacy BaselineItem (the NX-3 Architecture decision: a second
// polymorphic baseline path is a SHARED-SERVICES anti-pattern). A CM baseline
// is a BaselineRoot with `kind='CM'`; each snapshotted ConfigItem is a
// BaselineRootItem with `linkedEntityType='ConfigItem'`.
//
// This service does NOT reinvent baseline logic — it calls baseline.service.ts
// (createBaselineRoot / addBaselineItem / freezeBaselineRoot / getBaselineRoot /
// listBaselineRoots / compareBaselineRoots). The legacy BaselineItem table is
// untouched.
//
// Services throw plain Errors; controllers translate them to HTTP responses.
import type { BaselineRoot, BaselineRootItem, ConfigItem } from '@prisma/client'
import { prisma } from '../lib/prisma'
import {
  addBaselineItem,
  compareBaselineRoots,
  createBaselineRoot,
  freezeBaselineRoot,
  getBaselineRoot,
  listBaselineRoots,
  type BaselineComparison,
} from './baseline.service'
import { CmError } from './configItem.service'

/**
 * Serialise a ConfigItem into a stable, canonical string for the baseline
 * content hash. Keys are listed in a fixed order; only the cert-relevant
 * snapshot fields are included (timestamps that drift without a content change
 * — `updatedAt` — are deliberately excluded so an unchanged CI hashes the same
 * across two baselines). `addBaselineItem` computes the sha256 from this.
 */
function canonicalConfigItemPayload(ci: ConfigItem): string {
  return JSON.stringify({
    id: ci.id,
    ciKey: ci.ciKey,
    name: ci.name,
    type: ci.type,
    status: ci.status,
    lockState: ci.lockState,
    version: ci.version,
    revision: ci.revision,
    safetyCritical: ci.safetyCritical,
    dal: ci.dal,
    tags: ci.tags,
    refType: ci.refType,
    refId: ci.refId,
  })
}

/**
 * Create a CM baseline — a `kind='CM'` BaselineRoot — and snapshot every
 * non-deleted ConfigItem in the project into it as a `linkedEntityType=
 * 'ConfigItem'` BaselineRootItem. Optionally restrict the snapshot to a
 * caller-supplied set of ConfigItem ids (the ids are still project-scoped — a
 * foreign id is silently dropped, never snapshotted). The new baseline is left
 * in `draft` status; freezing is a separate explicit action.
 *
 * Returns the BaselineRoot together with its snapshot items.
 */
export async function createCmBaseline(
  projectId: string,
  createdByUserId: string,
  input: { name: string; description?: string | null; configItemIds?: string[] },
): Promise<BaselineRoot & { items: BaselineRootItem[] }> {
  const name = input.name?.trim()
  if (!name) throw new CmError('name is required')

  // Resolve the ConfigItems to snapshot — project-scoped, non-deleted only.
  // An optional `configItemIds` filter narrows the set; a foreign id simply
  // matches nothing (the `projectId` clause guarantees tenant isolation).
  const cis = await prisma.configItem.findMany({
    where: {
      projectId,
      deletedAt: null,
      ...(input.configItemIds && input.configItemIds.length > 0
        ? { id: { in: input.configItemIds } }
        : {}),
    },
    orderBy: { ciKey: 'asc' },
  })

  const root = await createBaselineRoot({
    projectId,
    kind: 'CM',
    name,
    description: input.description ?? null,
    createdByUserId,
  })

  for (const ci of cis) {
    await addBaselineItem({
      baselineRootId: root.id,
      linkedEntityType: 'ConfigItem',
      linkedEntityId: ci.id,
      payload: canonicalConfigItemPayload(ci),
    })
  }

  await prisma.auditLog.create({
    data: {
      projectId,
      userId: createdByUserId,
      action: 'cm:baseline-create',
      detailsJson: { baselineRootId: root.id, name: root.name, itemCount: cis.length },
    },
  })

  const withItems = await getBaselineRoot(root.id)
  // getBaselineRoot returns null only if the row vanished — impossible here
  // since we just created it inside the same request.
  if (!withItems) throw new CmError('Baseline could not be read back', 500)
  return withItems
}

/** List the CM-kind baseline roots for a project, newest first. */
export async function listCmBaselines(projectId: string): Promise<BaselineRoot[]> {
  return listBaselineRoots(projectId, 'CM')
}

/**
 * Get one CM baseline with its snapshot items. Returns null if the baseline
 * does not exist OR is not a CM-kind baseline scoped to this project — a
 * baseline id from another project / module never resolves.
 */
export async function getCmBaseline(
  projectId: string,
  baselineRootId: string,
): Promise<(BaselineRoot & { items: BaselineRootItem[] }) | null> {
  const root = await getBaselineRoot(baselineRootId)
  if (!root || root.projectId !== projectId || root.kind !== 'CM') return null
  return root
}

/**
 * Add a ConfigItem snapshot to an existing draft CM baseline. The CI must be a
 * non-deleted ConfigItem in the same project; the baseline must be CM-kind in
 * the same project and not frozen.
 */
export async function addConfigItemToCmBaseline(
  projectId: string,
  userId: string,
  baselineRootId: string,
  configItemId: string,
): Promise<BaselineRootItem> {
  const root = await getBaselineRoot(baselineRootId)
  if (!root || root.projectId !== projectId || root.kind !== 'CM') {
    throw new CmError('CM baseline not found in this project', 404)
  }
  const ci = await prisma.configItem.findFirst({
    where: { id: configItemId, projectId, deletedAt: null },
  })
  if (!ci) throw new CmError('Configuration item not found in this project', 404)

  // addBaselineItem throws if the root is frozen — surfaced as a 409.
  let item: BaselineRootItem
  try {
    item = await addBaselineItem({
      baselineRootId: root.id,
      linkedEntityType: 'ConfigItem',
      linkedEntityId: ci.id,
      payload: canonicalConfigItemPayload(ci),
    })
  } catch (e) {
    throw new CmError((e as Error).message, 409)
  }

  await prisma.auditLog.create({
    data: {
      projectId,
      userId,
      action: 'cm:baseline-add-item',
      detailsJson: { baselineRootId: root.id, configItemId: ci.id, ciKey: ci.ciKey },
    },
  })
  return item
}

/**
 * Freeze a CM baseline — `draft` -> `frozen`. After freezing no further items
 * can be added. The baseline must be a CM-kind baseline in this project.
 */
export async function freezeCmBaseline(
  projectId: string,
  userId: string,
  baselineRootId: string,
): Promise<BaselineRoot> {
  const root = await getBaselineRoot(baselineRootId)
  if (!root || root.projectId !== projectId || root.kind !== 'CM') {
    throw new CmError('CM baseline not found in this project', 404)
  }
  const frozen = await freezeBaselineRoot(root.id)
  await prisma.auditLog.create({
    data: {
      projectId,
      userId,
      action: 'cm:baseline-freeze',
      detailsJson: { baselineRootId: root.id, name: root.name },
    },
  })
  return frozen
}

/**
 * Compare two CM baselines — the kind-agnostic added / removed / changed diff
 * over their ConfigItem snapshot items. Both baselines must be CM-kind in this
 * project.
 */
export async function compareCmBaselines(
  projectId: string,
  baselineRootIdA: string,
  baselineRootIdB: string,
): Promise<BaselineComparison> {
  for (const id of [baselineRootIdA, baselineRootIdB]) {
    const root = await getBaselineRoot(id)
    if (!root || root.projectId !== projectId || root.kind !== 'CM') {
      throw new CmError('CM baseline not found in this project', 404)
    }
  }
  return compareBaselineRoots(baselineRootIdA, baselineRootIdB)
}
