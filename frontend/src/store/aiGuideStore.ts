import { create } from 'zustand'

interface AIGuideState {
  isOpen: boolean
  width: number
  toggleAIGuide: () => void
  openAIGuide: () => void
  closeAIGuide: () => void
  setWidth: (width: number) => void
}

const MIN_WIDTH = 300
const MAX_WIDTH = 800
const DEFAULT_WIDTH = 384 // w-96 = 384px

export const useAIGuideStore = create<AIGuideState>((set) => ({
  isOpen: false,
  width: DEFAULT_WIDTH,
  toggleAIGuide: () => set((state) => ({ isOpen: !state.isOpen })),
  openAIGuide: () => set({ isOpen: true }),
  closeAIGuide: () => set({ isOpen: false }),
  setWidth: (width: number) => set({ width: Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width)) }),
}))
