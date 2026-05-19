import { create } from 'zustand'

/**
 * Lifecycle store (ROADMAP NX-11; issue #474).
 *
 * Previously a `localStorage`-persisted Zustand store that was the source of
 * truth for lifecycle definitions. NX-11 moved the source of truth to the DB:
 * `LifecyclePhase` / `LifecycleTransition` Prisma models, served by the
 * `/lifecycle/:projectId/*` endpoints.
 *
 * The `persist` middleware is removed. This store is now a thin in-memory
 * cache hydrated from the API by `useLifecycleSync` (mounted in MainLayout) -
 * so the synchronous `useLifecycleStore().lifecycles` reads in the requirement
 * modals and the checklist builder keep working unchanged. The one-time
 * migration of any browser-local custom lifecycles into the DB also runs in
 * `useLifecycleSync`.
 */

export interface LifecycleStep {
  id: string
  statusId: string
  order: number
}

export interface TransitionRule {
  fromStatusId: string
  toStatusId: string
  /** Discipline / engineering role ids (project-scoped catalog). */
  allowedEngineeringRoleIds: string[]
  /** Migrated from pre-id transition rules until merged with catalog in UI. */
  legacyAllowedUserGroupNames?: string[]
}

export interface Lifecycle {
  id: string
  name: string
  description: string
  type: 'standard' | 'organization' | 'project'
  version: string
  statusCount: number
  itemCount: number
  lastModified: string
  applicableItemTypes: string[]
  libraryId?: string // ID of the custom library this lifecycle belongs to (if any)
  /** NX-11: true for standard/organization catalogue rows - the editor hides Edit/Delete. */
  isCatalog?: boolean
  /** NX-11: the owning project for a project-custom lifecycle; null for catalogue rows. */
  projectId?: string | null
  statuses?: unknown[]
  steps?: LifecycleStep[]
  transitionRules?: TransitionRule[]
}

interface LifecycleStore {
  lifecycles: Lifecycle[]
  /** True once the store has been hydrated from the API at least once. */
  hydrated: boolean
  setLifecycles: (lifecycles: Lifecycle[]) => void
  setHydrated: (hydrated: boolean) => void
  addLifecycle: (lifecycle: Lifecycle) => void
  updateLifecycle: (id: string, lifecycle: Partial<Lifecycle>) => void
  deleteLifecycle: (id: string) => void
  getLifecycle: (id: string) => Lifecycle | undefined
  getLifecyclesByType: (type: 'standard' | 'organization' | 'project') => Lifecycle[]
}

export const useLifecycleStore = create<LifecycleStore>()((set, get) => ({
  lifecycles: [],
  hydrated: false,
  setLifecycles: (lifecycles) => set({ lifecycles }),
  setHydrated: (hydrated) => set({ hydrated }),
  addLifecycle: (lifecycle) => set((state) => ({ lifecycles: [...state.lifecycles, lifecycle] })),
  updateLifecycle: (id, updates) =>
    set((state) => ({
      lifecycles: state.lifecycles.map((lc) => (lc.id === id ? { ...lc, ...updates } : lc)),
    })),
  deleteLifecycle: (id) =>
    set((state) => ({
      lifecycles: state.lifecycles.filter((lc) => lc.id !== id),
    })),
  getLifecycle: (id) => {
    const { lifecycles } = get()
    return lifecycles.find((lc) => lc.id === id)
  },
  getLifecyclesByType: (type) => {
    const { lifecycles } = get()
    return lifecycles.filter((lc) => lc.type === type)
  },
}))
