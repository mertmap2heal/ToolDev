import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react'

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
  const value = useMemo(
    () => ({ items, setItems: setItemsStable }),
    [items, setItemsStable]
  )
  return (
    <BreadcrumbContext.Provider value={value}>
      {children}
    </BreadcrumbContext.Provider>
  )
}

export function useBreadcrumb() {
  return useContext(BreadcrumbContext)
}
