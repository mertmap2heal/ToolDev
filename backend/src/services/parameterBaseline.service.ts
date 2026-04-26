import { prisma } from '../lib/prisma'
import type { Parameter } from '@prisma/client'

/**
 * Parameter baselines: snapshot every parameter in a project at a
 * point in time, list / compare / restore. Distinct from the
 * requirements `Baseline` model — different approval flow, different
 * snapshot shape.
 *
 * Snapshots are stored as JSON on `ParameterBaselineItem.snapshot` so
 * the schema doesn't drift if Parameter columns change later.
 */

const SNAPSHOT_FIELDS = [
  'id',
  'parameterId',
  'name',
  'description',
  'dataType',
  'defaultValue',
  'unit',
  'tolerance',
  'minValue',
  'maxValue',
  'version',
  'status',
  'tags',
  'folderId',
  'formula',
  'enumValues',
  'dimensions',
  'platforms',
  'classification',
  'authorType',
] as const

type SnapshotField = (typeof SNAPSHOT_FIELDS)[number]

function pickSnapshot(p: Parameter): Record<SnapshotField, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of SNAPSHOT_FIELDS) {
    out[f] = (p as unknown as Record<string, unknown>)[f]
  }
  return out as Record<SnapshotField, unknown>
}

export async function createBaseline(args: {
  projectId: string
  createdBy: string
  name: string
  description?: string
}) {
  const params = await prisma.parameter.findMany({
    where: { projectId: args.projectId },
  })
  return prisma.$transaction(async (tx) => {
    const baseline = await tx.parameterBaseline.create({
      data: {
        projectId: args.projectId,
        createdBy: args.createdBy,
        name: args.name,
        description: args.description,
      },
    })
    if (params.length > 0) {
      await tx.parameterBaselineItem.createMany({
        data: params.map((p) => ({
          baselineId: baseline.id,
          parameterId: p.id,
          snapshot: pickSnapshot(p) as object,
        })),
      })
    }
    return baseline
  })
}

export async function listBaselines(projectId: string) {
  const baselines = await prisma.parameterBaseline.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { items: true } } },
  })
  return baselines.map((b) => ({
    id: b.id,
    projectId: b.projectId,
    name: b.name,
    description: b.description,
    createdBy: b.createdBy,
    createdAt: b.createdAt,
    itemCount: b._count.items,
  }))
}

export async function getBaseline(baselineId: string, projectId: string) {
  return prisma.parameterBaseline.findFirst({
    where: { id: baselineId, projectId },
    include: { items: true },
  })
}

export interface DiffEntry {
  parameterId: string
  name: string
  status: 'added' | 'removed' | 'changed' | 'unchanged'
  // Field -> [oldValue, newValue] when changed
  fieldDiffs?: Record<string, [unknown, unknown]>
}

export async function compareBaselines(args: {
  projectId: string
  fromId: string
  toId: string
}): Promise<DiffEntry[]> {
  const [from, to] = await Promise.all([
    getBaseline(args.fromId, args.projectId),
    getBaseline(args.toId, args.projectId),
  ])
  if (!from || !to) throw new Error('baseline not found')
  const fromMap = new Map<string, Record<string, unknown>>(
    from.items.map((i) => [i.parameterId, i.snapshot as Record<string, unknown>]),
  )
  const toMap = new Map<string, Record<string, unknown>>(
    to.items.map((i) => [i.parameterId, i.snapshot as Record<string, unknown>]),
  )
  const ids = new Set<string>([...fromMap.keys(), ...toMap.keys()])
  const out: DiffEntry[] = []
  for (const id of ids) {
    const a = fromMap.get(id)
    const b = toMap.get(id)
    const name = (b?.name ?? a?.name ?? '<unknown>') as string
    if (a && !b) {
      out.push({ parameterId: id, name, status: 'removed' })
    } else if (!a && b) {
      out.push({ parameterId: id, name, status: 'added' })
    } else if (a && b) {
      const fieldDiffs: Record<string, [unknown, unknown]> = {}
      for (const f of SNAPSHOT_FIELDS) {
        if (f === 'id') continue
        if (JSON.stringify(a[f]) !== JSON.stringify(b[f])) {
          fieldDiffs[f] = [a[f], b[f]]
        }
      }
      const status = Object.keys(fieldDiffs).length > 0 ? 'changed' : 'unchanged'
      out.push({
        parameterId: id,
        name,
        status,
        fieldDiffs: status === 'changed' ? fieldDiffs : undefined,
      })
    }
  }
  // Most-interesting first.
  const order = { changed: 0, added: 1, removed: 2, unchanged: 3 }
  out.sort((x, y) => order[x.status] - order[y.status] || x.name.localeCompare(y.name))
  return out
}

/**
 * Compare a baseline against the current live parameter set. Same diff
 * shape as compareBaselines but the right-hand side is "live".
 */
export async function compareBaselineToLive(
  baselineId: string,
  projectId: string,
): Promise<DiffEntry[]> {
  const baseline = await getBaseline(baselineId, projectId)
  if (!baseline) throw new Error('baseline not found')
  const live = await prisma.parameter.findMany({ where: { projectId } })
  const liveMap = new Map<string, Record<string, unknown>>(
    live.map((p) => [p.id, pickSnapshot(p) as Record<string, unknown>]),
  )
  const baseMap = new Map<string, Record<string, unknown>>(
    baseline.items.map((i) => [i.parameterId, i.snapshot as Record<string, unknown>]),
  )
  const ids = new Set<string>([...baseMap.keys(), ...liveMap.keys()])
  const out: DiffEntry[] = []
  for (const id of ids) {
    const a = baseMap.get(id)
    const b = liveMap.get(id)
    const name = (b?.name ?? a?.name ?? '<unknown>') as string
    if (a && !b) {
      out.push({ parameterId: id, name, status: 'removed' })
    } else if (!a && b) {
      out.push({ parameterId: id, name, status: 'added' })
    } else if (a && b) {
      const fieldDiffs: Record<string, [unknown, unknown]> = {}
      for (const f of SNAPSHOT_FIELDS) {
        if (f === 'id') continue
        if (JSON.stringify(a[f]) !== JSON.stringify(b[f])) {
          fieldDiffs[f] = [a[f], b[f]]
        }
      }
      const status = Object.keys(fieldDiffs).length > 0 ? 'changed' : 'unchanged'
      out.push({ parameterId: id, name, status, fieldDiffs: status === 'changed' ? fieldDiffs : undefined })
    }
  }
  const order = { changed: 0, added: 1, removed: 2, unchanged: 3 }
  out.sort((x, y) => order[x.status] - order[y.status] || x.name.localeCompare(y.name))
  return out
}

/**
 * Restore the live parameter set to match the baseline. For each item
 * in the baseline that still exists, write the snapshotted fields
 * back; items in the baseline that no longer exist are skipped (not
 * recreated, since restoring deleted rows would resurrect IDs that
 * may have been re-used). Live parameters NOT in the baseline are
 * left alone — restore is additive.
 */
export async function restoreFromBaseline(args: {
  baselineId: string
  projectId: string
  // When true, also delete live parameters that did not exist in the
  // baseline. Default false — additive restore.
  prune?: boolean
}) {
  const baseline = await getBaseline(args.baselineId, args.projectId)
  if (!baseline) throw new Error('baseline not found')
  let restored = 0
  let skipped = 0
  for (const item of baseline.items) {
    const live = await prisma.parameter.findUnique({ where: { id: item.parameterId } })
    if (!live) {
      skipped++
      continue
    }
    const snap = item.snapshot as Record<string, unknown>
    await prisma.parameter.update({
      where: { id: item.parameterId },
      data: {
        name: snap.name as string,
        description: snap.description as string | null,
        dataType: snap.dataType as string,
        defaultValue: snap.defaultValue as string | null,
        unit: snap.unit as string | null,
        tolerance: snap.tolerance as string | null,
        minValue: snap.minValue as string | null,
        maxValue: snap.maxValue as string | null,
        status: snap.status as string,
        tags: (snap.tags as string[]) ?? [],
        folderId: snap.folderId as string | null,
        formula: snap.formula as string | null,
        enumValues: snap.enumValues as object | null,
        dimensions: snap.dimensions as string | null,
        classification: (snap.classification as string) ?? 'internal',
      },
    })
    restored++
  }
  let pruned = 0
  if (args.prune) {
    const baselineIds = new Set(baseline.items.map((i) => i.parameterId))
    const live = await prisma.parameter.findMany({
      where: { projectId: args.projectId },
      select: { id: true },
    })
    for (const p of live) {
      if (!baselineIds.has(p.id)) {
        await prisma.parameter.delete({ where: { id: p.id } })
        pruned++
      }
    }
  }
  return { restored, skipped, pruned }
}

export async function deleteBaseline(baselineId: string, projectId: string) {
  await prisma.parameterBaseline.deleteMany({
    where: { id: baselineId, projectId },
  })
}
