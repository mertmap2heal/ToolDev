import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  Plus,
  Settings,
  FolderTree,
  Shield,
  Layers,
  ChevronLeft,
  ChevronRight,
  BarChart3,
} from 'lucide-react'

import FunctionTreePanel from '../../components/functions/FunctionTreePanel'
import FunctionVerificationCoverageMatrix from '../../components/requirements/FunctionVerificationCoverageMatrix'
import FunctionDetailPanel from '../../components/functions/FunctionDetailPanel'
import { RelationshipGraphView } from '../../components/relationshipGraph'
import CreateFunctionModal from '../../components/functions/CreateFunctionModal'
import DeleteFunctionModal from '../../components/functions/DeleteFunctionModal'
import RaiseIssueModal from '../../components/functions/RaiseIssueModal'
import CreateChangeRequestModal from '../../components/changeRequests/CreateChangeRequestModal'
import SafetyLinkPanel from '../../components/safety/SafetyLinkPanel'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { functionService } from '../../services/function.service'
import { issueService } from '../../services/issue.service'
import { changeRequestService } from '../../services/changeRequest.service'
import type { SystemFunction } from 'shared/types/engineering.types'

export default function SystemFunctionsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()

  // State — sync from ?functionId= for deep links from PBS
  const functionIdFromUrl = searchParams.get('functionId')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (functionIdFromUrl) setSelectedId(functionIdFromUrl)
  }, [functionIdFromUrl])
  const [createModal, setCreateModal] = useState<{ open: boolean; parentId: string | null }>({ open: false, parentId: null })
  const [deleteModal, setDeleteModal] = useState<{ func: SystemFunction } | null>(null)
  const [raiseIssueTarget, setRaiseIssueTarget] = useState<string | null>(null)
  const [changeRequestModal, setChangeRequestModal] = useState<{ isOpen: boolean; sourceId: string; sourceName: string } | null>(null)
  const [leftPanelViewMode, setLeftPanelViewModeState] = useState<'tree' | 'graph'>(() => {
    try {
      const s = sessionStorage.getItem(`functions::view-mode::${projectId ?? 'default'}`)
      return s === 'graph' ? 'graph' : 'tree'
    } catch {
      return 'tree'
    }
  })
  const setLeftPanelViewMode = useCallback((value: 'tree' | 'graph' | ((prev: 'tree' | 'graph') => 'tree' | 'graph')) => {
    setLeftPanelViewModeState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value
      try {
        sessionStorage.setItem(`functions::view-mode::${projectId ?? 'default'}`, next)
      } catch { /* ignore */ }
      return next
    })
  }, [projectId])

  useEffect(() => {
    try {
      const s = sessionStorage.getItem(`functions::view-mode::${projectId ?? 'default'}`)
      setLeftPanelViewModeState(s === 'graph' ? 'graph' : 'tree')
    } catch { /* ignore */ }
  }, [projectId])

  const [isTreePanelOpen, setIsTreePanelOpen] = useState(true)
  const [isFunctionVerificationMatrixOpen, setIsFunctionVerificationMatrixOpen] = useState(false)

  // Resizable panel
  const PANEL_MIN = 260
  const PANEL_MAX = 520
  const PANEL_DEFAULT = 340
  const [leftPanelWidth, setLeftPanelWidth] = useState(PANEL_DEFAULT)
  const resizeContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`functions::panel-width::${projectId ?? 'default'}`)
      if (stored) {
        const w = parseInt(stored, 10)
        if (!Number.isNaN(w) && w >= PANEL_MIN && w <= PANEL_MAX) setLeftPanelWidth(w)
      }
    } catch { /* ignore */ }
  }, [projectId])

  useEffect(() => {
    try {
      localStorage.setItem(`functions::panel-width::${projectId ?? 'default'}`, String(leftPanelWidth))
    } catch { /* ignore */ }
  }, [leftPanelWidth, projectId])

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const container = resizeContainerRef.current
    const onMove = (moveEvent: MouseEvent) => {
      const left = container?.getBoundingClientRect().left ?? 0
      const rawWidth = moveEvent.clientX - left
      setLeftPanelWidth(Math.min(PANEL_MAX, Math.max(PANEL_MIN, rawWidth)))
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

  // Data queries
  const { data: functions = [], isLoading } = useQuery({
    queryKey: ['functions', projectId],
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID required')
      const response = await functionService.getFunctions(projectId)
      if (response.success && response.data) return response.data
      throw new Error(response.error || 'Failed to load functions')
    },
    enabled: !!projectId,
    placeholderData: (prev) => prev, // Keep previous data during refetch
    refetchOnWindowFocus: false,
    staleTime: 30_000, // Avoid background refetches that can cause graph to flicker
  })

  // Snapshot functions when switching to graph mode (like PBS uses stable state)
  const graphSnapshotRef = useRef<SystemFunction[]>([])
  if (leftPanelViewMode === 'graph' && functions.length > 0) {
    graphSnapshotRef.current = functions
  }
  const functionsForGraph = leftPanelViewMode === 'graph'
    ? (graphSnapshotRef.current.length > 0 ? graphSnapshotRef.current : functions)
    : functions

  const { data: issues = [] } = useQuery({
    queryKey: ['issues', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await issueService.getIssues(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  const { data: changeRequests = [] } = useQuery({
    queryKey: ['change-requests', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await changeRequestService.getChangeRequests(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  const selectedFunction = useMemo(
    () => functions.find(f => f.id === selectedId) || null,
    [functions, selectedId]
  )

  // Stats
  const stats = useMemo(() => {
    const total = functions.length
    const rootCount = functions.filter(f => !f.parentId).length
    const maxDepth = functions.reduce((max, f) => Math.max(max, f.level ?? 0), 0)
    const byStatus = {
      draft: functions.filter(f => f.status === 'draft').length,
      wip: functions.filter(f => f.status === 'work-in-progress').length,
      review: functions.filter(f => f.status === 'in-review').length,
      done: functions.filter(f => f.status === 'done').length,
    }
    const critical = functions.filter(f => f.criticality === 'critical' || f.criticality === 'high').length
    return { total, rootCount, maxDepth, byStatus, critical }
  }, [functions])

  // Handlers
  const handleAddRoot = useCallback(() => {
    setCreateModal({ open: true, parentId: null })
  }, [])

  const handleAddChild = useCallback((parentId: string) => {
    setCreateModal({ open: true, parentId })
  }, [])

  const handleDelete = useCallback((func: SystemFunction) => {
    setDeleteModal({ func })
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteModal || !projectId) return
    try {
      await functionService.deleteFunction(projectId, deleteModal.func.id)
      queryClient.invalidateQueries({ queryKey: ['functions', projectId] })
      if (selectedId === deleteModal.func.id) setSelectedId(null)
    } catch (error) {
      console.error('Delete function error:', error)
    }
    setDeleteModal(null)
  }, [deleteModal, projectId, queryClient, selectedId])

  const handleRaiseIssue = useCallback((funcId: string) => {
    setRaiseIssueTarget(funcId)
  }, [])

  const handleCreateChangeRequest = useCallback((sourceId: string, sourceName: string) => {
    setChangeRequestModal({ isOpen: true, sourceId, sourceName })
  }, [])

  if (!projectId) return null

  const createParentFunc = createModal.parentId
    ? functions.find(f => f.id === createModal.parentId) || null
    : null

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Top bar */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
              <Settings size={16} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">Functions</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Functional Breakdown Structure</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Stats summary */}
            <div className="hidden lg:flex items-center gap-4 mr-4 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1.5">
                <FolderTree size={13} />
                {stats.total} functions
              </span>
              <span className="flex items-center gap-1.5">
                <Layers size={13} />
                {stats.maxDepth + 1} levels
              </span>
              {stats.critical > 0 && (
                <span className="flex items-center gap-1.5 text-red-500">
                  <Shield size={13} />
                  {stats.critical} high/critical
                </span>
              )}
            </div>

            {/* Status bar mini */}
            <div className="hidden md:flex items-center gap-1 mr-2">
              {[
                { count: stats.byStatus.draft, color: 'bg-gray-400', label: 'Draft' },
                { count: stats.byStatus.wip, color: 'bg-yellow-500', label: 'WIP' },
                { count: stats.byStatus.review, color: 'bg-blue-500', label: 'Review' },
                { count: stats.byStatus.done, color: 'bg-green-500', label: 'Done' },
              ].map(s => s.count > 0 && (
                <span key={s.label} className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 px-1.5 py-0.5 rounded" title={s.label}>
                  <span className={`w-1.5 h-1.5 rounded-full ${s.color}`} />
                  {s.count}
                </span>
              ))}
            </div>

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

            <SafetyLinkPanel variant="impact" count={2} />

            <button
              type="button"
              onClick={() => setIsFunctionVerificationMatrixOpen(true)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 transition-colors text-sm font-medium"
              title="Function Verification Coverage Matrix"
            >
              <BarChart3 size={16} />
              <span>Verification Coverage</span>
            </button>

            <button
              onClick={handleAddRoot}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors text-sm font-medium"
            >
              <Plus size={16} />
              <span>New Function</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main content: tree + detail */}
      <div ref={resizeContainerRef} className="flex-1 flex overflow-hidden">
        {/* Left: Tree panel (collapsible) - always tree, never graph */}
        {isTreePanelOpen ? (
          <>
            <div style={{ width: leftPanelWidth }} className="flex-shrink-0 overflow-hidden">
              <FunctionTreePanel
                functions={functions}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onAddRoot={handleAddRoot}
                onAddChild={handleAddChild}
                onGraphClick={() => setLeftPanelViewMode('graph')}
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
          <div
            className="shrink-0 w-8 flex flex-col items-center py-2 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"
            style={{ minWidth: 32 }}
          >
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

        {/* Center: Graph (when graph mode) OR FunctionDetailPanel/empty (when tree mode) */}
        <div className="flex-1 min-w-0 flex flex-col rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          {leftPanelViewMode === 'graph' ? (
            <RelationshipGraphView
              projectId={projectId}
              mode="functions"
              functions={functionsForGraph}
              selectedId={selectedId}
              onNodeSelect={(nodeId) => setSelectedId(nodeId)}
              onBackToTree={() => setLeftPanelViewMode('tree')}
              showBackButton
            />
          ) : isLoading ? (
            <div className="h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Loading functions...</p>
              </div>
            </div>
          ) : selectedFunction ? (
            <FunctionDetailPanel
              func={selectedFunction}
              allFunctions={functions}
              projectId={projectId}
              issues={issues}
              changeRequests={changeRequests}
              onRaiseIssue={handleRaiseIssue}
              onCreateChangeRequest={handleCreateChangeRequest}
              onDelete={handleDelete}
              onAddChild={handleAddChild}
              onSelectFunction={setSelectedId}
            />
          ) : (
            <div className="h-full flex items-center justify-center bg-gray-50/50 dark:bg-gray-900/30">
              <div className="text-center max-w-md px-6">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-4">
                  <Settings size={28} className="text-blue-400 dark:text-blue-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {functions.length === 0 ? 'Define Your Functions' : 'Select a Function'}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
                  {functions.length === 0
                    ? 'Start by creating your top-level system functions. You can then decompose them into sub-functions to build a complete functional breakdown structure.'
                    : 'Select a function from the tree on the left to view its details, linked elements, and hierarchy.'}
                </p>
                {functions.length === 0 && (
                  <button
                    onClick={handleAddRoot}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 mx-auto transition-colors text-sm font-medium"
                  >
                    <Plus size={15} />
                    Create First Function
                  </button>
                )}

                {/* Statistics grid when no selection */}
                {functions.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 mt-6">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 text-left">
                      <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Functions</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.total}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 text-left">
                      <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Root Functions</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.rootCount}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 text-left">
                      <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hierarchy Depth</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.maxDepth + 1}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 text-left">
                      <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Completed</p>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{stats.byStatus.done}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <CreateFunctionModal
        isOpen={createModal.open}
        onClose={() => setCreateModal({ open: false, parentId: null })}
        projectId={projectId}
        parentId={createModal.parentId}
        parentFunction={createParentFunc}
        allFunctions={functions}
      />

      {deleteModal && (
        <DeleteFunctionModal
          isOpen={true}
          functionName={deleteModal.func.name}
          functionId={deleteModal.func.functionId || deleteModal.func.id}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteModal(null)}
        />
      )}

      {raiseIssueTarget && (
        <RaiseIssueModal
          isOpen={true}
          onClose={() => setRaiseIssueTarget(null)}
          projectId={projectId}
          selectedFunctions={functions.filter(f => f.id === raiseIssueTarget)}
        />
      )}

      {changeRequestModal && (
        <CreateChangeRequestModal
          isOpen={changeRequestModal.isOpen}
          onClose={() => setChangeRequestModal(null)}
          projectId={projectId}
          sourceType="function"
          sourceId={changeRequestModal.sourceId}
          sourceName={changeRequestModal.sourceName}
        />
      )}

      {isFunctionVerificationMatrixOpen && projectId && (
        <FunctionVerificationCoverageMatrix
          projectId={projectId}
          onClose={() => setIsFunctionVerificationMatrixOpen(false)}
        />
      )}
    </div>
  )
}
