import { createContext, useContext } from 'react'

export interface ComponentContextValue {
  componentId: string | null
  projectId: string | null
}

export const ComponentContext = createContext<ComponentContextValue>({
  componentId: null,
  projectId: null,
})

export function useComponentContext() {
  return useContext(ComponentContext)
}
