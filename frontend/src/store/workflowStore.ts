import { create } from 'zustand'
import type { WorkflowProgress, LifecycleStage } from '../../../shared/types/workflow.types'

interface WorkflowState {
  progress: WorkflowProgress | null
  setProgress: (progress: WorkflowProgress) => void
  setCurrentStage: (stage: LifecycleStage) => void
  completeStage: (stage: LifecycleStage) => void
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  progress: null,
  setProgress: (progress) => set({ progress }),
  setCurrentStage: (stage) =>
    set((state) => {
      if (!state.progress) return state
      return {
        progress: {
          ...state.progress,
          currentStage: stage,
        },
      }
    }),
  completeStage: (stage) =>
    set((state) => {
      if (!state.progress) return state
      const completedStages = [...state.progress.completedStages]
      if (!completedStages.includes(stage)) {
        completedStages.push(stage)
      }
      return {
        progress: {
          ...state.progress,
          completedStages,
          overallProgress: Math.round(
            (completedStages.length / state.progress.steps.length) * 100
          ),
        },
      }
    }),
}))
