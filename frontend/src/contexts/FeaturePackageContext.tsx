import { createContext, useContext, useState, type ReactNode } from 'react'
import { PACKAGE_CONFIGS, type PackageId } from '../config/packageConfig'

interface FeaturePackageContextType {
  activePackage: PackageId
  isEnabled: (moduleId: string) => boolean
  setDevPackage: (id: PackageId) => void
}

const FeaturePackageContext = createContext<FeaturePackageContextType | null>(null)

function getInitialPackage(): PackageId {
  if (import.meta.env.DEV) {
    try {
      const stored = localStorage.getItem('devPackage')
      if (stored === 'core' || stored === 'advanced' || stored === 'complete') {
        return stored
      }
    } catch { /* ignore */ }
  }
  const env = import.meta.env.VITE_PACKAGE as string | undefined
  if (env === 'core' || env === 'advanced' || env === 'complete') {
    return env
  }
  return 'complete'
}

export function FeaturePackageProvider({ children }: { children: ReactNode }) {
  const [activePackage, setActivePackage] = useState<PackageId>(getInitialPackage)

  const isEnabled = (moduleId: string): boolean =>
    PACKAGE_CONFIGS[activePackage].modules.includes(moduleId)

  const setDevPackage = (id: PackageId) => {
    if (!import.meta.env.DEV) return
    try { localStorage.setItem('devPackage', id) } catch { /* ignore */ }
    setActivePackage(id)
  }

  return (
    <FeaturePackageContext.Provider value={{ activePackage, isEnabled, setDevPackage }}>
      {children}
    </FeaturePackageContext.Provider>
  )
}

export function useFeaturePackage(): FeaturePackageContextType {
  const ctx = useContext(FeaturePackageContext)
  if (!ctx) throw new Error('useFeaturePackage must be used inside FeaturePackageProvider')
  return ctx
}
