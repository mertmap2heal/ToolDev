import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export interface BreadcrumbItem {
  label: string
  path?: string
}

type BreadcrumbContextValue = {
  items: BreadcrumbItem[] | null
  setItems: (items: BreadcrumbItem[] | null) => void
}

const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null)

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<BreadcrumbItem[] | null>(null)
  const setItemsStable = useCallback((next: BreadcrumbItem[] | null) => {
    setItems(next)
  }, [])
  return (
    <BreadcrumbContext.Provider value={{ items, setItems: setItemsStable }}>
      {children}
    </BreadcrumbContext.Provider>
  )
}

export function useBreadcrumb() {
  return useContext(BreadcrumbContext)
}
