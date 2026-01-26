import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

type VerificationDrawerState = {
  selectedPlan: any
  isPlanDrawerOpen: boolean
  selectedCase: any
  isCaseDrawerOpen: boolean
  selectedSetup: any
  isSetupDrawerOpen: boolean
  selectedResult: any
  isResultDrawerOpen: boolean
  openPlan: (plan: any) => void
  closePlan: () => void
  openCase: (testCase: any) => void
  closeCase: () => void
  openSetup: (setup: any) => void
  closeSetup: () => void
  openResult: (result: any) => void
  closeResult: () => void
}

const defaultValue: VerificationDrawerState = {
  selectedPlan: null,
  isPlanDrawerOpen: false,
  selectedCase: null,
  isCaseDrawerOpen: false,
  selectedSetup: null,
  isSetupDrawerOpen: false,
  selectedResult: null,
  isResultDrawerOpen: false,
  openPlan: () => {},
  closePlan: () => {},
  openCase: () => {},
  closeCase: () => {},
  openSetup: () => {},
  closeSetup: () => {},
  openResult: () => {},
  closeResult: () => {},
}

const VerificationDrawerContext = createContext<VerificationDrawerState>(defaultValue)

export function VerificationDrawerProvider({ children }: { children: ReactNode }) {
  const [selectedPlan, setSelectedPlan] = useState<any>(null)
  const [isPlanDrawerOpen, setIsPlanDrawerOpen] = useState(false)
  const [selectedCase, setSelectedCase] = useState<any>(null)
  const [isCaseDrawerOpen, setIsCaseDrawerOpen] = useState(false)
  const [selectedSetup, setSelectedSetup] = useState<any>(null)
  const [isSetupDrawerOpen, setIsSetupDrawerOpen] = useState(false)
  const [selectedResult, setSelectedResult] = useState<any>(null)
  const [isResultDrawerOpen, setIsResultDrawerOpen] = useState(false)

  const openPlan = useCallback((plan: any) => {
    setSelectedPlan(plan)
    setIsPlanDrawerOpen(true)
  }, [])
  const closePlan = useCallback(() => {
    setIsPlanDrawerOpen(false)
    setSelectedPlan(null)
  }, [])

  const openCase = useCallback((testCase: any) => {
    setSelectedCase(testCase)
    setIsCaseDrawerOpen(true)
  }, [])
  const closeCase = useCallback(() => {
    setIsCaseDrawerOpen(false)
    setSelectedCase(null)
  }, [])

  const openSetup = useCallback((setup: any) => {
    setSelectedSetup(setup)
    setIsSetupDrawerOpen(true)
  }, [])
  const closeSetup = useCallback(() => {
    setIsSetupDrawerOpen(false)
    setSelectedSetup(null)
  }, [])

  const openResult = useCallback((result: any) => {
    setSelectedResult(result)
    setIsResultDrawerOpen(true)
  }, [])
  const closeResult = useCallback(() => {
    setIsResultDrawerOpen(false)
    setSelectedResult(null)
  }, [])

  const value: VerificationDrawerState = {
    selectedPlan,
    isPlanDrawerOpen,
    selectedCase,
    isCaseDrawerOpen,
    selectedSetup,
    isSetupDrawerOpen,
    selectedResult,
    isResultDrawerOpen,
    openPlan,
    closePlan,
    openCase,
    closeCase,
    openSetup,
    closeSetup,
    openResult,
    closeResult,
  }

  return (
    <VerificationDrawerContext.Provider value={value}>
      {children}
    </VerificationDrawerContext.Provider>
  )
}

export function useVerificationDrawer() {
  const ctx = useContext(VerificationDrawerContext)
  if (!ctx) return defaultValue
  return ctx
}
