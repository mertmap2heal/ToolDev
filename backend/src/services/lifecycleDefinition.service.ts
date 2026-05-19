/**
 * Lifecycle definition service (ROADMAP NX-11; issue #474).
 *
 * The persistence layer for the lifecycle definition that previously lived
 * only in the frontend `lifecycleStore` localStorage. Reads compose the
 * relational `LifecyclePhase` / `LifecycleTransition` graph back into the
 * grouped-lifecycle shape the frontend adapter expects; writes CRUD a
 * project-custom lifecycle.
 *
 * Tenant scope (N-3): every read returns the shared catalogue
 * (`projectId IS NULL`) plus the caller's own `projectId` rows — never another
 * project's custom lifecycle. Writes only ever touch `projectId`-scoped rows;
 * a caller cannot mutate a shared catalogue row (the controller returns 403).
 *
 * Services throw; the controller catches (kb/backend-patterns.md).
 */

import { prisma } from '../lib/prisma'
import type { LifecyclePhase, LifecycleTransition } from '@prisma/client'

// ---------------------------------------------------------------------------
// Shapes returned to the frontend (mirror lifecycle.service.ts adapter types)
// ---------------------------------------------------------------------------

export interface LifecyclePhaseDto {
  id: string
  statusId: string
  name: string
  description: string | null
  orderIndex: number
  isInitial: boolean
}

export interface LifecycleTransitionDto {
  id: string
  fromStatusId: string
  toStatusId: string
  fromPhaseId: string
  toPhaseId: string
  allowedEngineeringRoleIds: string[]
}

/** One grouped lifecycle — all phases sharing a lifecycleKey, plus its edges. */
export interface LifecycleDefinitionDto {
  /** lifecycleKey — the stable lifecycle identity. */
  id: string
  name: string
  description: string | null
  scope: 'standard' | 'organization' | 'project'
  version: string
  applicableItemTypes: string[]
  projectId: string | null
  /** True for standard/organization catalogue rows — the editor hides Edit/Delete. */
  isCatalog: boolean
  statusCount: number
  phases: LifecyclePhaseDto[]
  transitionRules: LifecycleTransitionDto[]
}

export interface ApplicableLifecycleDto {
  lifecycleId: string
  defaultStatusId: string
  lifecycleName: string
}

export interface AllowedTransitionDto {
  toStatusId: string
  toPhaseId: string
  allowedEngineeringRoleIds: string[]
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Tenant-scoped phase filter: catalogue rows (projectId null) plus this
 * project's own rows. Never another project's `project`-scoped rows.
 */
function phaseScopeFilter(projectId: string) {
  return { OR: [{ projectId: null }, { projectId }] }
}

function phaseToDto(p: LifecyclePhase): LifecyclePhaseDto {
  return {
    id: p.id,
    statusId: p.statusId,
    name: p.name,
    description: p.description,
    orderIndex: p.orderIndex,
    isInitial: p.isInitial,
  }
}

/**
 * Group raw phase + transition rows into LifecycleDefinitionDto[] keyed by
 * lifecycleKey. Phases are ordered by orderIndex; transitions are mapped to
 * carry both phase ids and the resolved statusIds.
 */
function groupLifecycles(
  phases: LifecyclePhase[],
  transitions: LifecycleTransition[]
): LifecycleDefinitionDto[] {
  const phaseById = new Map(phases.map((p) => [p.id, p]))
  const byKey = new Map<string, LifecyclePhase[]>()
  for (const p of phases) {
    const list = byKey.get(p.lifecycleKey) ?? []
    list.push(p)
    byKey.set(p.lifecycleKey, list)
  }

  const out: LifecycleDefinitionDto[] = []
  for (const [lifecycleKey, lcPhases] of byKey) {
    const sorted = [...lcPhases].sort((a, b) => a.orderIndex - b.orderIndex)
    const head = sorted[0]!
    const phaseIds = new Set(sorted.map((p) => p.id))
    const rules: LifecycleTransitionDto[] = transitions
      .filter((t) => phaseIds.has(t.fromPhaseId) && phaseIds.has(t.toPhaseId))
      .map((t) => ({
        id: t.id,
        fromPhaseId: t.fromPhaseId,
        toPhaseId: t.toPhaseId,
        fromStatusId: phaseById.get(t.fromPhaseId)?.statusId ?? '',
        toStatusId: phaseById.get(t.toPhaseId)?.statusId ?? '',
        allowedEngineeringRoleIds: t.allowedEngineeringRoleIds,
      }))
    out.push({
      id: lifecycleKey,
      name: head.lifecycleName,
      description: head.lifecycleDescription,
      scope: head.lifecycleScope as 'standard' | 'organization' | 'project',
      version: head.lifecycleVersion,
      applicableItemTypes: head.applicableItemTypes,
      projectId: head.projectId,
      isCatalog: head.lifecycleScope !== 'project',
      statusCount: sorted.length,
      phases: sorted.map(phaseToDto),
      transitionRules: rules,
    })
  }
  // Catalogue lifecycles first, then project-custom; stable name order within.
  return out.sort((a, b) => {
    if (a.isCatalog !== b.isCatalog) return a.isCatalog ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/**
 * The lifecycle library for a project: catalogue lifecycles + this project's
 * own custom lifecycles. Optionally filtered to an item type.
 */
export async function getLibrary(
  projectId: string,
  itemType?: string
): Promise<LifecycleDefinitionDto[]> {
  const phases = await prisma.lifecyclePhase.findMany({
    where: phaseScopeFilter(projectId),
    orderBy: { orderIndex: 'asc' },
  })
  const transitions = await prisma.lifecycleTransition.findMany({
    where: { OR: [{ projectId: null }, { projectId }] },
  })
  let grouped = groupLifecycles(phases, transitions)
  if (itemType) {
    const it = itemType.toLowerCase()
    grouped = grouped.filter((lc) =>
      lc.applicableItemTypes.some((t) => t.toLowerCase() === it)
    )
  }
  return grouped
}

/**
 * Resolve the applicable lifecycle for an item type — the first lifecycle
 * whose applicableItemTypes contains the type, with its initial phase's
 * statusId as the default. Project-custom lifecycles take precedence over the
 * shared catalogue.
 */
export async function getApplicable(
  projectId: string,
  itemType: string
): Promise<ApplicableLifecycleDto | null> {
  const library = await getLibrary(projectId, itemType)
  if (library.length === 0) return null
  // Prefer a project-custom lifecycle; fall back to the catalogue.
  const chosen = library.find((lc) => !lc.isCatalog) ?? library[0]!
  const initial =
    chosen.phases.find((p) => p.isInitial) ??
    [...chosen.phases].sort((a, b) => a.orderIndex - b.orderIndex)[0]
  return {
    lifecycleId: chosen.id,
    defaultStatusId: initial?.statusId ?? 'draft',
    lifecycleName: chosen.name,
  }
}

/**
 * Allowed transitions out of a status within a lifecycle. Resolves the
 * lifecycle by lifecycleKey, finds the phase(s) matching fromStatusId, and
 * returns the transition targets. Tenant-scoped.
 */
export async function getTransitions(
  projectId: string,
  lifecycleId: string,
  fromStatusId: string
): Promise<AllowedTransitionDto[]> {
  const library = await getLibrary(projectId)
  const lc = library.find((l) => l.id === lifecycleId)
  if (!lc) return []
  const fromPhaseIds = new Set(
    lc.phases.filter((p) => p.statusId === fromStatusId).map((p) => p.id)
  )
  if (fromPhaseIds.size === 0) return []
  return lc.transitionRules
    .filter((t) => fromPhaseIds.has(t.fromPhaseId))
    .map((t) => ({
      toStatusId: t.toStatusId,
      toPhaseId: t.toPhaseId,
      allowedEngineeringRoleIds: t.allowedEngineeringRoleIds,
    }))
}

// ---------------------------------------------------------------------------
// Writes (project-custom lifecycles only)
// ---------------------------------------------------------------------------

export interface LifecyclePhaseInput {
  statusId: string
  name: string
  description?: string | null
  isInitial?: boolean
}

export interface LifecycleTransitionInput {
  /** Index into the phases[] array of the from-phase. */
  fromPhaseIndex: number
  /** Index into the phases[] array of the to-phase. */
  toPhaseIndex: number
  allowedEngineeringRoleIds?: string[]
}

export interface CreateLifecycleInput {
  name: string
  description?: string | null
  version?: string
  applicableItemTypes?: string[]
  phases: LifecyclePhaseInput[]
  transitions?: LifecycleTransitionInput[]
}

/** Stable lifecycleKey for a new project-custom lifecycle. */
function newLifecycleKey(): string {
  return `lc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function assertHasPhases(input: { phases?: unknown[] }): void {
  if (!Array.isArray(input.phases) || input.phases.length === 0) {
    throw new Error('A lifecycle must define at least one phase')
  }
}

/**
 * Create a project-custom lifecycle. All phases + transitions are written in
 * one transaction; the resulting grouped lifecycle is returned.
 */
export async function createLifecycle(
  projectId: string,
  userId: string,
  input: CreateLifecycleInput
): Promise<LifecycleDefinitionDto> {
  const name = (input.name ?? '').trim()
  if (!name) throw new Error('Lifecycle name is required')
  assertHasPhases(input)

  const lifecycleKey = newLifecycleKey()
  const version = input.version?.trim() || '1.0'
  const applicableItemTypes = input.applicableItemTypes ?? []
  const initialIndex = input.phases.findIndex((p) => p.isInitial)

  await prisma.$transaction(async (tx) => {
    const created: { id: string }[] = []
    for (let i = 0; i < input.phases.length; i++) {
      const ph = input.phases[i]!
      const row = await tx.lifecyclePhase.create({
        data: {
          lifecycleScope: 'project',
          projectId,
          lifecycleKey,
          lifecycleName: name,
          lifecycleVersion: version,
          lifecycleDescription: input.description ?? null,
          name: ph.name,
          statusId: ph.statusId,
          description: ph.description ?? null,
          orderIndex: i,
          // Exactly one initial phase: the flagged one, else the first.
          isInitial: initialIndex >= 0 ? i === initialIndex : i === 0,
          applicableItemTypes,
          createdByUserId: userId,
        },
        select: { id: true },
      })
      created.push(row)
    }
    for (const t of input.transitions ?? []) {
      const from = created[t.fromPhaseIndex]
      const to = created[t.toPhaseIndex]
      if (!from || !to || from.id === to.id) continue
      await tx.lifecycleTransition.create({
        data: {
          projectId,
          lifecycleKey,
          fromPhaseId: from.id,
          toPhaseId: to.id,
          allowedEngineeringRoleIds: t.allowedEngineeringRoleIds ?? [],
          createdByUserId: userId,
        },
      })
    }
  })

  const library = await getLibrary(projectId)
  const result = library.find((l) => l.id === lifecycleKey)
  if (!result) throw new Error('Lifecycle creation failed')
  return result
}

/**
 * Resolve a lifecycle by lifecycleKey for a project, or throw. Used to gate
 * writes — only a project-custom lifecycle owned by THIS project may be
 * mutated; a shared catalogue lifecycle raises CatalogReadOnlyError.
 */
export class CatalogReadOnlyError extends Error {
  constructor() {
    super('Standard and organization lifecycles are read-only')
    this.name = 'CatalogReadOnlyError'
  }
}
export class LifecycleNotFoundError extends Error {
  constructor() {
    super('Lifecycle not found')
    this.name = 'LifecycleNotFoundError'
  }
}

async function getOwnedLifecycleOrThrow(
  projectId: string,
  lifecycleId: string
): Promise<LifecycleDefinitionDto> {
  const library = await getLibrary(projectId)
  const lc = library.find((l) => l.id === lifecycleId)
  if (!lc) throw new LifecycleNotFoundError()
  if (lc.isCatalog || lc.projectId !== projectId) throw new CatalogReadOnlyError()
  return lc
}

/**
 * Update a project-custom lifecycle. The full phase + transition set is
 * replaced (the editor sends the complete definition). Catalogue lifecycles
 * are rejected with CatalogReadOnlyError.
 */
export async function updateLifecycle(
  projectId: string,
  userId: string,
  lifecycleId: string,
  input: CreateLifecycleInput
): Promise<LifecycleDefinitionDto> {
  await getOwnedLifecycleOrThrow(projectId, lifecycleId)
  const name = (input.name ?? '').trim()
  if (!name) throw new Error('Lifecycle name is required')
  assertHasPhases(input)

  const version = input.version?.trim() || '1.0'
  const applicableItemTypes = input.applicableItemTypes ?? []
  const initialIndex = input.phases.findIndex((p) => p.isInitial)

  await prisma.$transaction(async (tx) => {
    // Replace the definition: delete old phases (transitions cascade) then
    // recreate. Scoped to projectId + lifecycleKey so no catalogue row is hit.
    await tx.lifecycleTransition.deleteMany({ where: { projectId, lifecycleKey: lifecycleId } })
    await tx.lifecyclePhase.deleteMany({ where: { projectId, lifecycleKey: lifecycleId } })
    const created: { id: string }[] = []
    for (let i = 0; i < input.phases.length; i++) {
      const ph = input.phases[i]!
      const row = await tx.lifecyclePhase.create({
        data: {
          lifecycleScope: 'project',
          projectId,
          lifecycleKey: lifecycleId,
          lifecycleName: name,
          lifecycleVersion: version,
          lifecycleDescription: input.description ?? null,
          name: ph.name,
          statusId: ph.statusId,
          description: ph.description ?? null,
          orderIndex: i,
          isInitial: initialIndex >= 0 ? i === initialIndex : i === 0,
          applicableItemTypes,
          createdByUserId: userId,
        },
        select: { id: true },
      })
      created.push(row)
    }
    for (const t of input.transitions ?? []) {
      const from = created[t.fromPhaseIndex]
      const to = created[t.toPhaseIndex]
      if (!from || !to || from.id === to.id) continue
      await tx.lifecycleTransition.create({
        data: {
          projectId,
          lifecycleKey: lifecycleId,
          fromPhaseId: from.id,
          toPhaseId: to.id,
          allowedEngineeringRoleIds: t.allowedEngineeringRoleIds ?? [],
          createdByUserId: userId,
        },
      })
    }
  })

  const library = await getLibrary(projectId)
  const result = library.find((l) => l.id === lifecycleId)
  if (!result) throw new LifecycleNotFoundError()
  return result
}

/**
 * Delete a project-custom lifecycle (its phases + transitions). Catalogue
 * lifecycles are rejected with CatalogReadOnlyError.
 */
export async function deleteLifecycle(
  projectId: string,
  lifecycleId: string
): Promise<void> {
  await getOwnedLifecycleOrThrow(projectId, lifecycleId)
  await prisma.$transaction(async (tx) => {
    await tx.lifecycleTransition.deleteMany({ where: { projectId, lifecycleKey: lifecycleId } })
    await tx.lifecyclePhase.deleteMany({ where: { projectId, lifecycleKey: lifecycleId } })
  })
}
