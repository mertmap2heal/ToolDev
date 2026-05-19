import { pathToFileURL } from 'url'
import { prisma } from '../lib/prisma'
import {
  STANDARD_LIFECYCLES,
  phaseSeedKey,
} from '../lib/lifecyclePhases'

/**
 * Seed the standard lifecycle catalogue (ROADMAP NX-11; issue #474).
 * Run with: npm run seed:lifecycle-phases
 *
 * Idempotent. Phases are upserted by the stable unique `seedKey`
 * (`<lifecycleKey>::<phaseName>`); transitions by the `@@unique([fromPhaseId,
 * toPhaseId])` composite. `update` keeps the catalogue text fresh on re-run
 * but never touches `projectId` (catalogue rows are always `projectId=null`).
 * Running it twice leaves the standard catalogue row-count unchanged.
 *
 * The standard catalogue is a shared, project-agnostic set of
 * `lifecycleScope='standard'`, `projectId=null` rows — every project resolves
 * its lifecycle library from this catalogue plus its own project-custom rows.
 * There is deliberately no per-project seed (the catalogue is org-wide) and
 * no lazy-create-on-read (a GET must not write).
 *
 * Exported so tests can import and call it directly; also auto-run at module
 * scope so `tsx src/scripts/seed-lifecycle-phases.ts` still works.
 */
export async function seedLifecyclePhases(): Promise<{
  phasesCreated: number
  phasesExisting: number
  transitionsCreated: number
  transitionsExisting: number
}> {
  let phasesCreated = 0
  let phasesExisting = 0
  let transitionsCreated = 0
  let transitionsExisting = 0

  for (const lc of STANDARD_LIFECYCLES) {
    // 1. Upsert every phase, capturing the resolved id keyed by phase name.
    const phaseIdByName = new Map<string, string>()
    for (let i = 0; i < lc.phases.length; i++) {
      const phase = lc.phases[i]!
      const seedKey = phaseSeedKey(lc.lifecycleKey, phase.name)
      const before = await prisma.lifecyclePhase.findUnique({ where: { seedKey } })
      const row = await prisma.lifecyclePhase.upsert({
        where: { seedKey },
        update: {
          lifecycleScope: 'standard',
          lifecycleName: lc.name,
          lifecycleVersion: lc.version,
          lifecycleDescription: lc.description,
          name: phase.name,
          statusId: phase.statusId,
          orderIndex: i,
          isInitial: phase.isInitial ?? false,
          applicableItemTypes: lc.applicableItemTypes,
        },
        create: {
          seedKey,
          lifecycleScope: 'standard',
          projectId: null,
          lifecycleKey: lc.lifecycleKey,
          lifecycleName: lc.name,
          lifecycleVersion: lc.version,
          lifecycleDescription: lc.description,
          name: phase.name,
          statusId: phase.statusId,
          orderIndex: i,
          isInitial: phase.isInitial ?? false,
          applicableItemTypes: lc.applicableItemTypes,
        },
      })
      phaseIdByName.set(phase.name, row.id)
      if (before) phasesExisting += 1
      else phasesCreated += 1
    }

    // 2. Build the transition edge set: the linear chain + any branch edges.
    const edges: Array<{ from: string; to: string }> = []
    for (let i = 0; i < lc.phases.length - 1; i++) {
      edges.push({ from: lc.phases[i]!.name, to: lc.phases[i + 1]!.name })
    }
    for (const e of lc.extraTransitions ?? []) edges.push(e)

    for (const edge of edges) {
      const fromPhaseId = phaseIdByName.get(edge.from)
      const toPhaseId = phaseIdByName.get(edge.to)
      if (!fromPhaseId || !toPhaseId) {
        console.warn(
          `Skipping transition ${lc.lifecycleKey}: ${edge.from} -> ${edge.to} (phase not found)`
        )
        continue
      }
      const before = await prisma.lifecycleTransition.findUnique({
        where: { fromPhaseId_toPhaseId: { fromPhaseId, toPhaseId } },
      })
      await prisma.lifecycleTransition.upsert({
        where: { fromPhaseId_toPhaseId: { fromPhaseId, toPhaseId } },
        update: { lifecycleKey: lc.lifecycleKey },
        create: {
          projectId: null,
          lifecycleKey: lc.lifecycleKey,
          fromPhaseId,
          toPhaseId,
          allowedEngineeringRoleIds: [],
        },
      })
      if (before) transitionsExisting += 1
      else transitionsCreated += 1
    }
  }

  console.log(
    `Standard lifecycle catalogue seeded: ${phasesCreated} phases created, ` +
      `${phasesExisting} already present; ${transitionsCreated} transitions created, ` +
      `${transitionsExisting} already present (${STANDARD_LIFECYCLES.length} lifecycles).`
  )
  return { phasesCreated, phasesExisting, transitionsCreated, transitionsExisting }
}

async function main(): Promise<void> {
  try {
    await seedLifecyclePhases()
  } catch (error) {
    console.error('Error seeding lifecycle phases:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Auto-run only when invoked directly (`tsx src/scripts/seed-lifecycle-phases.ts`).
// When imported by a test, `main()` (and its prisma.$disconnect) must NOT run -
// the test owns the shared Prisma client lifecycle.
const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main()
}
