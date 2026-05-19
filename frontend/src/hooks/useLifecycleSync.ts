import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  lifecycleService,
  definitionToLifecycle,
  type LifecycleDefinitionInput,
} from '../services/lifecycle.service'
import { useLifecycleStore } from '../store/lifecycleStore'

/**
 * Lifecycle store hydration + one-time migration (ROADMAP NX-11; issue #474).
 *
 * Mounted in MainLayout. Given the active project, it:
 *  1. runs the one-time migration of any browser-local custom lifecycles from
 *     the legacy `lifecycle-storage` localStorage key into the DB (silent);
 *  2. fetches the lifecycle library via React Query;
 *  3. hydrates the in-memory `lifecycleStore` cache so the synchronous store
 *     reads in the requirement modals and the checklist builder keep working.
 *
 * The store's `persist` middleware was removed - the DB is the source of
 * truth; this hook is the bridge.
 */

const LEGACY_STORAGE_KEY = 'lifecycle-storage'
/** Marks the one-time migration done so it never re-runs on this browser. */
const MIGRATION_DONE_KEY = 'lifecycle-migrated-to-db-v1'

/** Shape of a lifecycle as held in the legacy localStorage Zustand persist. */
interface LegacyLifecycle {
  id?: string
  name?: string
  description?: string
  type?: string
  version?: string
  applicableItemTypes?: string[]
  steps?: Array<{ statusId?: string; order?: number }>
  transitionRules?: Array<{
    fromStatusId?: string
    toStatusId?: string
    allowedEngineeringRoleIds?: string[]
  }>
}

/**
 * Read any custom (non-standard) lifecycles a user built in the legacy
 * localStorage store. Standard catalogue rows are NOT migrated - the server
 * seed restores those. Returns the create payloads to POST.
 */
function readLegacyCustomLifecycles(): Array<{
  legacyName: string
  payload: LifecycleDefinitionInput
}> {
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as { state?: { lifecycles?: LegacyLifecycle[] } }
    const lifecycles = parsed?.state?.lifecycles
    if (!Array.isArray(lifecycles)) return []

    const out: Array<{ legacyName: string; payload: LifecycleDefinitionInput }> = []
    for (const lc of lifecycles) {
      // Only migrate user-authored custom lifecycles: skip standard catalogue
      // rows (the server seed owns those) and skip empty / library rows.
      if (!lc || lc.type === 'standard') continue
      if (lc.id?.startsWith('library-')) continue
      const steps = Array.isArray(lc.steps) ? lc.steps : []
      if (steps.length === 0) continue

      const ordered = [...steps].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      const phases = ordered
        .map((s, i) => ({
          statusId: String(s.statusId ?? ''),
          // Legacy steps carry no phase name; derive a stable one.
          name: String(s.statusId ?? `Phase ${i + 1}`),
          isInitial: i === 0,
        }))
        .filter((p) => p.statusId !== '')
      if (phases.length === 0) continue

      // Map legacy transitionRules (status-id keyed) onto phase indices.
      const statusToIndex = new Map<string, number>()
      phases.forEach((p, i) => {
        if (!statusToIndex.has(p.statusId)) statusToIndex.set(p.statusId, i)
      })
      const transitions = (lc.transitionRules ?? [])
        .map((r) => {
          const fromIdx = statusToIndex.get(String(r.fromStatusId ?? ''))
          const toIdx = statusToIndex.get(String(r.toStatusId ?? ''))
          if (fromIdx === undefined || toIdx === undefined || fromIdx === toIdx) return null
          return {
            fromPhaseIndex: fromIdx,
            toPhaseIndex: toIdx,
            allowedEngineeringRoleIds: Array.isArray(r.allowedEngineeringRoleIds)
              ? r.allowedEngineeringRoleIds
              : [],
          }
        })
        .filter((t): t is NonNullable<typeof t> => t !== null)

      out.push({
        legacyName: String(lc.name ?? 'Untitled lifecycle'),
        payload: {
          name: String(lc.name ?? 'Migrated lifecycle'),
          description: lc.description ?? null,
          version: String(lc.version ?? '1.0'),
          applicableItemTypes: Array.isArray(lc.applicableItemTypes)
            ? lc.applicableItemTypes
            : [],
          phases,
          transitions,
        },
      })
    }
    return out
  } catch {
    // Corrupt legacy data must not break the page - skip migration.
    return []
  }
}

/** In-process guard so two hook instances mounting in the same tick (e.g.
 *  MainLayout + the LifecycleManagementPage) cannot both start the migration
 *  before the async localStorage flag is observable. */
let migrationInFlight: Promise<number> | null = null

/**
 * Run the one-time localStorage -> DB migration. Silent: returns the count
 * migrated; a failure is logged quietly and never thrown. Marks itself done
 * so it never re-runs. The legacy key is cleared only after a clean run so a
 * user's data is never lost if the migration is interrupted.
 */
async function runOneTimeMigration(projectId: string): Promise<number> {
  if (window.localStorage.getItem(MIGRATION_DONE_KEY) === 'true') return 0
  if (migrationInFlight) return migrationInFlight

  migrationInFlight = (async () => {
    const custom = readLegacyCustomLifecycles()
    if (custom.length === 0) {
      // Nothing to migrate - mark done and drop the legacy key.
      window.localStorage.setItem(MIGRATION_DONE_KEY, 'true')
      window.localStorage.removeItem(LEGACY_STORAGE_KEY)
      return 0
    }
    let migrated = 0
    let allOk = true
    for (const { payload } of custom) {
      try {
        const res = await lifecycleService.createLifecycle(projectId, payload)
        if (res.success) migrated += 1
        else allOk = false
      } catch (e) {
        allOk = false
        console.warn('Lifecycle migration: failed to migrate a custom lifecycle', e)
      }
    }
    // Only clear the legacy key once every row migrated cleanly - never lose a
    // user's custom lifecycle. If a row failed, keep the key for a later retry.
    window.localStorage.setItem(MIGRATION_DONE_KEY, 'true')
    if (allOk) window.localStorage.removeItem(LEGACY_STORAGE_KEY)
    return migrated
  })()

  return migrationInFlight
}

export interface UseLifecycleSyncResult {
  isLoading: boolean
  error: string | null
  /** How many browser-local custom lifecycles the one-time migration moved. */
  migratedCount: number
  refetch: () => void
}

/**
 * Hydrate the lifecycle store cache for a project. Pass `null` outside a
 * project context (the hook then does nothing).
 */
export function useLifecycleSync(projectId: string | null | undefined): UseLifecycleSyncResult {
  const setLifecycles = useLifecycleStore((s) => s.setLifecycles)
  const setHydrated = useLifecycleStore((s) => s.setHydrated)
  const migratedRef = useRef(0)
  const migrationRunForProject = useRef<string | null>(null)

  const query = useQuery({
    queryKey: ['lifecycle', 'library', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      // Run the one-time migration before the first fetch so migrated
      // lifecycles appear in the library immediately.
      if (projectId && migrationRunForProject.current !== projectId) {
        migrationRunForProject.current = projectId
        migratedRef.current = await runOneTimeMigration(projectId)
      }
      const res = await lifecycleService.getLibrary(projectId!)
      if (!res.success) throw new Error(res.error ?? 'Failed to load lifecycle library')
      return res.data ?? []
    },
  })

  // Hydrate the store cache whenever the query data changes.
  useEffect(() => {
    if (query.data) {
      setLifecycles(query.data.map(definitionToLifecycle))
      setHydrated(true)
    }
  }, [query.data, setLifecycles, setHydrated])

  return {
    isLoading: query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    migratedCount: migratedRef.current,
    refetch: () => {
      query.refetch()
    },
  }
}
