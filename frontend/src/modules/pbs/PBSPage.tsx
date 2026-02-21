import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { projectService } from '../../services/project.service'
import { requirementService } from '../../services/requirement.service'
import { functionService } from '../../services/function.service'
import { linkService } from '../../services/link.service'
import {
  Plus,
  Download,
  Upload,
  FolderTree,
  ChevronDown,
  Loader2,
  Check,
  AlertCircle,
  Undo2,
  Redo2,
  Printer,
  Save,
  FileText,
  PanelRight,
  PanelRightClose,
  Box,
  Layers,
} from 'lucide-react'
import clsx from 'clsx'
import type { PBSNode, PBSChangeLogEntry, SaveStatus } from './types'
import { loadPBSAsync, savePBSAsync, estimatePBSStorageBytes, getStorageQuota } from './storage'
import { nowISO } from './utils'
import { getNodePath } from './treeUtils'
import { createPBSHandlers, addChangeLogEntry } from './handlers'
import { createProjectRootNode } from './utils'
import PBSTree from './PBSTree'
import PBSNodeEditor from './PBSNodeEditor'
import PBSStats from './PBSStats'
import PBSValidation from './PBSValidation'
import RenameModal from './RenameModal'
import ImportModal from './ImportModal'
import PBSPrintView from './PBSPrintView'
import PBSToolsMenu from './PBSToolsMenu'
import RequirementsPBSTree from '../../components/requirements/RequirementsPBSTree'
import FunctionsPBSTree from '../../components/functions/FunctionsPBSTree'
import { LINKAGE_V1 } from '../../config/featureFlags'
import { buildDeepLink } from '../../linkage/buildDeepLink'
import type { LinkedElementClickPayload } from '../../components/requirements/RequirementsPBSTree'

const SAVE_DEBOUNCE_MS = 600

export default function PBSPage() {
  const params = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const projectId = params.projectId ?? undefined
  const focusType = searchParams.get('focusType')
  const focusId = searchParams.get('focusId')
  const [nodes, setNodes] = useState([] as PBSNode[])
  const [changeLog, setChangeLog] = useState([] as PBSChangeLogEntry[])
  const [selectedId, setSelectedId] = useState(null as string | null)
  const [saveStatus, setSaveStatus] = useState('saved' as SaveStatus)
  const [addDropdownOpen, setAddDropdownOpen] = useState(false)
  const [renameNodeId, setRenameNodeId] = useState(null as string | null)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [printViewOpen, setPrintViewOpen] = useState(false)
  const [storageQuotaWarning, setStorageQuotaWarning] = useState<string | null>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Resizable left panel (persist per project)
  const PANEL_WIDTH_KEY = `pbs::panel-width::${projectId ?? 'default'}`
  const PANEL_MIN = 240
  const PANEL_MAX = 600
  const PANEL_DEFAULT = 320
  const [leftPanelWidth, setLeftPanelWidth] = useState(PANEL_DEFAULT)
  const [isRequirementsPanelOpen, setIsRequirementsPanelOpen] = useState(true)
  const [rightPanelTab, setRightPanelTab] = useState<'requirements' | 'functions'>('requirements')
  const [selectedComponentIdForReqs, setSelectedComponentIdForReqs] = useState<string | null>(null)
  const REQS_PANEL_WIDTH_KEY = `pbs::reqs-panel-width::${projectId ?? 'default'}`
  const REQS_PANEL_MIN = 260
  const REQS_PANEL_MAX = 500
  const [requirementsPanelWidth, setRequirementsPanelWidth] = useState(300)

  useEffect(() => {
    if (focusType === 'pbs_component' && focusId && nodes.some((n) => n.id === focusId)) {
      setSelectedId(focusId)
    }
  }, [focusType, focusId, nodes])

  useEffect(() => {
    try {
      const key = `pbs::panel-width::${projectId ?? 'default'}`
      const stored = localStorage.getItem(key)
      if (stored) {
        const w = parseInt(stored, 10)
        if (!Number.isNaN(w) && w >= PANEL_MIN && w <= PANEL_MAX) setLeftPanelWidth(w)
      }
    } catch {
      // ignore
    }
  }, [projectId])

  useEffect(() => {
    try {
      const stored = localStorage.getItem(REQS_PANEL_WIDTH_KEY)
      if (stored) {
        const w = parseInt(stored, 10)
        if (!Number.isNaN(w) && w >= REQS_PANEL_MIN && w <= REQS_PANEL_MAX) setRequirementsPanelWidth(w)
      }
    } catch {
      // ignore
    }
  }, [projectId, REQS_PANEL_WIDTH_KEY])

  useEffect(() => {
    try {
      localStorage.setItem(REQS_PANEL_WIDTH_KEY, String(requirementsPanelWidth))
    } catch {
      // ignore
    }
  }, [requirementsPanelWidth, REQS_PANEL_WIDTH_KEY])

  useEffect(() => {
    try {
      localStorage.setItem(PANEL_WIDTH_KEY, String(leftPanelWidth))
    } catch {
      // ignore
    }
  }, [leftPanelWidth, PANEL_WIDTH_KEY])

  const resizeContainerRef = useRef<HTMLDivElement>(null)
  const reqsResizeContainerRef = useRef<HTMLDivElement>(null)
  const handleReqsResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const container = reqsResizeContainerRef.current
      const onMove = (moveEvent: MouseEvent) => {
        const containerRect = container?.getBoundingClientRect()
        if (!containerRect) return
        const rawWidth = containerRect.right - moveEvent.clientX
        const newWidth = Math.min(REQS_PANEL_MAX, Math.max(REQS_PANEL_MIN, rawWidth))
        setRequirementsPanelWidth(newWidth)
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
    },
    [REQS_PANEL_MIN, REQS_PANEL_MAX]
  )
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const container = resizeContainerRef.current
      const onMove = (moveEvent: MouseEvent) => {
        const left = container?.getBoundingClientRect().left ?? 0
        const rawWidth = moveEvent.clientX - left
        const newWidth = Math.min(PANEL_MAX, Math.max(PANEL_MIN, rawWidth))
        setLeftPanelWidth(newWidth)
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
    },
    [PANEL_MIN, PANEL_MAX]
  )

  // Undo/Redo history
  const [history, setHistory] = useState<{ past: PBSNode[][]; future: PBSNode[][] }>({
    past: [],
    future: [],
  })
  const isUndoRedoRef = useRef(false)
  const lastNodesRef = useRef<string>('')

  const projectKey = projectId ?? 'default'
  const queryClient = useQueryClient()

  const { data: projectData, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) return null
      const response = await projectService.getProject(projectId)
      return response.success && response.data ? response.data : null
    },
    enabled: !!projectId,
  })

  const { data: requirements = [] } = useQuery({
    queryKey: ['requirements', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await requirementService.getAllRequirements(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId && isRequirementsPanelOpen,
  })

  const { data: functions = [] } = useQuery({
    queryKey: ['functions', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await functionService.getFunctions(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId && isRequirementsPanelOpen,
  })

  const { data: links = [] } = useQuery({
    queryKey: ['links', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await linkService.getLinks(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId && isRequirementsPanelOpen && LINKAGE_V1,
  })
  const projectDisplayName =
    (projectData?.name != null && String(projectData.name).trim() !== '')
      ? String(projectData.name).trim()
      : (projectId ?? 'Project')
  const projectReady = !projectId || !projectLoading

  const pbsLoadReturnedEmptyRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    loadPBSAsync(projectId).then((data) => {
      if (!cancelled) {
        if (data.nodes.length > 0) {
          setNodes(data.nodes)
          setChangeLog(data.changeLog)
          pbsLoadReturnedEmptyRef.current = false
        } else {
          setNodes([])
          setChangeLog([])
          pbsLoadReturnedEmptyRef.current = true
        }
      }
    })
    return () => { cancelled = true }
  }, [projectId])

  useEffect(() => {
    if (nodes.length !== 0 || !projectReady || !pbsLoadReturnedEmptyRef.current) return
    pbsLoadReturnedEmptyRef.current = false
    const root = createProjectRootNode(projectDisplayName)
    setNodes([root])
    setChangeLog([
      {
        id: crypto.randomUUID?.() ?? `cl-${Date.now()}`,
        nodeId: root.id,
        action: 'created',
        timestamp: nowISO(),
        details: 'Project root created',
      },
    ])
    setSaveStatus('unsaved')
  }, [projectId, projectData, projectLoading, nodes.length, projectDisplayName, projectReady])

  // Sync root node name when it's empty and we have project name from API (same source as dashboard at /)
  useEffect(() => {
    if (nodes.length === 0 || !projectDisplayName) return
    const root = nodes.find((n) => n.parentId === null)
    if (!root) return
    const currentName = root.name == null ? '' : String(root.name).trim()
    if (currentName !== '') return
    const updated = nodes.map((n) =>
      n.id === root.id ? { ...n, name: projectDisplayName, updatedAt: nowISO() } : n
    )
    setNodes(updated)
    setSaveStatus('unsaved')
  }, [projectDisplayName, nodes])

  const persist = useCallback(() => {
    setSaveStatus('saving')
    savePBSAsync(projectId, { nodes, changeLog })
      .then(() => {
        setSaveStatus('saved')
        queryClient.invalidateQueries({ queryKey: ['pbs-nodes', projectId] })
      })
      .catch(() => setSaveStatus('unsaved'))
  }, [projectId, nodes, changeLog, queryClient])

  // Storage quota warning (run after persist and when data size changes)
  useEffect(() => {
    let cancelled = false
    const check = async () => {
      const quota = await getStorageQuota()
      const pbsBytes = estimatePBSStorageBytes(projectId)
      if (cancelled) return
      if (!quota || quota.quota <= 0) {
        setStorageQuotaWarning(null)
        return
      }
      const ratio = quota.usage / quota.quota
      if (ratio >= 0.95) {
        setStorageQuotaWarning('Storage is almost full. Consider removing attachments or old projects.')
      } else if (ratio >= 0.8) {
        setStorageQuotaWarning('Storage is getting full. Consider exporting or cleaning up data.')
      } else if (pbsBytes >= 4 * 1024 * 1024) {
        setStorageQuotaWarning('This project uses a lot of storage. Large attachments are stored locally.')
      } else {
        setStorageQuotaWarning(null)
      }
    }
    check()
    return () => { cancelled = true }
  }, [projectId, nodes, changeLog, saveStatus])

  // Auto-save logic removed. Using explicit save flow instead.

  const markUnsaved = useCallback(() => {
    setSaveStatus('unsaved')
  }, [])

  // Track changes for undo/redo (debounced to batch rapid changes)
  useEffect(() => {
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false
      lastNodesRef.current = JSON.stringify(nodes)
      return
    }

    const currentJson = JSON.stringify(nodes)
    if (lastNodesRef.current && currentJson !== lastNodesRef.current) {
      const previousNodes = JSON.parse(lastNodesRef.current) as PBSNode[]
      setHistory((prev) => ({
        past: [...prev.past, previousNodes].slice(-30), // Keep last 30 states
        future: [], // Clear future on new change
      }))
    }
    lastNodesRef.current = currentJson
  }, [nodes])

  const canUndo = history.past.length > 0
  const canRedo = history.future.length > 0

  const undo = useCallback(() => {
    if (history.past.length === 0) return

    isUndoRedoRef.current = true
    const newPast = history.past.slice(0, -1)
    const previousNodes = history.past[history.past.length - 1]

    setHistory({
      past: newPast,
      future: [nodes, ...history.future],
    })
    setNodes(previousNodes)
    markUnsaved()
  }, [history, nodes, markUnsaved])

  const redo = useCallback(() => {
    if (history.future.length === 0) return

    isUndoRedoRef.current = true
    const newFuture = history.future.slice(1)
    const nextNodes = history.future[0]

    setHistory({
      past: [...history.past, nodes],
      future: newFuture,
    })
    setNodes(nextNodes)
    markUnsaved()
  }, [history, nodes, markUnsaved])

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if in input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z')
      ) {
        e.preventDefault()
        redo()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  const selectedNode = selectedId ? nodes.find((n) => n.id === selectedId) : null

  const handlers = useMemo(() => {
    const c = {
      nodes,
      setNodes,
      setChangeLog,
      selectedId,
      setSelectedId,
      setRenameNodeId,
      setAddDropdownOpen,
      markUnsaved,
    }
    return createPBSHandlers(c)
  }, [nodes, setNodes, setChangeLog, selectedId, setSelectedId, setRenameNodeId, setAddDropdownOpen, markUnsaved])

  // Get the node being renamed (for the modal)
  const renameNode = renameNodeId ? nodes.find((n) => n.id === renameNodeId) : null

  const handleRenameSave = useCallback(
    (newName: string) => {
      if (!renameNodeId) return
      setNodes((prev) =>
        prev.map((n) =>
          n.id === renameNodeId
            ? { ...n, name: newName, updatedAt: nowISO(), revision: n.revision + 1 }
            : n
        )
      )
      setChangeLog((prev) =>
        addChangeLogEntry(prev, renameNodeId, 'updated', `Renamed to "${newName}"`)
      )
      markUnsaved()
      setRenameNodeId(null)
    },
    [renameNodeId, markUnsaved]
  )

  const handleRenameCancel = useCallback(() => {
    setRenameNodeId(null)
  }, [])

  // Inline rename handler (used when double-clicking in tree)
  const handleInlineRename = useCallback(
    (nodeId: string, newName: string) => {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId
            ? { ...n, name: newName, updatedAt: nowISO(), revision: n.revision + 1 }
            : n
        )
      )
      setChangeLog((prev) =>
        addChangeLogEntry(prev, nodeId, 'updated', `Renamed to "${newName}"`)
      )
      markUnsaved()
    },
    [markUnsaved]
  )

  const handleImport = useCallback(
    (importedNodes: PBSNode[], importedChangeLog: PBSChangeLogEntry[], mode: 'replace' | 'merge') => {
      if (mode === 'replace') {
        setNodes(importedNodes)
        setChangeLog(importedChangeLog)
      } else {
        // Merge mode: update existing nodes by ID, add new ones
        setNodes((prev) => {
          const nodeMap = new Map(prev.map((n) => [n.id, n]))
          for (const node of importedNodes) {
            nodeMap.set(node.id, node)
          }
          return Array.from(nodeMap.values())
        })
        setChangeLog((prev) => {
          const entryMap = new Map(prev.map((e) => [e.id, e]))
          for (const entry of importedChangeLog) {
            entryMap.set(entry.id, entry)
          }
          return Array.from(entryMap.values())
        })
      }
      markUnsaved()
      setSelectedId(null)
      setImportModalOpen(false)
    },
    [markUnsaved]
  )

  const exportCSV = useCallback(() => {
    const headers = ['PBS ID', 'Name', 'Type', 'Status', 'Path']
    const pathMap = new Map<string, string>()
    nodes.forEach((n) => {
      pathMap.set(n.id, getNodePath(nodes, n.id).map((x) => x.name).join(' / '))
    })
    const rows = nodes
      .sort((a, b) => a.pbsCode.localeCompare(b.pbsCode))
      .map((n) => [n.pbsCode, n.name, n.type, n.status, pathMap.get(n.id) ?? ''].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    const csv = [headers.join(','), ...rows].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pbs-${projectKey}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [nodes, projectKey])

  const handleLinkedElementClick = useCallback(
    (payload: LinkedElementClickPayload) => {
      if (!projectId) return
      const { targetType, targetId } = payload
      if (targetType === 'requirement') {
        navigate(`/projects/${projectId}/requirements?requirementId=${targetId}`)
      } else {
        navigate(buildDeepLink(projectId, { type: targetType, id: targetId }))
      }
    },
    [projectId, navigate]
  )

  const exportJSON = useCallback(() => {
    const json = JSON.stringify({ nodes, changeLog }, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pbs-${projectKey}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [nodes, changeLog, projectKey])

  const siblingNames = selectedNode?.parentId
    ? nodes.filter((n) => n.parentId === selectedNode.parentId).map((n) => n.name)
    : []
  const duplicateNameWarning =
    selectedNode && siblingNames.filter((n) => n === selectedNode.name).length > 1

  const stats = useMemo(() => {
    const rootCount = nodes.filter((n) => !n.parentId).length
    const nodeMap = new Map(nodes.map((n) => [n.id, n]))
    let maxDepth = 0
    const getDepth = (id: string, visited = new Set<string>()): number => {
      if (visited.has(id)) return 0
      visited.add(id)
      const n = nodeMap.get(id)
      if (!n || !n.parentId) return 1
      return 1 + getDepth(n.parentId, visited)
    }
    nodes.forEach((n) => {
      const d = getDepth(n.id)
      if (d > maxDepth) maxDepth = d
    })
    return { total: nodes.length, rootCount, maxDepth }
  }, [nodes])

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Top bar - aligned with Functions page */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
              <Box size={16} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">Product Breakdown Structure</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Product breakdown structure</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Stats summary - aligned with Functions */}
            <div className="hidden lg:flex items-center gap-4 mr-4 text-xs text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1.5">
                <Layers size={13} />
                {stats.total} components
              </span>
              <span className="flex items-center gap-1.5">
                <FolderTree size={13} />
                {stats.maxDepth || 1} levels
              </span>
            </div>

            <div className="flex items-center gap-2">
            {saveStatus === 'unsaved' ? (
              <button
                type="button"
                onClick={persist}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
              >
                <Save size={14} />
                Save Changes
              </button>
            ) : (
              <span
                className={clsx(
                  'text-sm flex items-center gap-1.5 px-2 py-1 rounded-md border',
                  saveStatus === 'saved' && 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
                  saveStatus === 'saving' && 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'
                )}
              >
                {saveStatus === 'saved' && <Check size={14} />}
                {saveStatus === 'saving' && <Loader2 size={14} className="animate-spin" />}
                {saveStatus === 'saved' && 'Saved'}
                {saveStatus === 'saving' && 'Saving…'}
              </span>
            )}
          </div>
          <div className="flex items-center border-l border-gray-300 dark:border-gray-600 pl-3 ml-1">
            <button
              type="button"
              onClick={undo}
              disabled={!canUndo}
              className={clsx(
                'p-1.5 rounded',
                canUndo
                  ? 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
              )}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 size={18} />
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={!canRedo}
              className={clsx(
                'p-1.5 rounded',
                canRedo
                  ? 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
              )}
              title="Redo (Ctrl+Y)"
            >
              <Redo2 size={18} />
            </button>
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setAddDropdownOpen((o) => !o)}
              className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              <Plus size={16} />
              Add Component
              <ChevronDown size={14} />
            </button>
            {addDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setAddDropdownOpen(false)}
                  aria-hidden
                />
                <div className="absolute right-0 top-full mt-1 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 min-w-[180px]">
                  <button
                    type="button"
                    onClick={() => handlers.addRoot()}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Add root component
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedNode) handlers.addChild(selectedNode.id)
                      else handlers.addRoot()
                      setAddDropdownOpen(false)
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Add child component
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedNode) handlers.addSibling(selectedNode.id)
                      else handlers.addRoot()
                      setAddDropdownOpen(false)
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Add sibling component
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsRequirementsPanelOpen((o) => !o)}
            className={clsx(
              'inline-flex gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors',
              isRequirementsPanelOpen
                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            )}
            title={isRequirementsPanelOpen ? 'Hide requirements' : 'Show requirements'}
          >
            {isRequirementsPanelOpen ? <PanelRightClose size={16} /> : <PanelRight size={16} />}
            <FileText size={16} />
            Requirements
          </button>
          <PBSToolsMenu
            onExportCSV={exportCSV}
            onExportJSON={exportJSON}
            onImport={() => setImportModalOpen(true)}
            onPrint={() => setPrintViewOpen(true)}
            hasNodes={nodes.length > 0}
          />
          </div>
        </div>
      </div>

      {(duplicateNameWarning || storageQuotaWarning) && (
        <div className="flex-shrink-0 px-6 py-2 space-y-2">
          {duplicateNameWarning && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm">
              <AlertCircle size={16} />
              Duplicate sibling name — consider renaming for clarity.
            </div>
          )}
          {storageQuotaWarning && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm">
              <AlertCircle size={16} />
              {storageQuotaWarning}
            </div>
          )}
        </div>
      )}

      {/* Validation Warnings */}
      <PBSValidation nodes={nodes} onSelectNode={setSelectedId} />

      <div
        ref={resizeContainerRef}
        className="flex-1 flex overflow-hidden min-h-0"
      >
        <div
          className="shrink-0 flex flex-col gap-2"
          style={{ width: leftPanelWidth }}
        >
          <PBSTree
            nodes={nodes}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onAddRoot={handlers.addRoot}
            onAddChild={handlers.addChild}
            onAddSibling={handlers.addSibling}
            onRename={handlers.rename}
            onInlineRename={handleInlineRename}
            onDuplicate={handlers.duplicateNode}
            onDelete={handlers.deleteNode}
            onMove={handlers.moveNode}
          />
          <PBSStats nodes={nodes} />
        </div>
        <div
          role="separator"
          aria-label="Resize tree panel"
          onMouseDown={handleResizeStart}
          className="w-1 flex-shrink-0 cursor-col-resize bg-gray-100 dark:bg-gray-700 hover:bg-blue-300 dark:hover:bg-blue-600 transition-colors"
        />
        <div
          ref={reqsResizeContainerRef}
          className="flex-1 min-w-0 flex flex-col rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
        >
          {nodes.length === 0 ? (
            // Empty state (e.g. user deleted all nodes) — restore project root — aligned with Functions
            <div className="flex-1 flex items-center justify-center bg-gray-50/50 dark:bg-gray-900/30 overflow-y-auto">
              <div className="text-center max-w-md px-6">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-4">
                  <Box size={28} className="text-blue-400 dark:text-blue-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Product structure is empty
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
                  Add the project root to get started. Children will appear under it.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const root = createProjectRootNode(projectDisplayName)
                    setNodes([root])
                    setChangeLog([
                      {
                        id: crypto.randomUUID?.() ?? `cl-${Date.now()}`,
                        nodeId: root.id,
                        action: 'created',
                        timestamp: nowISO(),
                        details: 'Project root created',
                      },
                    ])
                    markUnsaved()
                    setSelectedId(root.id)
                  }}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 mx-auto transition-colors text-sm font-medium"
                >
                  <Plus size={15} />
                  Add project root ({projectDisplayName})
                </button>
              </div>
            </div>
          ) : !selectedNode ? (
            // No selection state — aligned with Functions
            <div className="flex-1 flex items-center justify-center bg-gray-50/50 dark:bg-gray-900/30">
              <div className="text-center max-w-md px-6">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-4">
                  <Box size={28} className="text-blue-400 dark:text-blue-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Select a Component
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
                  Select a component in the tree on the left to view or edit its details, or use the sidebar to add new components and build your product structure.
                </p>
                <div className="grid grid-cols-2 gap-3 mt-6">
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 text-left">
                    <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Components</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.total}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 text-left">
                    <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Root Components</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.rootCount}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 text-left">
                    <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hierarchy Depth</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.maxDepth || 1}</p>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 text-left">
                    <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Selected</p>
                    <p className="text-2xl font-bold text-gray-500 dark:text-gray-400 mt-1">—</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <PBSNodeEditor
              node={selectedNode}
              allNodes={nodes}
              changeLog={changeLog}
              onUpdate={handlers.updateNode}
              pbsCodeEditable={false}
              projectId={projectId}
            />
          )}
        </div>
        {isRequirementsPanelOpen && projectId && (
          <>
            <div
              role="separator"
              aria-label="Resize requirements panel"
              onMouseDown={handleReqsResizeStart}
              className="w-1 flex-shrink-0 cursor-col-resize bg-gray-100 dark:bg-gray-700 hover:bg-blue-300 dark:hover:bg-blue-600 transition-colors"
            />
            <div
              className="shrink-0 flex flex-col bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
              style={{ width: requirementsPanelWidth }}
            >
              <div className="flex border-b border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setRightPanelTab('requirements')}
                  className={clsx(
                    'flex-1 px-4 py-2 text-sm font-medium transition-colors',
                    rightPanelTab === 'requirements'
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-b-2 border-blue-500'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  )}
                >
                  Requirements
                </button>
                <button
                  type="button"
                  onClick={() => setRightPanelTab('functions')}
                  className={clsx(
                    'flex-1 px-4 py-2 text-sm font-medium transition-colors',
                    rightPanelTab === 'functions'
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-b-2 border-indigo-500'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  )}
                >
                  Functions
                </button>
              </div>
              {rightPanelTab === 'requirements' ? (
                <RequirementsPBSTree
                  projectId={projectId}
                  requirements={requirements}
                  selectedComponentId={selectedComponentIdForReqs}
                  onComponentSelect={(id) => {
                    setSelectedComponentIdForReqs(id)
                    if (id) setSelectedId(id)
                  }}
                  links={LINKAGE_V1 ? links : []}
                  onLinkedElementClick={handleLinkedElementClick}
                  onRequirementClick={(req) => navigate(`/projects/${projectId}/requirements?requirementId=${req.id}`)}
                />
              ) : (
                <FunctionsPBSTree
                  projectId={projectId}
                  functions={functions}
                  selectedComponentId={selectedComponentIdForReqs}
                  onComponentSelect={(id) => {
                    setSelectedComponentIdForReqs(id)
                    if (id) setSelectedId(id)
                  }}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* Rename Modal */}
      <RenameModal
        isOpen={!!renameNode}
        currentName={renameNode?.name ?? ''}
        onSave={handleRenameSave}
        onCancel={handleRenameCancel}
      />

      {/* Import Modal */}
      <ImportModal
        isOpen={importModalOpen}
        currentNodeCount={nodes.length}
        onImport={handleImport}
        onCancel={() => setImportModalOpen(false)}
      />

      {/* Print View */}
      <PBSPrintView
        isOpen={printViewOpen}
        nodes={nodes}
        changeLog={changeLog}
        projectName={projectDisplayName}
        onClose={() => setPrintViewOpen(false)}
      />
    </div>
  )
}
