import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import ProjectNavigation from '../../components/projects/ProjectNavigation'
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
import { loadPBS, savePBS } from './storage'
import { nowISO } from './utils'
import { getNodePath } from './treeUtils'
import { createPBSHandlers, addChangeLogEntry } from './handlers'
import { PBS_TEMPLATES, generateNodesFromTemplate } from './templates'
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
  const projectId = params.projectId ?? undefined
  const [nodes, setNodes] = useState([] as PBSNode[])
  const [changeLog, setChangeLog] = useState([] as PBSChangeLogEntry[])
  const [selectedId, setSelectedId] = useState(null as string | null)
  const [saveStatus, setSaveStatus] = useState('saved' as SaveStatus)
  const [addDropdownOpen, setAddDropdownOpen] = useState(false)
  const [renameNodeId, setRenameNodeId] = useState(null as string | null)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [printViewOpen, setPrintViewOpen] = useState(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Undo/Redo history
  const [history, setHistory] = useState<{ past: PBSNode[][]; future: PBSNode[][] }>({
    past: [],
    future: [],
  })
  const isUndoRedoRef = useRef(false)
  const lastNodesRef = useRef<string>('')

  const projectKey = projectId ?? 'default'

  useEffect(() => {
    const data = loadPBS(projectId)
    setNodes(data.nodes)
    setChangeLog(data.changeLog)
  }, [projectId])

  const persist = useCallback(() => {
    setSaveStatus('saving')
    savePBS(projectId, { nodes, changeLog })
    setSaveStatus('saved')
  }, [projectId, nodes, changeLog])

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

  const applyTemplate = useCallback(
    (templateId: string) => {
      const templateNodes = generateNodesFromTemplate(templateId)
      if (templateNodes.length === 0) return
      setNodes(templateNodes)
      setChangeLog([
        {
          id: crypto.randomUUID(),
          nodeId: templateNodes[0].id,
          action: 'created',
          timestamp: nowISO(),
          details: `Created from template`,
        },
      ])
      markUnsaved()
      setSelectedId(templateNodes[0].id)
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

      <div className="flex gap-4 min-h-[500px]" style={{ height: 'calc(100vh - 280px)' }}>
        <div className="w-80 shrink-0 flex flex-col gap-2">
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
        <div className="flex-1 min-w-0 flex flex-col rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          {nodes.length === 0 ? (
            // Empty state with templates
            <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
              <FolderTree size={56} className="text-gray-300 dark:text-gray-600 mb-6" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Start your Product Breakdown Structure
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-8 max-w-md text-center">
                Choose a template to get started quickly, or create your first component from scratch.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-3xl mb-8">
                {PBS_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => applyTemplate(template.id)}
                    className="flex flex-col items-start p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-left group"
                  >
                    <span className="text-2xl mb-2">{template.icon}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      {template.name}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {template.description}
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-4">
                <div className="h-px w-16 bg-gray-200 dark:bg-gray-700" />
                <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">or</span>
                <div className="h-px w-16 bg-gray-200 dark:bg-gray-700" />
              </div>

              <button
                type="button"
                onClick={handlers.addRoot}
                className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
              >
                <Plus size={16} />
                Start from scratch
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
        projectName={projectKey}
        onClose={() => setPrintViewOpen(false)}
      />
    </div>
  )
}
