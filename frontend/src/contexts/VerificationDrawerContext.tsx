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
  selectedRun: any
  isRunDrawerOpen: boolean
  openPlan: (plan: any) => void
  closePlan: () => void
  openCase: (testCase: any) => void
  closeCase: () => void
  openSetup: (setup: any) => void
  closeSetup: () => void
  openResult: (result: any) => void
  closeResult: () => void
  openRun: (run: any) => void
  closeRun: () => void
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
  selectedRun: null,
  isRunDrawerOpen: false,
  openPlan: () => {},
  closePlan: () => {},
  openCase: () => {},
  closeCase: () => {},
  openSetup: () => {},
  closeSetup: () => {},
  openResult: () => {},
  closeResult: () => {},
  openRun: () => {},
  closeRun: () => {},
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
  const [selectedRun, setSelectedRun] = useState<any>(null)
  const [isRunDrawerOpen, setIsRunDrawerOpen] = useState(false)

  const closeAll = useCallback(() => {
    setIsPlanDrawerOpen(false)
    setSelectedPlan(null)
    setIsCaseDrawerOpen(false)
    setSelectedCase(null)
    setIsSetupDrawerOpen(false)
    setSelectedSetup(null)
    setIsResultDrawerOpen(false)
    setSelectedResult(null)
    setIsRunDrawerOpen(false)
    setSelectedRun(null)
  }, [])

  const openPlan = useCallback((plan: any) => {
    closeAll()
    setSelectedPlan(plan)
    setIsPlanDrawerOpen(true)
  }, [closeAll])
  const closePlan = useCallback(() => {
    setIsPlanDrawerOpen(false)
    setSelectedPlan(null)
  }, [])

  const openCase = useCallback((testCase: any) => {
    closeAll()
    setSelectedCase(testCase)
    setIsCaseDrawerOpen(true)
  }, [closeAll])
  const closeCase = useCallback(() => {
    setIsCaseDrawerOpen(false)
    setSelectedCase(null)
  }, [])

  const openSetup = useCallback((setup: any) => {
    closeAll()
    setSelectedSetup(setup)
    setIsSetupDrawerOpen(true)
  }, [closeAll])
  const closeSetup = useCallback(() => {
    setIsSetupDrawerOpen(false)
    setSelectedSetup(null)
  }, [])

  const openResult = useCallback((result: any) => {
    closeAll()
    setSelectedResult(result)
    setIsResultDrawerOpen(true)
  }, [closeAll])
  const closeResult = useCallback(() => {
    setIsResultDrawerOpen(false)
    setSelectedResult(null)
  }, [])

  const openRun = useCallback((run: any) => {
    closeAll()
    setSelectedRun(run)
    setIsRunDrawerOpen(true)
  }, [closeAll])
  const closeRun = useCallback(() => {
    setIsRunDrawerOpen(false)
    setSelectedRun(null)
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
    selectedRun,
    isRunDrawerOpen,
    openPlan,
    closePlan,
    openCase,
    closeCase,
    openSetup,
    closeSetup,
    openResult,
    closeResult,
    openRun,
    closeRun,
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
