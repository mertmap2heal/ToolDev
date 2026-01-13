import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface StatusDefinition {
  id: string
  name: string
  description: string
  color: 'gray' | 'yellow' | 'green' | 'blue' | 'red'
  isInitial: boolean
  applicableItemTypes: string[]
}

interface StatusDefinitionsStore {
  statuses: StatusDefinition[]
  setStatuses: (statuses: StatusDefinition[]) => void
  addStatus: (status: StatusDefinition) => void
  updateStatus: (id: string, status: Partial<StatusDefinition>) => void
  deleteStatus: (id: string) => void
  getStatusesForItemType: (itemType: string) => StatusDefinition[]
}

export const useStatusDefinitionsStore = create<StatusDefinitionsStore>()(
  persist(
    (set, get) => ({
      statuses: [],
      setStatuses: (statuses) => set({ statuses }),
      addStatus: (status) => set((state) => ({ statuses: [...state.statuses, status] })),
      updateStatus: (id, updates) =>
        set((state) => ({
          statuses: state.statuses.map((s) => (s.id === id ? { ...s, ...updates } : s)),
        })),
      deleteStatus: (id) =>
        set((state) => ({
          statuses: state.statuses.filter((s) => s.id !== id),
        })),
      getStatusesForItemType: (itemType) => {
        const { statuses } = get()
        return statuses.filter((status) => status.applicableItemTypes.includes(itemType))
      },
    }),
    {
      name: 'status-definitions-storage',
    }
  )
)
