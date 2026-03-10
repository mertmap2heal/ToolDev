import { useEffect, useCallback, useRef, useMemo, useState } from 'react'
import { Outlet, useParams, useNavigate, useLocation, Link, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { FileCode, Settings, ChevronLeft, ChevronRight, FolderTree } from 'lucide-react'

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

  const [isTreePanelOpen, setIsTreePanelOpen] = useState(true)
  const PANEL_MIN = 260
  const PANEL_MAX = 520
  const PANEL_DEFAULT = 340
  const [leftPanelWidth, setLeftPanelWidth] = useState(PANEL_DEFAULT)
  const resizeContainerRef = useRef<HTMLDivElement>(null)

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

    if (!entity) {
      setBreadcrumbItems(null)
      return
    }

    const projectName = projectData?.name || 'Project'
    setBreadcrumbItems([
      { label: 'Home', path: '/' },
      { label: projectName, path: `/projects/${projectId}` },
      { label: 'Verification', path: basePath },
      { label: VERIFICATION_TAB_LABELS[entity.tab] || entity.tab, path: `${basePath}?tab=${entity.tab}` },
      { label: entity.label },
    ])
  }, [
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

  return (
    <div ref={resizeContainerRef} className="flex h-[calc(100vh-4rem)]">
      {showTreePanel && (
        <>
          {isTreePanelOpen ? (
            <>
              <div style={{ width: leftPanelWidth }} className="flex-shrink-0 overflow-hidden flex flex-col">
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
                    navigate(`/projects/${projectId}/requirements?tree=verification&linkToCase=${caseId}`)
                  }}
                  onRemoveRequirementFromTestCase={(reqId, caseId) => {
                    removeRequirementFromTestCaseMutation.mutate({ reqId, caseId })
                  }}
                  onRequirementClick={(reqId) => {
                    navigate(`/projects/${projectId}/requirements?requirementId=${reqId}`)
                  }}
                />
              </div>
              <div
                role="separator"
                aria-label="Resize tree panel"
                onMouseDown={handleResizeStart}
                className="w-1 flex-shrink-0 cursor-col-resize bg-gray-100 dark:bg-gray-700 hover:bg-blue-300 dark:hover:bg-blue-600 transition-colors"
              />
            </>
          ) : (
            <div className="shrink-0 w-8 flex flex-col items-center py-2 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <button
                type="button"
                onClick={() => setIsTreePanelOpen(true)}
                className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                title="Expand tree"
                aria-label="Expand tree"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </>
      )}

      {/* Main column: title, tabs, content */}
      <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden pr-6 gap-6">
        <div className="flex-shrink-0 flex items-center justify-between gap-2">
          {showTreePanel && (
            <button
              type="button"
              onClick={() => setIsTreePanelOpen((o) => !o)}
              className={clsx(
                'inline-flex gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors',
                isTreePanelOpen
                  ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              )}
              title={isTreePanelOpen ? 'Hide tree' : 'Show tree'}
            >
              {isTreePanelOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
              <FolderTree size={16} />
              Tree
            </button>
          )}
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Verification</h2>
          {projectId && <SafetyLinkPanel variant="evidence" count={2} />}
        </div>

        <div className="flex-shrink-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            {VERIFICATION_MAIN_TABS.map((tab) => {
              const Icon = tab.icon
              const active = !isTemplates && activeTabParam === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => handleMainTab(tab.id)}
                  className={clsx(
                    'flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors',
                    active
                      ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  )}
                >
                  <Icon size={16} />
                  {tab.label}
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

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <Outlet />
        </div>
      </div>

      {/* Drawers - sibling of left column, full height from top (like Requirements) */}
      {projectId && (
        <>
          <TestPlanDetailDrawer
            plan={drawer.selectedPlan}
            isOpen={drawer.isPlanDrawerOpen}
            onClose={drawer.closePlan}
            projectId={projectId}
          />
          <TestCaseDetailDrawer
            testCase={drawer.selectedCase}
            isOpen={drawer.isCaseDrawerOpen}
            onClose={drawer.closeCase}
            projectId={projectId}
          />
          <TestSetupDetailDrawer
            setup={drawer.selectedSetup}
            isOpen={drawer.isSetupDrawerOpen}
            onClose={drawer.closeSetup}
            projectId={projectId}
          />
          <TestResultDetailDrawer
            testResult={drawer.selectedResult}
            isOpen={drawer.isResultDrawerOpen}
            onClose={drawer.closeResult}
            projectId={projectId}
          />
          <TestRunDetailDrawer
            run={drawer.selectedRun}
            isOpen={drawer.isRunDrawerOpen}
            onClose={drawer.closeRun}
            projectId={projectId}
          />
        </>
      )}
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
