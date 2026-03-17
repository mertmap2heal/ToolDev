import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const STORAGE_KEY = 'platformAdminActiveCompany'

interface PlatformAdminState {
  /** Selected company name for "operating as" context (no Company entity yet). */
  activeCompanyName: string | null
  setActiveCompanyName: (name: string | null) => void
}

export const usePlatformAdminStore = create<PlatformAdminState>()(
  persist(
    (set) => ({
      activeCompanyName: null,
      setActiveCompanyName: (name) => set({ activeCompanyName: name }),
    }),
    { name: STORAGE_KEY }
  )
)
