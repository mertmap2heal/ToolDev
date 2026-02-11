import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import ProjectNavigation from '../../components/projects/ProjectNavigation'
import { projectService } from '../../services/project.service'
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

const SAVE_DEBOUNCE_MS = 600

export default function PBSPage() {
  const params = useParams()
  const [searchParams] = useSearchParams()
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
      localStorage.setItem(PANEL_WIDTH_KEY, String(leftPanelWidth))
    } catch {
      // ignore
    }
  }, [leftPanelWidth, PANEL_WIDTH_KEY])

  const resizeContainerRef = useRef<HTMLDivElement>(null)
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

  const { data: projectData, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) return null
      const response = await projectService.getProject(projectId)
      return response.success && response.data ? response.data : null
    },
    enabled: !!projectId,
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
      .then(() => setSaveStatus('saved'))
      .catch(() => setSaveStatus('unsaved'))
  }, [projectId, nodes, changeLog])

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

  useEffect(() => {
    if (saveStatus === 'unsaved') {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(() => {
        persist()
        saveTimeoutRef.current = null
      }, SAVE_DEBOUNCE_MS)
    }
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [nodes, changeLog, saveStatus, persist])

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

  return (
    <div className="space-y-6">
      <ProjectNavigation />
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Product Breakdown Structure
        </h2>
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className={clsx(
              'text-sm flex items-center gap-1.5',
              saveStatus === 'saved' && 'text-gray-500 dark:text-gray-400',
              saveStatus === 'saving' && 'text-amber-600 dark:text-amber-400',
              saveStatus === 'unsaved' && 'text-amber-600 dark:text-amber-400'
            )}
          >
            {saveStatus === 'saved' && <Check size={14} />}
            {saveStatus === 'saving' && <Loader2 size={14} className="animate-spin" />}
            {saveStatus === 'unsaved' && <AlertCircle size={14} />}
            {saveStatus === 'saved' && 'Saved'}
            {saveStatus === 'saving' && 'Saving…'}
            {saveStatus === 'unsaved' && 'Unsaved changes'}
          </span>
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
            onClick={exportCSV}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Download size={16} />
            Export CSV
          </button>
          <button
            type="button"
            onClick={exportJSON}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Download size={16} />
            Export JSON
          </button>
          <button
            type="button"
            onClick={() => setImportModalOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Upload size={16} />
            Import
          </button>
          <button
            type="button"
            onClick={() => setPrintViewOpen(true)}
            disabled={nodes.length === 0}
            className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer size={16} />
            Print
          </button>
        </div>
      </div>

      {duplicateNameWarning && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm">
          <AlertCircle size={16} />
          Duplicate sibling name — consider renaming for clarity.
        </div>
      )}

      {/* Validation Warnings */}
      <PBSValidation nodes={nodes} onSelectNode={setSelectedId} />

      {storageQuotaWarning && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm">
          <AlertCircle size={16} />
          {storageQuotaWarning}
        </div>
      )}

      <div
        ref={resizeContainerRef}
        className="flex min-h-[500px] gap-0"
        style={{ height: 'calc(100vh - 280px)' }}
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
          className="shrink-0 w-2 cursor-col-resize flex items-center justify-center group hover:bg-blue-100 dark:hover:bg-gray-700 transition-colors"
        >
          <div className="w-0.5 h-8 bg-gray-300 dark:bg-gray-600 rounded-full group-hover:bg-blue-500 dark:group-hover:bg-blue-400 transition-colors" />
        </div>
        <div className="flex-1 min-w-0 flex flex-col rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          {nodes.length === 0 ? (
            // Empty state (e.g. user deleted all nodes) — restore project root
            <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
              <FolderTree size={56} className="text-gray-300 dark:text-gray-600 mb-6" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Product structure is empty
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 max-w-md text-center">
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
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                <Plus size={16} />
                Add project root ({projectDisplayName})
              </button>
            </div>
          ) : !selectedNode ? (
            // No selection state
            <div className="flex flex-col items-start justify-center p-8 text-left">
              <FolderTree size={48} className="text-gray-400 dark:text-gray-500 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Select a component
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md">
                Select a component in the tree to view or edit its details, or use the sidebar to add
                new components and build your product structure.
              </p>
            </div>
          ) : (
            <PBSNodeEditor
              node={selectedNode}
              allNodes={nodes}
              changeLog={changeLog}
              onUpdate={handlers.updateNode}
              pbsCodeEditable={false}
            />
          )}
        </div>
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
