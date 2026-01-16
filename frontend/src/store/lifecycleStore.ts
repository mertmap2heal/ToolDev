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
  allowedUserGroups: string[]
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
    }
  )
)
