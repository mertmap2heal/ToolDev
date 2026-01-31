import { useState, useCallback, useRef } from 'react'

interface HistoryState<T> {
  past: T[]
  present: T
  future: T[]
}

interface UseHistoryOptions {
  maxHistory?: number
}

interface UseHistoryReturn<T> {
  state: T
  setState: (newState: T | ((prev: T) => T)) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  clearHistory: () => void
}

/**
 * Custom hook for managing state with undo/redo capability.
 * Uses a past/present/future model for history tracking.
 */
export function useHistory<T>(
  initialState: T,
  options: UseHistoryOptions = {}
): UseHistoryReturn<T> {
  const { maxHistory = 50 } = options

  const [history, setHistory] = useState<HistoryState<T>>({
    past: [],
    present: initialState,
    future: [],
  })

  const setState = useCallback(
    (newState: T | ((prev: T) => T)) => {
      setHistory((prev) => {
        const resolvedState =
          typeof newState === 'function'
            ? (newState as (prev: T) => T)(prev.present)
            : newState

        // Don't add to history if state hasn't changed
        if (JSON.stringify(resolvedState) === JSON.stringify(prev.present)) {
          return prev
        }

        // Limit past history size
        const newPast = [...prev.past, prev.present].slice(-maxHistory)

        return {
          past: newPast,
          present: resolvedState,
          future: [], // Clear future on new change
        }
      })
    },
    [maxHistory]
  )

  const undo = useCallback(() => {
    setHistory((prev) => {
      if (prev.past.length === 0) return prev

      const newPast = prev.past.slice(0, -1)
      const newPresent = prev.past[prev.past.length - 1]
      const newFuture = [prev.present, ...prev.future]

      return {
        past: newPast,
        present: newPresent,
        future: newFuture,
      }
    })
  }, [])

  const redo = useCallback(() => {
    setHistory((prev) => {
      if (prev.future.length === 0) return prev

      const newFuture = prev.future.slice(1)
      const newPresent = prev.future[0]
      const newPast = [...prev.past, prev.present]

      return {
        past: newPast,
        present: newPresent,
        future: newFuture,
      }
    })
  }, [])

  const clearHistory = useCallback(() => {
    setHistory((prev) => ({
      past: [],
      present: prev.present,
      future: [],
    }))
  }, [])

  return {
    state: history.present,
    setState,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    clearHistory,
  }
}

/**
 * Hook for managing undo/redo with external state.
 * Useful when state is managed elsewhere but you want undo/redo capability.
 */
export function useHistoryTracker<T>(
  currentState: T,
  onStateChange: (state: T) => void,
  options: UseHistoryOptions = {}
): {
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  trackChange: () => void
} {
  const { maxHistory = 50 } = options

  const [past, setPast] = useState<T[]>([])
  const [future, setFuture] = useState<T[]>([])
  const lastTrackedRef = useRef<string>(JSON.stringify(currentState))

  const trackChange = useCallback(() => {
    const currentJson = JSON.stringify(currentState)
    if (currentJson !== lastTrackedRef.current) {
      // Parse the last tracked state to add to past
      const lastState = JSON.parse(lastTrackedRef.current) as T
      setPast((prev) => [...prev, lastState].slice(-maxHistory))
      setFuture([]) // Clear future on new change
      lastTrackedRef.current = currentJson
    }
  }, [currentState, maxHistory])

  const undo = useCallback(() => {
    if (past.length === 0) return

    const newPast = past.slice(0, -1)
    const previousState = past[past.length - 1]
    
    // Save current state to future
    setFuture((prev) => [currentState, ...prev])
    setPast(newPast)
    
    // Update the tracked reference before calling onStateChange
    lastTrackedRef.current = JSON.stringify(previousState)
    onStateChange(previousState)
  }, [past, currentState, onStateChange])

  const redo = useCallback(() => {
    if (future.length === 0) return

    const newFuture = future.slice(1)
    const nextState = future[0]
    
    // Save current state to past
    setPast((prev) => [...prev, currentState])
    setFuture(newFuture)
    
    // Update the tracked reference before calling onStateChange
    lastTrackedRef.current = JSON.stringify(nextState)
    onStateChange(nextState)
  }, [future, currentState, onStateChange])

  return {
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    trackChange,
  }
}
