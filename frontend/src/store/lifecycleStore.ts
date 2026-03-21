import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
  /** Migrated from pre–id transition rules until merged with catalog in UI. */
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
  statuses?: any[]
  steps?: LifecycleStep[]
  transitionRules?: TransitionRule[]
}

interface LifecycleStore {
  lifecycles: Lifecycle[]
  setLifecycles: (lifecycles: Lifecycle[]) => void
  addLifecycle: (lifecycle: Lifecycle) => void
  updateLifecycle: (id: string, lifecycle: Partial<Lifecycle>) => void
  deleteLifecycle: (id: string) => void
  getLifecycle: (id: string) => Lifecycle | undefined
  getLifecyclesByType: (type: 'standard' | 'organization' | 'project') => Lifecycle[]
}

export const useLifecycleStore = create<LifecycleStore>()(
  persist(
    (set, get) => ({
      lifecycles: [],
      setLifecycles: (lifecycles) => set({ lifecycles }),
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
    }),
    {
      name: 'lifecycle-storage',
      version: 2,
      migrate: (persisted: unknown, fromVersion: number) => {
        const p = persisted as { state?: { lifecycles?: Array<{ transitionRules?: unknown[] }> } }
        if (fromVersion < 2 && p?.state?.lifecycles) {
          for (const lc of p.state.lifecycles) {
            const rules = lc.transitionRules
            if (!Array.isArray(rules)) continue
            lc.transitionRules = rules.map((r: any) => {
              const ids = (r.allowedEngineeringRoleIds as string[] | undefined) ?? []
              const legacy = r.allowedUserGroups as string[] | undefined
              const out: TransitionRule = {
                fromStatusId: String(r.fromStatusId ?? ''),
                toStatusId: String(r.toStatusId ?? ''),
                allowedEngineeringRoleIds: [...ids],
              }
              if (legacy?.length) out.legacyAllowedUserGroupNames = [...legacy]
              return out
            })
          }
        }
        return persisted as typeof persisted
      },
    }
  )
)
