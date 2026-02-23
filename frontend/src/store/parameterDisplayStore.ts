import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ParameterDisplayMode = 'name' | 'resolved'

interface ParameterDisplayStore {
  mode: ParameterDisplayMode
  setMode: (mode: ParameterDisplayMode) => void
}

export const useParameterDisplayStore = create<ParameterDisplayStore>()(
  persist(
    (set) => ({
      mode: 'name',
      setMode: (mode) => set({ mode }),
    }),
    { name: 'parameter-display-mode' }
  )
)
