import { useEffect, useCallback, useRef, useMemo, useState } from 'react'
import { Outlet, useParams, useNavigate, useLocation, Link, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { FileCode, Settings, ChevronRight, ClipboardCheck, ExternalLink, GripVertical, PanelLeft, PanelLeftClose } from 'lucide-react'

import SafetyLinkPanel from '../../components/safety/SafetyLinkPanel'
import { VerificationDrawerProvider, useVerificationDrawer } from '../../contexts/VerificationDrawerContext'
import { useBreadcrumb } from '../../contexts/BreadcrumbContext'
import { projectService } from '../../services/project.service'
import { verificationService } from '../../services/verification.service'
import TestPlanDetailDrawer from '../../components/verification/TestPlanDetailDrawer'
import TestCaseDetailDrawer from '../../components/verification/TestCaseDetailDrawer'
import TestSetupDetailDrawer from '../../components/verification/TestSetupDetailDrawer'
import TestResultDetailDrawer from '../../components/verification/TestResultDetailDrawer'
import TestRunDetailDrawer from '../../components/verification/TestRunDetailDrawer'
import VerificationTreePanel, { type VerNodeType, type RequirementTestCaseLinkLike } from '../../components/verification/VerificationTreePanel'
import { traceabilityService } from '../../services/traceability.service'
import { requirementService } from '../../services/requirement.service'
import { LINKAGE_V1 } from '../../config/featureFlags'
import { linkService } from '../../services/link.service'
import {
  VERIFICATION_MAIN_TABS,
  VERIFICATION_TAB_LABELS,
  VERIFICATION_NODE_TYPE_TO_TAB,
  VERIFICATION_VALID_TAB_IDS,
  buildVerificationUrl,
  clearVerificationFocusForClosedEntity,
} from '../../config/verificationTabs'
import clsx from 'clsx'

const NODE_TYPE_TO_TAB = VERIFICATION_NODE_TYPE_TO_TAB as Record<VerNodeType, string>

function VerificationLayoutInner() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const breadcrumb = useBreadcrumb()
  const setBreadcrumbItems = breadcrumb?.setItems
  const queryClient = useQueryClient()
  const isTemplates = location.pathname.includes('/verification/templates')
  const isSettings = location.pathname.includes('/verification/settings')
  const showTreePanel = !isTemplates && !isSettings
  const tabParam = new URLSearchParams(location.search).get('tab') || 'overview'
  const activeTabParam = VERIFICATION_VALID_TAB_IDS.includes(tabParam) ? tabParam : 'overview'
  const drawer = useVerificationDrawer()

  const focusType = searchParams.get('focusType') as VerNodeType | null
  const focusId = searchParams.get('focusId')
  const selectedNode = focusType && focusId ? { type: focusType, id: focusId } : null

  // Match Requirements: left side panel is collapsed by default.
  const [isTreePanelOpen, setIsTreePanelOpen] = useState(false)
  const PANEL_MIN = 200
  const PANEL_MAX = 500
  const PANEL_DEFAULT = 280
  const [leftPanelWidth, setLeftPanelWidth] = useState(PANEL_DEFAULT)
  const resizeContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showTreePanel) return
    try {
      const stored = localStorage.getItem(`verification::panel-open::${projectId ?? 'default'}`)
      if (stored != null) setIsTreePanelOpen(stored === '1')
    } catch { /* ignore */ }
  }, [projectId, showTreePanel])

  useEffect(() => {
    if (!showTreePanel) return
    try {
      localStorage.setItem(`verification::panel-open::${projectId ?? 'default'}`, isTreePanelOpen ? '1' : '0')
    } catch { /* ignore */ }
  }, [isTreePanelOpen, projectId, showTreePanel])

  useEffect(() => {
    if (!showTreePanel) return
    try {
      const stored = localStorage.getItem(`verification::panel-width::${projectId ?? 'default'}`)
      if (stored) {
        const w = parseInt(stored, 10)
        if (!Number.isNaN(w) && w >= PANEL_MIN && w <= PANEL_MAX) setLeftPanelWidth(w)
      }
    } catch { /* ignore */ }
  }, [projectId, showTreePanel])

  useEffect(() => {
    if (!showTreePanel) return
    try {
      localStorage.setItem(`verification::panel-width::${projectId ?? 'default'}`, String(leftPanelWidth))
    } catch { /* ignore */ }
  }, [leftPanelWidth, projectId, showTreePanel])

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const container = resizeContainerRef.current
    const onMove = (moveEvent: MouseEvent) => {
      const left = container?.getBoundingClientRect().left ?? 0
      const rawWidth = moveEvent.clientX - left
      setLeftPanelWidth((w) => Math.min(PANEL_MAX, Math.max(PANEL_MIN, rawWidth)))
    }
    const onUp = () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  const { data: projectData } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) return null
      const res = await projectService.getProject(projectId)
      return res.success && res.data ? res.data : null
    },
    enabled: !!projectId && !!breadcrumb,
  })

  const { data: plansData = [] } = useQuery({
    queryKey: ['test-plans', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const res = await verificationService.getTestPlans(projectId) as { success?: boolean; data?: any[] }
      return res.success && res.data ? res.data : []
    },
    enabled: !!projectId && showTreePanel,
  })

  const { data: testCasesData = [] } = useQuery({
    queryKey: ['test-cases', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const res = await verificationService.getTestCases(projectId) as { success?: boolean; data?: any[] }
      return res.success && res.data ? res.data : []
    },
    enabled: !!projectId && showTreePanel,
  })

  const { data: testSetupsData = [] } = useQuery({
    queryKey: ['test-setups', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const res = await verificationService.getSetups(projectId) as { success?: boolean; data?: any[] }
      return res.success && res.data ? res.data : []
    },
    enabled: !!projectId && showTreePanel,
  })

  const { data: testRunsData = [] } = useQuery({
    queryKey: ['test-runs', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const res = await verificationService.getTestRuns(projectId) as { success?: boolean; data?: any[] }
      return res.success && res.data ? res.data : []
    },
    enabled: !!projectId && showTreePanel,
  })

  const runsByPlanId = useMemo(() => {
    const map: Record<string, any[]> = {}
    const runs = Array.isArray(testRunsData) ? testRunsData : []
    runs.forEach((r: any) => {
      const planId = r.testPlanId ?? r.testPlan?.id ?? ''
      if (planId) {
        if (!map[planId]) map[planId] = []
        map[planId].push(r)
      }
    })
    return map
  }, [testRunsData])

  const plans = useMemo(() => Array.isArray(plansData) ? plansData : [], [plansData])
  const testCases = useMemo(() => Array.isArray(testCasesData) ? testCasesData : [], [testCasesData])
  const testSetups = useMemo(() => Array.isArray(testSetupsData) ? testSetupsData : [], [testSetupsData])

  const { data: traceLinksData = [] } = useQuery({
    queryKey: LINKAGE_V1 ? ['links', projectId] : ['trace-links', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const res = LINKAGE_V1
        ? await linkService.getLinks(projectId)
        : await traceabilityService.getTraceLinks(projectId)
      return res.success && res.data ? res.data : []
    },
    enabled: !!projectId && showTreePanel,
  })

  const { data: requirementsData = [] } = useQuery({
    queryKey: ['requirements', projectId, 'all'],
    queryFn: async () => {
      if (!projectId) return []
      const res = await requirementService.getAllRequirements(projectId)
      return res.success && Array.isArray(res.data) ? res.data : []
    },
    enabled: !!projectId && showTreePanel,
  })

  const requirementsForTree = useMemo(
    () =>
      Array.isArray(requirementsData)
        ? requirementsData.map((r: { id: string; title?: string; requirementId?: string }) => ({
            id: r.id,
            title: r.title,
            requirementId: r.requirementId,
          }))
        : [],
    [requirementsData]
  )

  const requirementTestCaseLinks = useMemo((): RequirementTestCaseLinkLike[] => {
    const links = Array.isArray(traceLinksData) ? traceLinksData : []
    const norm = (s: string) => (s ?? '').toLowerCase().replace(/-/g, '_')
    const result: RequirementTestCaseLinkLike[] = []
    const seen = new Set<string>()
    for (const l of links) {
      const lt = String((l as any).linkType ?? '').toLowerCase()
      if (lt !== 'verifies') continue
      const st = norm((l as any).sourceType)
      const tt = norm((l as any).targetType)
      const isForward = st === 'requirement' && (tt === 'test_case' || tt === 'testcase')
      const isReverse = (st === 'test_case' || st === 'testcase') && tt === 'requirement'
      if (!isForward && !isReverse) continue
      const lid = (l as any).id ?? `${(l as any).sourceId}-${(l as any).targetId}`
      if (seen.has(lid)) continue
      seen.add(lid)
      if (isForward) {
        result.push({
          id: (l as any).id,
          sourceId: (l as any).sourceId,
          targetId: (l as any).targetId,
          sourceTitle: (l as any).sourceTitle ?? (l as any).sourceLabel ?? (l as any).sourceDisplayId,
          sourceDisplayId: (l as any).sourceDisplayId,
        })
      } else {
        result.push({
          id: (l as any).id,
          sourceId: (l as any).targetId,
          targetId: (l as any).sourceId,
          sourceTitle: (l as any).targetTitle ?? (l as any).targetLabel ?? (l as any).targetDisplayId,
          sourceDisplayId: (l as any).targetDisplayId,
        })
      }
    }
    return result
  }, [traceLinksData])

  const handleTreeSelect = useCallback(
    (node: { type: VerNodeType; id: string } | null) => {
      if (!node) {
        setSearchParams((p) => {
          const n = new URLSearchParams(p)
          n.delete('focusType')
          n.delete('focusId')
          return n
        }, { replace: true })
        return
      }
      const tab = NODE_TYPE_TO_TAB[node.type]
      setSearchParams(
        (p) => {
          const n = new URLSearchParams(p)
          n.set('tab', tab)
          n.set('focusType', node.type)
          n.set('focusId', node.id)
          return n
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  const handleCreatePlan = useCallback(() => {
    if (!projectId) return
    navigate(buildVerificationUrl(projectId, { tab: 'plans', openCreate: 'plan' }), { replace: true })
  }, [navigate, projectId])

  const handleCreateCase = useCallback(
    (planId: string) => {
      if (!projectId) return
      navigate(buildVerificationUrl(projectId, { tab: 'cases', openCreateCase: planId }), { replace: true })
    },
    [navigate, projectId]
  )

  const handleCreateSetup = useCallback(
    (planId: string) => {
      if (!projectId) return
      navigate(buildVerificationUrl(projectId, { tab: 'setups', openCreateSetup: planId }), { replace: true })
    },
    [navigate, projectId]
  )

  const handleCreateRun = useCallback(
    (planId: string) => {
      if (!projectId) return
      navigate(buildVerificationUrl(projectId, { tab: 'runs', openCreateRun: planId }), { replace: true })
    },
    [navigate, projectId]
  )

  const invalidateVerification = useCallback(() => {
    if (!projectId) return
    queryClient.invalidateQueries({ queryKey: ['test-plans', projectId] })
    queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] })
    queryClient.invalidateQueries({ queryKey: ['test-setups', projectId] })
    queryClient.invalidateQueries({ queryKey: ['test-runs', projectId] })
    queryClient.invalidateQueries({ queryKey: ['verification-overview', projectId] })
  }, [projectId, queryClient])

  const invalidateTraceAndVerification = useCallback(() => {
    if (!projectId) return
    queryClient.invalidateQueries({ queryKey: ['requirements', projectId] })
    queryClient.invalidateQueries({ queryKey: ['trace-links', projectId] })
    queryClient.invalidateQueries({ queryKey: ['links', projectId] })
    invalidateVerification()
  }, [projectId, queryClient, invalidateVerification])

  const removeRequirementFromTestCaseMutation = useMutation({
    mutationFn: async ({ reqId, caseId }: { reqId: string; caseId: string }) => {
      if (!projectId) throw new Error('Project ID required')
      const link = requirementTestCaseLinks.find((l) => l.sourceId === reqId && l.targetId === caseId)
      if (!link?.id) throw new Error('Link not found')
      return traceabilityService.deleteTraceLink(projectId, link.id)
    },
    onSuccess: invalidateTraceAndVerification,
    onError: (err: any) => {
      console.error('Unlink requirement from test case:', err)
      alert(err?.message || err?.error || 'Failed to unlink requirement from test case.')
    },
  })

  const removeCaseFromPlanMutation = useMutation({
    mutationFn: ({ planId, caseId }: { planId: string; caseId: string }) =>
      verificationService.removeCaseFromPlan(projectId!, planId, caseId),
    onSuccess: invalidateVerification,
  })

  const deletePlanMutation = useMutation({
    mutationFn: (id: string) => verificationService.deleteTestPlan(projectId!, id),
    onSuccess: invalidateVerification,
  })
  const deleteCaseMutation = useMutation({
    mutationFn: (id: string) => verificationService.deleteTestCase(projectId!, id),
    onSuccess: invalidateVerification,
  })
  const deleteSetupMutation = useMutation({
    mutationFn: (id: string) => verificationService.deleteSetup(projectId!, id),
    onSuccess: invalidateVerification,
  })
  const deleteRunMutation = useMutation({
    mutationFn: (id: string) => verificationService.deleteTestRun(projectId!, id),
    onSuccess: invalidateVerification,
  })

  const handleRemoveCaseFromPlan = useCallback(
    (planId: string, caseId: string) => {
      removeCaseFromPlanMutation.mutate({ planId, caseId })
    },
    [removeCaseFromPlanMutation]
  )

  const handleAddCaseToPlan = useCallback(
    (planId: string, caseId: string) => {
      verificationService.addCaseToPlan(projectId!, planId, caseId).then(() => invalidateVerification())
    },
    [projectId, invalidateVerification]
  )

  const handleAddSetupToPlan = useCallback(
    (planId: string, setupId: string) => {
      verificationService.linkSetupToPlan(projectId!, planId, setupId).then(() => invalidateVerification()).catch(() => {})
    },
    [projectId, invalidateVerification]
  )

  const handleRemoveSetupFromPlan = useCallback(
    (planId: string, setupId: string) => {
      verificationService.unlinkSetupFromPlan(projectId!, planId, setupId).then(() => invalidateVerification()).catch(() => {})
    },
    [projectId, invalidateVerification]
  )

  useEffect(() => {
    if (!setBreadcrumbItems || !projectId) {
      return () => setBreadcrumbItems?.(null)
    }
    const basePath = `/projects/${projectId}/verification`
    const entity = drawer.isPlanDrawerOpen && drawer.selectedPlan
      ? { label: drawer.selectedPlan.key || drawer.selectedPlan.name, tab: 'plans' }
      : drawer.isCaseDrawerOpen && drawer.selectedCase
        ? { label: drawer.selectedCase.key || drawer.selectedCase.title, tab: 'cases' }
        : drawer.isSetupDrawerOpen && drawer.selectedSetup
          ? { label: drawer.selectedSetup.name, tab: 'setups' }
          : drawer.isResultDrawerOpen && drawer.selectedResult
            ? { label: drawer.selectedResult.title, tab: 'results' }
            : drawer.isRunDrawerOpen && drawer.selectedRun
              ? { label: drawer.selectedRun.runName || 'Run', tab: 'runs' }
              : null

    const projectName = projectData?.name || 'Project'
    const tabLabel = VERIFICATION_TAB_LABELS[activeTabParam] || activeTabParam

    if (entity) {
      setBreadcrumbItems([
        { label: 'Home', path: '/' },
        { label: projectName, path: `/projects/${projectId}` },
        { label: 'Verification', path: basePath },
        { label: VERIFICATION_TAB_LABELS[entity.tab] || entity.tab, path: `${basePath}?tab=${entity.tab}` },
        { label: entity.label },
      ])
    } else {
      setBreadcrumbItems([
        { label: 'Home', path: '/' },
        { label: projectName, path: `/projects/${projectId}` },
        { label: 'Verification', path: basePath },
        { label: tabLabel },
      ])
    }
  }, [
    activeTabParam,
    setBreadcrumbItems,
    projectId,
    projectData?.name,
    drawer.isPlanDrawerOpen,
    drawer.selectedPlan,
    drawer.isCaseDrawerOpen,
    drawer.selectedCase,
    drawer.isSetupDrawerOpen,
    drawer.selectedSetup,
    drawer.isResultDrawerOpen,
    drawer.selectedResult,
    drawer.isRunDrawerOpen,
    drawer.selectedRun,
  ])

  useEffect(() => {
    return () => setBreadcrumbItems?.(null)
  }, [setBreadcrumbItems])

  const handleMainTab = (tabId: string) => {
    navigate(buildVerificationUrl(projectId!, { tab: tabId }), { replace: true })
  }

  const handleClosePlanDrawer = useCallback(() => {
    const id = drawer.selectedPlan?.id
    setSearchParams(
      (p) => {
        const n = new URLSearchParams(p)
        clearVerificationFocusForClosedEntity(n, 'plan', id)
        return n
      },
      { replace: true }
    )
    drawer.closePlan()
  }, [drawer.closePlan, drawer.selectedPlan?.id, setSearchParams])

  const handleCloseCaseDrawer = useCallback(() => {
    const id = drawer.selectedCase?.id
    setSearchParams(
      (p) => {
        const n = new URLSearchParams(p)
        clearVerificationFocusForClosedEntity(n, 'case', id)
        return n
      },
      { replace: true }
    )
    drawer.closeCase()
  }, [drawer.closeCase, drawer.selectedCase?.id, setSearchParams])

  const handleCloseSetupDrawer = useCallback(() => {
    const id = drawer.selectedSetup?.id
    setSearchParams(
      (p) => {
        const n = new URLSearchParams(p)
        clearVerificationFocusForClosedEntity(n, 'setup', id)
        return n
      },
      { replace: true }
    )
    drawer.closeSetup()
  }, [drawer.closeSetup, drawer.selectedSetup?.id, setSearchParams])

  const handleCloseResultDrawer = useCallback(() => {
    const id = drawer.selectedResult?.id
    setSearchParams(
      (p) => {
        const n = new URLSearchParams(p)
        clearVerificationFocusForClosedEntity(n, 'result', id)
        return n
      },
      { replace: true }
    )
    drawer.closeResult()
  }, [drawer.closeResult, drawer.selectedResult?.id, setSearchParams])

  const handleCloseRunDrawer = useCallback(() => {
    const id = drawer.selectedRun?.id
    setSearchParams(
      (p) => {
        const n = new URLSearchParams(p)
        clearVerificationFocusForClosedEntity(n, 'run', id)
        return n
      },
      { replace: true }
    )
    drawer.closeRun()
  }, [drawer.closeRun, drawer.selectedRun?.id, setSearchParams])

  return (
    <div ref={resizeContainerRef} className="flex h-[calc(100vh-4rem-2rem)] max-h-[calc(100vh-4rem-2rem)]">
      {showTreePanel && (
        <>
          {isTreePanelOpen ? (
            <>
              <div style={{ width: leftPanelWidth, minWidth: PANEL_MIN }} className="flex-shrink-0 h-full flex flex-col">
                {/* Match Requirements left panel: tab strip (Verification) */}
                <div className="relative shrink-0 border-b border-gray-200 dark:border-gray-700">
                  <div className="px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
                        <ClipboardCheck size={14} className="text-teal-600 dark:text-teal-400" />
                        Verification
                      </div>
                      <Link
                        to={`/projects/${projectId}/requirements/browse?panel=1&panelTab=verification`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-700 dark:text-gray-200"
                        title="Open the same structure tree in Requirements (left panel → Verification tab)"
                      >
                        <ExternalLink size={14} className="text-gray-400" aria-hidden />
                        Open in Requirements
                      </Link>
                    </div>
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                  <VerificationTreePanel
                    projectId={projectId!}
                    plans={plans}
                    testCases={testCases}
                    testSetups={testSetups}
                    runsByPlanId={runsByPlanId}
                    selectedNode={selectedNode}
                    onSelect={handleTreeSelect}
                    onCreatePlan={handleCreatePlan}
                    onCreateCase={handleCreateCase}
                    onCreateSetup={handleCreateSetup}
                    onCreateRun={handleCreateRun}
                    onDeletePlan={(id) => { if (confirm('Delete this test plan?')) deletePlanMutation.mutate(id) }}
                    onDeleteCase={(id) => { if (confirm('Delete this test case?')) deleteCaseMutation.mutate(id) }}
                    onDeleteSetup={(id) => { if (confirm('Delete this test setup?')) deleteSetupMutation.mutate(id) }}
                    onDeleteRun={(id) => { if (confirm('Delete this test run?')) deleteRunMutation.mutate(id) }}
                    onRemoveCaseFromPlan={handleRemoveCaseFromPlan}
                    onAddCaseToPlan={handleAddCaseToPlan}
                    onAddSetupToPlan={handleAddSetupToPlan}
                    onRemoveSetupFromPlan={handleRemoveSetupFromPlan}
                    requirementTestCaseLinks={requirementTestCaseLinks}
                    requirements={requirementsForTree}
                    onAddRequirementToTestCase={(caseId) => {
                      navigate(`/projects/${projectId}/requirements/browse?tree=verification&linkToCase=${caseId}`)
                    }}
                    onRemoveRequirementFromTestCase={(reqId, caseId) => {
                      removeRequirementFromTestCaseMutation.mutate({ reqId, caseId })
                    }}
                    onRequirementClick={(reqId) => {
                      navigate(`/projects/${projectId}/requirements/browse?requirementId=${reqId}`)
                    }}
                    onOpenTraceabilityMatrix={(focusReqId) => {
                      const qs = new URLSearchParams()
                      qs.set('tab', 'traceability')
                      if (focusReqId) qs.set('matrixReqId', focusReqId)
                      navigate(`/projects/${projectId}/verification?${qs.toString()}`, { replace: true })
                    }}
                    onOpenTraceabilityMatrixForCase={(caseId) => {
                      const qs = new URLSearchParams()
                      qs.set('tab', 'traceability')
                      qs.set('matrixCaseId', caseId)
                      navigate(`/projects/${projectId}/verification?${qs.toString()}`, { replace: true })
                    }}
                  />
                </div>
              </div>
              <div
                role="separator"
                aria-label="Resize structure panel"
                className="w-2 cursor-col-resize hover:bg-blue-400/50 active:bg-blue-500 transition-colors flex-shrink-0 relative group"
                onMouseDown={handleResizeStart}
              >
                <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-gray-200 dark:bg-gray-700 group-hover:bg-blue-400 transition-colors" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 text-gray-400 border border-gray-200 dark:border-gray-700 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                  <GripVertical size={12} />
                </div>
              </div>
            </>
          ) : (
            // Match Requirements: when closed, the panel takes zero space (toggle lives in the header).
            null
          )}
        </>
      )}

      {/* Main column + detail drawers share one flex row so the panel squeezes content (like Requirements). */}
      <div className="flex flex-1 min-h-0 min-w-0">
        <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden pr-6 gap-3">
        <div className="flex-shrink-0 flex items-center gap-2">
          {showTreePanel && (
            <button
              type="button"
              onClick={() => setIsTreePanelOpen((o) => !o)}
              className="p-1.5 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title={isTreePanelOpen ? 'Close left panel' : 'Open left panel (Verification structure)'}
              aria-label={isTreePanelOpen ? 'Close left panel' : 'Open left panel'}
            >
              {isTreePanelOpen ? <PanelLeftClose size={16} className="text-gray-500 dark:text-gray-400" /> : <PanelLeft size={16} className="text-gray-500 dark:text-gray-400" />}
            </button>
          )}
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Verification</h2>
          {projectId && (
            <div className="ml-auto">
              <SafetyLinkPanel variant="evidence" count={2} />
            </div>
          )}
        </div>

        <div className="flex-shrink-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto">
          <div className="flex border-b border-gray-200 dark:border-gray-700 min-w-max">
            {VERIFICATION_MAIN_TABS.map((tab) => {
              const Icon = tab.icon
              const active = !isTemplates && activeTabParam === tab.id
              const count =
                tab.id === 'plans' ? plans.length
                  : tab.id === 'cases' ? testCases.length
                    : tab.id === 'setups' ? testSetups.length
                      : tab.id === 'runs' ? (Array.isArray(testRunsData) ? testRunsData.length : 0)
                        : null
              const label = count != null ? `${tab.label} (${count})` : tab.label
              return (
                <button
                  key={tab.id}
                  onClick={() => handleMainTab(tab.id)}
                  className={clsx(
                    'flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors whitespace-nowrap',
                    active
                      ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  )}
                >
                  <Icon size={16} />
                  {label}
                </button>
              )
            })}
            <Link
              to={`/projects/${projectId}/verification/settings`}
              className={clsx(
                'flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors border-b-2 -mb-px',
                location.pathname.includes('/verification/settings')
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              )}
            >
              <Settings size={16} />
              Settings
            </Link>
            <Link
              to={`/projects/${projectId}/verification/templates`}
              className={clsx(
                'flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors border-b-2 -mb-px',
                isTemplates
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              )}
            >
              <FileCode size={16} />
              Templates
            </Link>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col">
          <Outlet />
        </div>
        </div>

        {projectId && (
        <>
          <TestPlanDetailDrawer
            plan={drawer.selectedPlan}
            isOpen={drawer.isPlanDrawerOpen}
            onClose={handleClosePlanDrawer}
            projectId={projectId}
          />
          <TestCaseDetailDrawer
            testCase={drawer.selectedCase}
            isOpen={drawer.isCaseDrawerOpen}
            onClose={handleCloseCaseDrawer}
            projectId={projectId}
          />
          <TestSetupDetailDrawer
            setup={drawer.selectedSetup}
            isOpen={drawer.isSetupDrawerOpen}
            onClose={handleCloseSetupDrawer}
            projectId={projectId}
          />
          <TestResultDetailDrawer
            testResult={drawer.selectedResult}
            isOpen={drawer.isResultDrawerOpen}
            onClose={handleCloseResultDrawer}
            projectId={projectId}
          />
          <TestRunDetailDrawer
            run={drawer.selectedRun}
            isOpen={drawer.isRunDrawerOpen}
            onClose={handleCloseRunDrawer}
            projectId={projectId}
          />
        </>
        )}
      </div>
    </div>
  )
}

export default function VerificationLayoutPage() {
  return (
    <VerificationDrawerProvider>
      <VerificationLayoutInner />
    </VerificationDrawerProvider>
  )
}
