import { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useParams, Link } from 'react-router-dom'
import {
  Search, X, Check, Trash2, Edit2, Plus, Filter, ChevronDown, ChevronUp,
  FileText, Upload, Download, GitBranch, RefreshCw, CheckCircle,
  AlertTriangle, Settings, Radio, List, Share2,
  Folder, FolderOpen, MoreHorizontal, Layers, ArrowUpDown, ArrowUp, ArrowDown,
  LayoutGrid, History,
} from 'lucide-react'
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import SafetyLinkPanel from '../../components/safety/SafetyLinkPanel'
import { parameterService, type ParameterWithUsage } from '../../services/parameter.service'
import { parameterBulkJobService } from '../../services/parameterBulkJob.service'
import { evaluateFormula } from '../../components/parameters/evaluateFormula'
import DeleteConfirmationModal from '../../components/projects/DeleteConfirmationModal'
import EditParameterModal from '../../components/parameters/EditParameterModal'
import ParameterDetailDrawer from '../../components/parameters/ParameterDetailDrawer'
import SourceDetailsModal from '../../components/parameters/SourceDetailsModal'
import CreateParameterModal from '../../components/parameters/CreateParameterModal'
import CreateChangeRequestModal from '../../components/changeRequests/CreateChangeRequestModal'
import PublishToGitModal, {
  type GitPublishStoredConfig,
  clearLegacyGitPublishStorage,
} from '../../components/parameters/PublishToGitModal'
// Reactflow (~350 KB gz) only loads when the Graph tab is active.
const ParameterDependencyGraph = lazy(
  () => import('../../components/parameters/ParameterDependencyGraph'),
)
// Board view is also lazy so the default List tab keeps its bundle lean.
const ParameterBoardView = lazy(
  () => import('../../components/parameters/ParameterBoardView'),
)
import ImportParameterModal from '../../components/parameters/ImportParameterModal'
import CommunicationsTab from './CommunicationsTab'
import ParameterCommandPalette from '../../components/parameters/ParameterCommandPalette'
import ShortcutsOverlay from '../../components/parameters/ShortcutsOverlay'
import ParameterBaselinesPanel from '../../components/parameters/ParameterBaselinesPanel'
import { parameterScenarioService, type Scenario, type ScenarioSummary } from '../../services/parameterScenario.service'
import type { Parameter, ParameterFolder } from 'shared/types/engineering.types'
import clsx from 'clsx'
import { format } from 'date-fns'
import { AiFeatureProvider } from '../../contexts/AiFeatureContext'
import AiFeatureGuard from '../../components/ai/AiFeatureGuard'
import { aiParameterService } from '../../services/aiParameter.service'
import { Sparkles } from 'lucide-react'
import ParameterFilterBar from '../../components/parameters/ParameterFilterBar'
import ParameterRow from './ParameterRow'

// ---------------------------------------------------------------------------
// Preset folder colors
// ---------------------------------------------------------------------------
const FOLDER_COLORS = ['#6366f1', '#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#ec4899']

// ---------------------------------------------------------------------------
// Shared class strings (issue #278 — migration off inline styles).
// Each constant is a drop-in className for a common UI primitive on this page.
// Token mapping table lives in the PR description; see index.css for CSS
// custom-property values.
// ---------------------------------------------------------------------------
const CARD =
  'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg'
const INPUT_CLS =
  'w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500'
const BTN_PRIMARY =
  'inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-500 transition-colors disabled:opacity-50'
const BTN_GHOST =
  'inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors'
const BTN_TOOLBAR =
  'flex items-center gap-1.5 px-2.5 py-[5px] rounded-md text-xs font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed'
const MENU_POPOVER =
  'absolute right-0 z-[200] rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 shadow-lg overflow-hidden'
const BTN_ICON =
  'p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors'
const LABEL_CLS =
  'text-xs font-medium text-gray-700 dark:text-gray-300'
const TEXT_MUTED = 'text-gray-600 dark:text-gray-400'
const TEXT_STRONG = 'text-gray-900 dark:text-gray-100'
const ROW_HOVER = 'hover:bg-gray-200/20 dark:hover:bg-gray-400/10'

// ---------------------------------------------------------------------------
// DraggableRow — wraps a parameter row so it can be dragged onto a folder
// ---------------------------------------------------------------------------
function DraggableRow({
  parameterId,
  folderColor,
  children,
}: {
  parameterId: string
  folderColor?: string | null
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `param-${parameterId}` })
  return (
    <tr
      ref={setNodeRef}
      className={clsx(
        'cursor-grab border-b border-gray-200 dark:border-gray-700',
        ROW_HOVER,
        isDragging && 'opacity-40',
      )}
      // #278: folder colour is user-assigned hex, not a design token.
      // Dynamic border-left stays inline; fixed transparent fallback also
      // inline so the left gutter is always 3px regardless of folder state.
      style={{
        borderLeft: folderColor ? `3px solid ${folderColor}` : '3px solid transparent',
      }}
      {...attributes}
      {...listeners}
    >
      {children}
    </tr>
  )
}

// ---------------------------------------------------------------------------
// DroppableFolder — folder row in sidebar that accepts dragged parameters
// ---------------------------------------------------------------------------
function DroppableFolder({
  folderId,
  isOver,
  children,
}: {
  folderId: string
  isOver: boolean
  children: React.ReactNode
}) {
  const { setNodeRef } = useDroppable({ id: `folder-${folderId}` })
  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'rounded-md transition-[outline] duration-100',
        isOver
          ? 'outline outline-2 -outline-offset-2 outline-blue-600 dark:outline-blue-400'
          : '',
      )}
    >
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SortableFolderWrapper — makes a folder row sortable + droppable for params
// ---------------------------------------------------------------------------
function SortableFolderWrapper({
  folderId,
  isOver,
  children,
}: {
  folderId: string
  isOver: boolean
  children: (dragHandleProps: React.HTMLAttributes<HTMLElement>) => React.ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `sortfolder-${folderId}` })

  // Also make it a drop target for parameters
  const { setNodeRef: setDropRef } = useDroppable({ id: `folder-${folderId}` })

  const setRefs = (el: HTMLDivElement | null) => {
    setNodeRef(el)
    setDropRef(el)
  }

  return (
    <div
      ref={setRefs}
      className={clsx(
        'rounded-md',
        isDragging && 'opacity-50',
        isOver && 'outline outline-2 -outline-offset-2 outline-blue-600 dark:outline-blue-400',
      )}
      // #278: transform + transition are runtime values from @dnd-kit/sortable
      // describing the drag delta and snap animation. Cannot be expressed as
      // Tailwind utilities — must stay inline.
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      {children({ ...attributes, ...listeners })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Export format groups
// ---------------------------------------------------------------------------
const EXPORT_GROUPS = [
  {
    label: 'MATLAB / Simulink',
    formats: [
      { key: 'matlab',   label: 'MATLAB script (.m)' },
      { key: 'mat',      label: 'MATLAB workspace script — creates .mat (.m)' },
      { key: 'simulink', label: 'Simulink Data Dictionary script — creates .sldd (.m)' },
    ],
  },
  {
    label: 'Programming languages',
    formats: [
      { key: 'python',   label: 'Python module (.py)' },
      { key: 'c_header', label: 'C/C++ header (.h)' },
      { key: 'ada',      label: 'Ada package spec (.ads)' },
    ],
  },
  {
    label: 'Aerospace / embedded',
    formats: [
      { key: 'xtce',     label: 'XTCE — NASA COSMOS / OpenMCT (.xtce)' },
      { key: 'autosar',  label: 'AUTOSAR (.arxml)' },
      { key: 'ros',      label: 'ROS / ROS2 params (.yaml)' },
      { key: 'dds',      label: 'DDS / RTPS IDL (.idl)' },
    ],
  },
  {
    label: 'Data interchange',
    formats: [
      { key: 'json',  label: 'JSON (.json)' },
      { key: 'yaml',  label: 'YAML (.yaml)' },
      { key: 'csv',   label: 'CSV (.csv)' },
      { key: 'xml',   label: 'XML (.xml)' },
      { key: 'reqif', label: 'ReqIF 1.2 (.reqif)' },
    ],
  },
  {
    label: 'Reports',
    formats: [
      { key: 'excel', label: 'Excel workbook (.xlsx)' },
      { key: 'pdf',   label: 'PDF report (.pdf)' },
    ],
  },
]

const FORMAT_EXTENSIONS: Record<string, string> = {
  matlab: 'parameters.m', simulink: 'create_parameters_sldd.m', mat: 'create_parameters_mat.m',
  python: 'parameters.py', c_header: 'parameters.h', ada: 'parameters.ads',
  xtce: 'parameters.xtce', autosar: 'parameters.arxml', ros: 'parameters_ros.yaml',
  dds: 'parameters.idl', json: 'parameters.json', yaml: 'parameters.yaml',
  csv: 'parameters.csv', xml: 'parameters.xml',
  reqif: 'parameters.reqif',
  excel: 'parameters.xlsx', pdf: 'parameters.pdf',
}

const IMPORT_FORMATS = [
  { key: 'csv',      label: 'CSV (.csv)' },
  { key: 'json',     label: 'JSON (.json)' },
  { key: 'c_header', label: 'C/C++ header (.h)' },
  { key: 'matlab',   label: 'MATLAB script (.m)' },
  { key: 'reqif',    label: 'ReqIF 1.2 (.reqif)' },
]

// ---------------------------------------------------------------------------
// Helper: trigger browser download from blob
// ---------------------------------------------------------------------------
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function ParametersPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchQuery, setSearchQuery] = useState('')
  // Debounced search — 300 ms delay before filtering
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(value), 300)
  }

  // Ctrl+F / Cmd+F focuses search and prevents browser find dialog
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        if (searchInputRef.current) {
          e.preventDefault()
          searchInputRef.current.focus()
          searchInputRef.current.select()
        }
      }
      // Cmd/Ctrl + / opens the parameter command palette. Cmd+K is the
      // global app palette and Cmd+Shift+P is reserved by Firefox for
      // Private Window. Cmd+/ is free in every major browser and matches
      // GitHub/Slack/Linear shortcut conventions.
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        const target = e.target as HTMLElement | null
        const tag = target?.tagName
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !target?.isContentEditable) {
          e.preventDefault()
          setIsPaletteOpen((v) => !v)
        }
      }
      // ? alone opens the keyboard cheatsheet. Block when an input is
      // focused so typing "?" into a field doesn't pop the overlay.
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement | null
        const tag = target?.tagName
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !target?.isContentEditable) {
          e.preventDefault()
          setIsShortcutsOpen((v) => !v)
        }
      }
      // Ctrl/Cmd + 1/2/3 switches view modes (List/Board/Graph).
      if ((e.ctrlKey || e.metaKey) && (e.key === '1' || e.key === '2' || e.key === '3')) {
        const target = e.target as HTMLElement | null
        const tag = target?.tagName
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !target?.isContentEditable) {
          e.preventDefault()
          setParamViewMode(e.key === '1' ? 'list' : e.key === '2' ? 'board' : 'graph')
        }
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  // Table sort state — sort and order are passed to the backend query
  const [sortField, setSortField] = useState<'name' | 'createdAt' | 'updatedAt'>('updatedAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const handleSortBy = (field: 'name' | 'createdAt' | 'updatedAt') => {
    if (sortField === field) {
      setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  // Inline value editing state
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null)
  const [inlineEditValue, setInlineEditValue] = useState('')

  // Git pull state
  const [isPulling, setIsPulling] = useState(false)
  const [pullResult, setPullResult] = useState<{ imported: number; updated: number; errors: string[]; warnings: string[] } | null>(null)

  const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string; name: string } | null>(null)
  const [editingParameter, setEditingParameter] = useState<Parameter | null>(null)
  const [detailParameter, setDetailParameter] = useState<Parameter | null>(null)
  const [viewingSource, setViewingSource] = useState<Parameter | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [aiDrafting, setAiDrafting] = useState(false)
  const [isPaletteOpen, setIsPaletteOpen] = useState(false)
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false)
  const [isBaselinesOpen, setIsBaselinesOpen] = useState(false)
  // Active what-if scenario. When non-null, the row default-value cell
  // is overlaid by the scenario's override for that parameter (UI only —
  // the underlying row stays untouched).
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'parameters' | 'communications'>('parameters')
  const [changeRequestModal, setChangeRequestModal] = useState<{ isOpen: boolean; sourceId: string; sourceName: string } | null>(null)
  const [dataTypeFilter, setDataTypeFilter] = useState<string>('all')
  const [unitFilter, setUnitFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  // Built-in saved view: when on, filter to parameters touched by AI
  // (authorType ∈ ai_suggestion | ai_accepted | ai_applied). Server-side
  // via the authorType=CSV query param.
  const [aiModifiedView, setAiModifiedView] = useState<boolean>(false)
  const [paramViewMode, setParamViewMode] = useState<'list' | 'board' | 'graph'>('list')
  const queryClient = useQueryClient()

  // Folder sidebar state
  // null = All Parameters; '__none__' = Ungrouped; <id> = specific folder
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [isFolderSidebarOpen, setIsFolderSidebarOpen] = useState(true)
  const [createFolderName, setCreateFolderName] = useState('')
  const [createFolderColor, setCreateFolderColor] = useState(FOLDER_COLORS[0])
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [folderMenuOpen, setFolderMenuOpen] = useState<string | null>(null)
  const [renamingFolder, setRenamingFolder] = useState<{ id: string; name: string } | null>(null)
  const [renamingColor, setRenamingColor] = useState<string>('#6366f1')
  const [overFolderId, setOverFolderId] = useState<string | null>(null)
  const [activeDragParamId, setActiveDragParamId] = useState<string | null>(null)
  const [activeDragFolderId, setActiveDragFolderId] = useState<string | null>(null)
  // Optimistic folder order per parent level (null = root)
  const [folderOrderByParent, setFolderOrderByParent] = useState<Map<string | null, string[]>>(new Map())
  // Subfolder confirmation prompt: { childId, parentId }
  const [pendingSubfolder, setPendingSubfolder] = useState<{ childId: string; parentId: string } | null>(null)
  // Which parent folders have their sub-folders expanded in the sidebar
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set())
  // Which folder is getting a new sub-folder created inline
  const [creatingSubFolderIn, setCreatingSubFolderIn] = useState<string | null>(null)
  const [subFolderName, setSubFolderName] = useState('')
  const [subFolderColor, setSubFolderColor] = useState(FOLDER_COLORS[0])
  // Nest-intent detection: track when a folder is held over another for >600ms
  const nestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [nestTargetId, setNestTargetId] = useState<string | null>(null)
  const folderMenuRef = useRef<HTMLDivElement>(null)

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  // Column visibility — persisted in localStorage per project
  const COL_STORAGE_KEY = projectId ? `param-cols-${projectId}` : null
  type ColKey = 'description' | 'type' | 'value' | 'computed' | 'unit' | 'folder' | 'source' | 'status' | 'usedIn' | 'created'
  const ALL_COLS: { key: ColKey; label: string }[] = [
    { key: 'description', label: 'Description' },
    { key: 'type',        label: 'Type' },
    { key: 'value',       label: 'Value' },
    { key: 'computed',    label: 'Computed' },
    { key: 'unit',        label: 'Unit' },
    { key: 'folder',      label: 'Folder' },
    { key: 'source',      label: 'Source' },
    { key: 'status',      label: 'Status' },
    { key: 'usedIn',      label: 'Used in' },
    { key: 'created',     label: 'Created' },
  ]
  // Folder column is intentionally NOT in defaults — the folder sidebar
  // already shows folder context, and dragging rows onto the sidebar is
  // the primary move-to-folder gesture. Users can re-enable it from the
  // Columns menu when they need bulk per-row folder editing.
  const DEFAULT_COLS: ColKey[] = ['description', 'type', 'value', 'computed', 'unit', 'source', 'status', 'usedIn', 'created']
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(() => {
    if (!COL_STORAGE_KEY) return new Set(DEFAULT_COLS)
    try {
      const stored = localStorage.getItem(COL_STORAGE_KEY)
      if (stored) return new Set(JSON.parse(stored) as ColKey[])
    } catch { /* ignore */ }
    return new Set(DEFAULT_COLS)
  })
  const [isColMenuOpen, setIsColMenuOpen] = useState(false)
  const colMenuRef = useRef<HTMLDivElement>(null)
  const toggleCol = (key: ColKey) => {
    setVisibleCols(prev => {
      const next = new Set(prev)
      if (next.has(key)) { if (next.size > 1) next.delete(key) } // keep at least 1
      else next.add(key)
      if (COL_STORAGE_KEY) localStorage.setItem(COL_STORAGE_KEY, JSON.stringify([...next]))
      return next
    })
  }

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  // Live progress for an in-flight async bulk job (delete > 50 items).
  // null when no job is running.
  const [bulkJobProgress, setBulkJobProgress] = useState<{
    done: number
    failed: number
    total: number
    status: 'pending' | 'running' | 'completed' | 'failed' | 'partial'
  } | null>(null)

  // Export state
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [exportingFormat, setExportingFormat] = useState<string | null>(null)
  const exportRef = useRef<HTMLDivElement>(null)

  // Import state
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [importFormat, setImportFormat] = useState<string>('')
  const [importContent, setImportContent] = useState('')
  const [importFilename, setImportFilename] = useState('')
  const [importResult, setImportResult] = useState<{ imported: number; updated: number; errors: string[]; warnings: string[] } | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  // CSV import modal state
  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false)

  // Collapsed folder groups in table (set of folder IDs; '__none__' = ungrouped)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId); else next.add(groupId)
      return next
    })
  }

  // Git publish state
  const gitPublishKey = projectId ? `git-publish-config-${projectId}` : null
  const [storedGitConfig, setStoredGitConfig] = useState<GitPublishStoredConfig | null>(null)
  const [isPublishOpen, setIsPublishOpen] = useState(false)
  const [isBannerSyncing, setIsBannerSyncing] = useState(false)

  // Load persisted Git publish config.
  // #272: token is no longer persisted; if the stored object still has one
  // (legacy data written before the fix) it's scrubbed before first use.
  useEffect(() => {
    if (!gitPublishKey) return
    try {
      clearLegacyGitPublishStorage(gitPublishKey)
      const stored = localStorage.getItem(gitPublishKey)
      if (stored) setStoredGitConfig(JSON.parse(stored))
    } catch { /* ignore */ }
  }, [gitPublishKey])

  // #272: banner-sync used to pull the token from localStorage and push
  // silently. Post-fix we cannot do that — open the modal instead so the
  // user re-enters the token and we only keep it in-memory.
  const handleBannerSync = async () => {
    if (!projectId || !storedGitConfig || isBannerSyncing) return
    setIsPublishOpen(true)
    return
  }

  // Close export dropdown and column menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setIsExportOpen(false)
      }
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) {
        setIsColMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Phase 2-finish: server-paged infinite query. Backend returns
  // { data, total, page, pageSize } per page; the frontend flattens
  // pages into one continuous array the virtualiser iterates. Filter
  // inputs (q / status / dataType / unit / hasFormula) belong in the
  // query key so any change invalidates + refetches page 1. The current
  // multi-value client filters (sourceFilter, tagFilter, etc.) stay on
  // the client for now and apply to the flattened result.
  const PAGE_SIZE = 200
  const trimmedQ = debouncedSearch.trim()

  // Folders are fetched first so the parameters paged query below can
  // use them to expand a selected folder into its subtree before the
  // server round-trip.
  const { data: foldersData } = useQuery({
    queryKey: ['parameter-folders', projectId],
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID required')
      const response = await parameterService.getFolders(projectId)
      if (response.success && response.data) return response.data
      throw new Error(response.error || 'Failed to load folders')
    },
    enabled: !!projectId,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })
  // Stable reference so dependent useMemo / useEffect deps don't
  // re-fire on every render with foldersData unchanged.
  const folders: ParameterFolder[] = useMemo(() => foldersData ?? [], [foldersData])
  const foldersById = useMemo(
    () => new Map<string, ParameterFolder>(folders.map((f) => [f.id, f])),
    [folders],
  )

  // Unfiltered project total — used for the sidebar "All Parameters"
  // count + the Ungrouped subtraction. Stays stable while a folder
  // filter narrows the paged parameters query below.
  const { data: facetsData } = useQuery({
    queryKey: ['parameter-facets', projectId],
    queryFn: async () => {
      if (!projectId) return null
      const response = await parameterService.getFacets(projectId)
      if (response.success && response.data) return response.data
      return null
    },
    enabled: !!projectId,
    staleTime: 30_000,
  })
  const projectTotalParameters = facetsData?.total ?? 0

  // Scenario list (for the toolbar dropdown).
  const { data: scenarios = [] } = useQuery({
    queryKey: ['parameter-scenarios', projectId],
    queryFn: async () => {
      if (!projectId) return [] as ScenarioSummary[]
      const res = await parameterScenarioService.list(projectId)
      return res.success && res.data ? res.data : []
    },
    enabled: !!projectId,
    staleTime: 30_000,
  })

  // Active scenario detail (override map) — fetched only while one is
  // selected, so the toolbar dropdown stays cheap.
  const { data: activeScenario } = useQuery({
    queryKey: ['parameter-scenario', projectId, activeScenarioId],
    queryFn: async () => {
      if (!projectId || !activeScenarioId) return null
      const res = await parameterScenarioService.get(projectId, activeScenarioId)
      return res.success && res.data ? (res.data as Scenario) : null
    },
    enabled: !!projectId && !!activeScenarioId,
    staleTime: 10_000,
  })

  // parameterId -> override value, derived once per scenario change.
  const scenarioOverrides = useMemo(() => {
    const map = new Map<string, string>()
    for (const o of activeScenario?.overrides ?? []) {
      map.set(o.parameterId, o.value)
    }
    return map
  }, [activeScenario])

  // Compute the folder filter to send to the server. The selectedFolderId
  // is the user's pick; we expand to its subtree (so a top-level folder
  // returns everything inside it including sub-folders). `__none__`
  // forwards verbatim — the controller turns it into `folderId = null`.
  const serverFolderId = (() => {
    if (!selectedFolderId) return undefined
    if (selectedFolderId === '__none__') return '__none__'
    const ids: string[] = []
    const queue = [selectedFolderId]
    while (queue.length > 0) {
      const id = queue.shift()!
      ids.push(id)
      for (const f of folders) if (f.parentId === id) queue.push(f.id)
    }
    return ids.join(',')
  })()
  const serverQuery = {
    q: trimmedQ || undefined,
    // Only single-value filters go to the server (keeps compatible with
    // the existing backend controller that accepts one value per param).
    // Multi-value selects still filter on the client over the paged set.
    status: statusFilter !== 'all' ? statusFilter : undefined,
    dataType:
      dataTypeFilter !== 'all' && dataTypeFilter !== 'unassigned' ? dataTypeFilter : undefined,
    unit: unitFilter !== 'all' && unitFilter !== 'unassigned' ? unitFilter : undefined,
    folderId: serverFolderId,
    // Built-in "AI-modified recently" view — set authorType to the AI
    // subset. Server's parameter.controller already accepts a CSV.
    authorType: aiModifiedView ? 'ai_suggestion,ai_accepted,ai_applied' : undefined,
  }
  const {
    data: paramPages,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ['parameters', projectId, sortField, sortOrder, serverQuery],
    queryFn: async ({ pageParam }: { pageParam: number }) => {
      if (!projectId) throw new Error('Project ID required')
      const response = await parameterService.getParametersPage(projectId, {
        page: pageParam,
        pageSize: PAGE_SIZE,
        sort: sortField,
        order: sortOrder,
        includeUsageCounts: true,
        ...serverQuery,
      })
      if (response.success && response.data) return response.data
      throw new Error(response.error || 'Failed to load parameters')
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((n, p) => n + p.data.length, 0)
      return loaded < lastPage.total ? pages.length + 1 : undefined
    },
    enabled: !!projectId,
    staleTime: 30_000,
  })
  // Flatten + dedupe by id. Page boundaries in the backend can
  // theoretically serve the same row on two pages if a write races
  // between page fetches; dedupe makes the UI robust either way.
  const parameters: ParameterWithUsage[] = useMemo(() => {
    const seen = new Set<string>()
    const out: ParameterWithUsage[] = []
    for (const page of paramPages?.pages ?? []) {
      for (const p of page.data) {
        if (!seen.has(p.id)) {
          seen.add(p.id)
          out.push(p)
        }
      }
    }
    return out
  }, [paramPages])
  const totalParameters = paramPages?.pages[0]?.total ?? parameters.length

  // Folder mutations (the fetch + foldersById are now hoisted earlier so
  // the parameters paged query can expand a selected folder into its
  // subtree before round-tripping the server).
  const createFolderMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!projectId) throw new Error('Project ID required')
      const res = await parameterService.createFolder(projectId, { name, color: createFolderColor })
      if (!res.success) throw new Error(res.error ?? 'Failed to create folder')
      return res
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parameter-folders', projectId] })
      setCreateFolderName('')
      setCreateFolderColor(FOLDER_COLORS[0])
      setIsCreatingFolder(false)
    },
    onError: (err: Error) => {
      setToastMessage(`Error: ${err.message}`)
    },
  })

  const createSubFolderMutation = useMutation({
    mutationFn: async ({ name, parentId, color }: { name: string; parentId: string; color: string }) => {
      if (!projectId) throw new Error('Project ID required')
      const res = await parameterService.createFolder(projectId, { name, color, parentId })
      if (!res.success) throw new Error(res.error ?? 'Failed to create sub-folder')
      return res
    },
    onSuccess: (_data, { parentId }) => {
      queryClient.invalidateQueries({ queryKey: ['parameter-folders', projectId] })
      setCreatingSubFolderIn(null)
      setSubFolderName('')
      setSubFolderColor(FOLDER_COLORS[0])
      // Auto-expand the parent to show the new sub-folder
      setExpandedParents(prev => new Set([...prev, parentId]))
    },
    onError: (err: Error) => {
      setToastMessage(`Error: ${err.message}`)
    },
  })

  const updateFolderMutation = useMutation({
    mutationFn: async ({ folderId, data }: { folderId: string; data: { name?: string; color?: string | null; parentId?: string | null } }) => {
      if (!projectId) throw new Error('Project ID required')
      const res = await parameterService.updateFolder(projectId, folderId, data)
      if (!res.success) throw new Error(res.error ?? 'Failed to update folder')
      return res
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parameter-folders', projectId] })
      setRenamingFolder(null)
    },
    onError: (err: Error) => {
      setToastMessage(`Error: ${err.message}`)
    },
  })

  const deleteFolderMutation = useMutation({
    mutationFn: async (folderId: string) => {
      if (!projectId) throw new Error('Project ID required')
      const res = await parameterService.deleteFolder(projectId, folderId)
      if (!res.success) throw new Error(res.error ?? 'Failed to delete folder')
      return { folderId }
    },
    onSuccess: (_data, folderId) => {
      queryClient.invalidateQueries({ queryKey: ['parameter-folders', projectId] })
      queryClient.invalidateQueries({ queryKey: ['parameters', projectId] })
      if (selectedFolderId === folderId) setSelectedFolderId(null)
    },
    onError: (err: Error) => {
      setToastMessage(`Error: ${err.message}`)
    },
  })

  const moveToFolderMutation = useMutation({
    mutationFn: ({ parameterId, folderId }: { parameterId: string; folderId: string | null }) => {
      if (!projectId) throw new Error('Project ID required')
      return parameterService.moveParameterToFolder(projectId, parameterId, folderId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parameters', projectId] })
      queryClient.invalidateQueries({ queryKey: ['parameter-folders', projectId] })
    },
  })

  const reorderFolderMutation = useMutation({
    mutationFn: async (items: Array<{ id: string; order: number }>) => {
      if (!projectId) throw new Error('Project ID required')
      const res = await parameterService.reorderFolders(projectId, items)
      if (!res.success) throw new Error(res.error ?? 'Failed to reorder folders')
      return res
    },
    onError: (err: Error) => {
      setToastMessage(`Error: ${err.message}`)
      // Revert optimistic order on error
      queryClient.invalidateQueries({ queryKey: ['parameter-folders', projectId] })
    },
  })

  const makeFolderChildMutation = useMutation({
    mutationFn: async ({ childId, parentId }: { childId: string; parentId: string }) => {
      if (!projectId) throw new Error('Project ID required')
      const res = await parameterService.updateFolder(projectId, childId, { parentId })
      if (!res.success) throw new Error(res.error ?? 'Failed to move folder')
      return res
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parameter-folders', projectId] })
    },
    onError: (err: Error) => {
      setToastMessage(`Error: ${err.message}`)
    },
  })

  // Sync folderOrderByParent from server data (all levels)
  useEffect(() => {
    if (!foldersData) return
    const grouped = new Map<string | null, typeof foldersData>()
    for (const f of foldersData) {
      const key = f.parentId ?? null
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(f)
    }
    const map = new Map<string | null, string[]>()
    for (const [key, children] of grouped.entries()) {
      children.sort((a, b) => a.order - b.order)
      map.set(key, children.map(f => f.id))
    }
    setFolderOrderByParent(map)
  }, [foldersData])

  // Close folder context menu on outside click
  useEffect(() => {
    if (!folderMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (folderMenuRef.current && !folderMenuRef.current.contains(e.target as Node)) {
        setFolderMenuOpen(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [folderMenuOpen])

  // DnD handlers
  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id)
    if (id.startsWith('param-')) {
      setActiveDragParamId(id.replace('param-', ''))
      setActiveDragFolderId(null)
    } else if (id.startsWith('sortfolder-')) {
      setActiveDragFolderId(id.replace('sortfolder-', ''))
      setActiveDragParamId(null)
    }
    // Clear any pending nest target when a new drag starts
    if (nestTimerRef.current) clearTimeout(nestTimerRef.current)
    setNestTargetId(null)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const overId = event.over ? String(event.over.id) : null

    if (activeDragParamId) {
      // Param drag: track which folder we're hovering over. Same dual-id
      // quirk as handleDragEnd -- a folder row registers both `folder-`
      // and `sortfolder-` droppables, so the hover can resolve to either.
      let folderId: string | null = null
      if (overId) {
        if (overId === 'folder-ungrouped') folderId = 'ungrouped'
        else if (overId.startsWith('folder-')) folderId = overId.replace('folder-', '')
        else if (overId.startsWith('sortfolder-')) folderId = overId.replace('sortfolder-', '')
      }
      setOverFolderId(folderId)
      return
    }

    if (activeDragFolderId) {
      // Folder drag: detect nest intent when hovering over another folder for >600ms
      const targetId = overId?.startsWith('sortfolder-') ? overId.replace('sortfolder-', '') : null
      if (targetId && targetId !== activeDragFolderId) {
        setOverFolderId(targetId)
        // Reset timer if target changed
        if (nestTimerRef.current) clearTimeout(nestTimerRef.current)
        nestTimerRef.current = setTimeout(() => {
          setNestTargetId(targetId)
        }, 650)
      } else {
        setOverFolderId(null)
        if (nestTimerRef.current) clearTimeout(nestTimerRef.current)
        setNestTargetId(null)
      }
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    // Clear nest timer
    if (nestTimerRef.current) clearTimeout(nestTimerRef.current)

    if (activeDragFolderId) {
      const activeFolder = activeDragFolderId
      setActiveDragFolderId(null)
      setOverFolderId(null)

      if (!over) { setNestTargetId(null); return }

      // If nest intent was triggered (held over another folder), show subfolder confirm
      if (nestTargetId && nestTargetId !== activeFolder) {
        setPendingSubfolder({ childId: activeFolder, parentId: nestTargetId })
        setNestTargetId(null)
        return
      }
      setNestTargetId(null)

      // Otherwise it's a reorder within the same level
      const overId = String(over.id)
      const targetId = overId.startsWith('sortfolder-') ? overId.replace('sortfolder-', '') : null
      if (!targetId || targetId === activeFolder) return

      // Find which parent level this folder belongs to
      const activeFolderData = foldersById.get(activeFolder)
      const parentId = activeFolderData?.parentId ?? null
      const levelOrder = folderOrderByParent.get(parentId) ?? []

      const oldIdx = levelOrder.indexOf(activeFolder)
      const newIdx = levelOrder.indexOf(targetId)
      if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return

      const newOrder = arrayMove(levelOrder, oldIdx, newIdx)
      setFolderOrderByParent(prev => {
        const next = new Map(prev)
        next.set(parentId, newOrder)
        return next
      })
      reorderFolderMutation.mutate(newOrder.map((id, idx) => ({ id, order: idx })))
      return
    }

    setActiveDragParamId(null)
    setOverFolderId(null)
    setNestTargetId(null)
    if (!over) return

    const paramId = String(active.id).replace('param-', '')
    const overId = String(over.id)

    // Each folder row in the sidebar registers TWO droppable ids on the
    // same DOM element: `folder-<id>` (from useDroppable, for parameter
    // drops) and `sortfolder-<id>` (from useSortable, for folder
    // reorder). dnd-kit's collision detection picks whichever sits
    // topmost in the stack, which can be either depending on render
    // order. When a parameter is the active drag, both prefixes mean
    // "drop into this folder" -- normalise and dispatch.
    let targetFolderId: string | null | undefined = undefined
    if (overId === 'folder-ungrouped') {
      targetFolderId = null
    } else if (overId.startsWith('folder-')) {
      targetFolderId = overId.replace('folder-', '')
    } else if (overId.startsWith('sortfolder-')) {
      targetFolderId = overId.replace('sortfolder-', '')
    }
    if (targetFolderId !== undefined) {
      // If the dragged row is part of a multi-select, move every selected
      // row in one batch instead of just the row under the cursor.
      const ids = selectedIds.has(paramId) && selectedIds.size > 1
        ? Array.from(selectedIds)
        : [paramId]
      if (ids.length === 1) {
        moveToFolderMutation.mutate({ parameterId: ids[0], folderId: targetFolderId })
      } else {
        Promise.all(
          ids.map(id => parameterService.moveParameterToFolder(projectId!, id, targetFolderId)),
        ).then(() => {
          queryClient.invalidateQueries({ queryKey: ['parameters', projectId] })
          queryClient.invalidateQueries({ queryKey: ['parameter-folders', projectId] })
          const label = targetFolderId
            ? (folderOptions.find(o => o.value === targetFolderId)?.label.trim() ?? 'folder')
            : 'Ungrouped'
          setToastMessage(`Moved ${ids.length} parameters to ${label}`)
          setSelectedIds(new Set())
        })
      }
    }
  }

  const deleteParameterMutation = useMutation({
    mutationFn: (parameterId: string) => {
      if (!projectId) throw new Error('Project ID required')
      return parameterService.deleteParameter(projectId, parameterId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parameters', projectId] })
      setDeleteConfirmation(null)
    },
    onError: (error: any) => {
      console.error('Delete parameter error:', error)
      alert(error?.error || 'Failed to delete parameter')
      setDeleteConfirmation(null)
    },
  })

  // Bulk update mutation (status changes)
  const bulkUpdateMutation = useMutation({
    mutationFn: ({ ids, updates }: { ids: string[]; updates: Record<string, unknown> }) => {
      if (!projectId) throw new Error('Project ID required')
      return parameterService.bulkUpdate(projectId, ids, updates)
    },
    onSuccess: (_data, { ids, updates }) => {
      queryClient.invalidateQueries({ queryKey: ['parameters', projectId] })
      setSelectedIds(new Set())
      const statusLabel = updates.status as string
      setToastMessage(`${ids.length} parameter${ids.length > 1 ? 's' : ''} set to ${statusLabel}`)
    },
    onError: (error: any) => {
      console.error('Bulk update error:', error)
      alert(error?.error || 'Bulk update failed')
    },
  })

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!projectId) throw new Error('Project ID required')
      // Small batches stay synchronous for snappy feedback. Large
      // batches go through the async job runner so the HTTP request
      // returns immediately and the UI polls for progress.
      if (ids.length <= 50) {
        return parameterService.bulkDelete(projectId, ids)
      }
      const submitRes = await parameterBulkJobService.submit(projectId, {
        operation: 'bulk-delete',
        payload: { ids },
      })
      if (!submitRes.success || !submitRes.data) {
        throw new Error(
          (submitRes as { error?: string }).error || 'Bulk job submit failed',
        )
      }
      const jobId = submitRes.data.id
      // Poll every 1s until job leaves the running family (max 5 min).
      for (let i = 0; i < 300; i++) {
        await new Promise((r) => setTimeout(r, 1_000))
        const statusRes = await parameterBulkJobService.get(projectId, jobId)
        if (!statusRes.success || !statusRes.data) continue
        const job = statusRes.data
        setBulkJobProgress({
          done: job.doneItems,
          failed: job.failedItems,
          total: job.totalItems,
          status: job.status,
        })
        if (
          job.status === 'completed' ||
          job.status === 'failed' ||
          job.status === 'partial'
        ) {
          return { success: true, data: job }
        }
      }
      throw new Error('Bulk job timed out — check Recent jobs in admin')
    },
    onSuccess: (_data, ids) => {
      queryClient.invalidateQueries({ queryKey: ['parameters', projectId] })
      setSelectedIds(new Set())
      setBulkDeleteConfirm(false)
      setBulkJobProgress(null)
      setToastMessage(`${ids.length} parameter${ids.length > 1 ? 's' : ''} deleted`)
    },
    onError: (error: any) => {
      console.error('Bulk delete error:', error)
      alert(error?.error || error?.message || 'Bulk delete failed')
      setBulkDeleteConfirm(false)
      setBulkJobProgress(null)
    },
  })

  // Auto-dismiss toast after 3 s
  useEffect(() => {
    if (!toastMessage) return
    const t = setTimeout(() => setToastMessage(null), 3000)
    return () => clearTimeout(t)
  }, [toastMessage])

  // Staleness: consider only tag-filtered parameters (if configured)
  const relevantForStaleness = storedGitConfig?.selectedTags?.length
    ? parameters.filter(p => (p.tags as string[] | null)?.some(t => storedGitConfig.selectedTags!.includes(t)))
    : parameters
  const isStale = storedGitConfig != null && relevantForStaleness.some(
    p => new Date(p.updatedAt) > new Date(storedGitConfig.lastSyncedAt)
  )

  // Collect all folder IDs in the subtree rooted at selectedFolderId
  const folderSubtreeIds = useMemo((): Set<string> | null => {
    if (!selectedFolderId || selectedFolderId === '__none__') return null
    const result = new Set<string>([selectedFolderId])
    // BFS to include sub-folders
    const queue = [selectedFolderId]
    while (queue.length > 0) {
      const parentId = queue.shift()!
      for (const f of folders) {
        if (f.parentId === parentId) {
          result.add(f.id)
          queue.push(f.id)
        }
      }
    }
    return result
  }, [selectedFolderId, folders])

  // Apply folder filter first, then search/column filters
  const folderFilteredParameters =
    selectedFolderId === null
      ? parameters
      : selectedFolderId === '__none__'
        ? parameters.filter(p => !p.folderId)
        : parameters.filter(p => p.folderId && folderSubtreeIds?.has(p.folderId))

  const filteredParameters = folderFilteredParameters.filter((param) => {
    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase()
      const matchesSearch =
        param.name.toLowerCase().includes(query) ||
        param.description?.toLowerCase().includes(query) ||
        param.dataType?.toLowerCase().includes(query) ||
        param.sourceFunction?.name.toLowerCase().includes(query)
      if (!matchesSearch) return false
    }
    if (dataTypeFilter !== 'all') {
      if (dataTypeFilter === 'unassigned' && param.dataType) return false
      if (dataTypeFilter !== 'unassigned' && param.dataType !== dataTypeFilter) return false
    }
    if (unitFilter !== 'all') {
      if (unitFilter === 'unassigned' && param.unit) return false
      if (unitFilter !== 'unassigned' && param.unit !== unitFilter) return false
    }
    if (sourceFilter !== 'all') {
      if (sourceFilter === 'unassigned' && param.sourceFunction) return false
      if (sourceFilter === 'has-source' && !param.sourceFunction) return false
    }
    if (statusFilter !== 'all' && (param.status ?? 'draft') !== statusFilter) return false
    return true
  })

  // Facet-style distinct-value lists for filter pills. Phase 2c will
  // replace these with the /parameters/:id/facets endpoint so they
  // don't depend on the in-memory list.
  const availableDataTypes = useMemo(
    () => Array.from(new Set(parameters.map((p) => p.dataType).filter((v): v is string => !!v))).sort(),
    [parameters],
  )
  const availableUnits = useMemo(
    () => Array.from(new Set(parameters.map((p) => p.unit).filter((v): v is string => !!v))).sort(),
    [parameters],
  )

  // Precompute formula results (memoized) — only for parameters with formulas
  const formulaResults = useMemo(() => {
    const results = new Map<string, string>()
    // Build a param-id -> numeric value map from current parameters
    const paramValueMap: Record<string, number> = {}
    for (const p of parameters) {
      const num = parseFloat(p.defaultValue ?? '')
      if (!isNaN(num)) paramValueMap[p.id] = num
    }
    for (const p of parameters) {
      if (p.formula) {
        try {
          const { result } = evaluateFormula(p.formula, paramValueMap)
          if (result !== null && isFinite(result)) {
            results.set(p.id, String(parseFloat(result.toFixed(6))))
          }
        } catch { /* ignore unevaluable formulas */ }
      }
    }
    return results
  }, [parameters])

  // Inline value save
  const saveInlineValue = async (parameterId: string) => {
    if (!projectId) return
    try {
      await parameterService.updateParameter(projectId, parameterId, { defaultValue: inlineEditValue })
      queryClient.invalidateQueries({ queryKey: ['parameters', projectId] })
    } catch (err) {
      alert(`Save failed: ${(err as Error).message}`)
    }
    setInlineEditingId(null)
    setInlineEditValue('')
  }

  // Git pull handler.
  // #272: token is no longer persisted; open the Publish modal so the user
  // re-enters it. The pull happens only after the user supplies the token
  // in the modal's flow.
  const handleGitPull = async () => {
    if (!projectId || !storedGitConfig || isPulling) return
    setIsPublishOpen(true)
  }

  const handleDeleteClick = useCallback((e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation()
    setDeleteConfirmation({ id, name })
  }, [])

  // Stable per-row handlers so <ParameterRow memo> can skip re-renders
  // when nothing about the row actually changed. These take `param` or
  // an id so they don't need to be re-created per row.
  const handleToggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])
  const handleOpenDetail = useCallback((param: Parameter) => setDetailParameter(param), [])
  const handleStartInlineEdit = useCallback((param: Parameter) => {
    setInlineEditingId(param.id)
    setInlineEditValue(param.defaultValue ?? '')
  }, [])
  const handleInlineEditChange = useCallback((v: string) => setInlineEditValue(v), [])
  const handleCancelInlineEdit = useCallback(() => setInlineEditingId(null), [])
  const handleViewSource = useCallback((param: Parameter) => setViewingSource(param), [])
  const handleOpenChangeRequest = useCallback((param: Parameter) => {
    setChangeRequestModal({ isOpen: true, sourceId: param.id, sourceName: param.name })
  }, [])

  const handleEditClick = useCallback((e: React.MouseEvent, parameter: Parameter) => {
    e.stopPropagation()
    setEditingParameter(parameter)
  }, [])

  const handleSaveInlineEdit = useCallback((parameterId: string) => {
    saveInlineValue(parameterId)
  }, [saveInlineValue])

  const handleMoveToFolderFromRow = useCallback((paramId: string, folderId: string | null) => {
    moveToFolderMutation.mutate({ parameterId: paramId, folderId })
  }, [moveToFolderMutation])

  const handleAiDraft = async () => {
    if (!projectId) return
    const description = window.prompt('Describe the parameter you want the AI to draft:')
    if (!description || !description.trim()) return
    setAiDrafting(true)
    try {
      const res = await aiParameterService.draft(projectId, description.trim())
      if (!res.success || !res.data) {
        alert(res.error || 'AI draft failed')
        return
      }
      const d = res.data.draft
      // v1: alert with the structured draft + open blank create
      // modal. Follow-up PR adds initial-values plumbing so the
      // modal shows the AI draft directly.
      alert(
        'AI draft:\n\n' +
          JSON.stringify(d, null, 2) +
          `\n\nTokens: ${res.data.provenance.tokensIn} in / ${res.data.provenance.tokensOut} out\nModel: ${res.data.provenance.modelVersion}`,
      )
      setIsCreateModalOpen(true)
    } catch (e) {
      alert(`AI draft failed: ${(e as Error).message}`)
    } finally {
      setAiDrafting(false)
    }
  }

  const handleConfirmDelete = () => {
    if (deleteConfirmation) deleteParameterMutation.mutate(deleteConfirmation.id)
  }

  // ---------------------------------------------------------------------------
  // Export handler
  // ---------------------------------------------------------------------------
  const handleExport = async (formatKey: string) => {
    if (!projectId) return
    setExportingFormat(formatKey)
    setIsExportOpen(false)
    try {
      const blob = await parameterService.exportParameters(projectId, formatKey)
      triggerDownload(blob, FORMAT_EXTENSIONS[formatKey] ?? `parameters.${formatKey}`)
    } catch (err) {
      alert(`Export failed: ${(err as Error).message}`)
    } finally {
      setExportingFormat(null)
    }
  }

  // ---------------------------------------------------------------------------
  // Import handler
  // ---------------------------------------------------------------------------
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportFilename(file.name)
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext === 'csv') setImportFormat('csv')
    else if (ext === 'json') setImportFormat('json')
    else if (ext === 'h' || ext === 'hpp') setImportFormat('c_header')
    else if (ext === 'm') setImportFormat('matlab')
    const reader = new FileReader()
    reader.onload = (ev) => setImportContent(ev.target?.result as string ?? '')
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (!projectId || !importContent) return
    setIsImporting(true)
    setImportResult(null)
    try {
      const res = await parameterService.importParameters(projectId, {
        format: importFormat || undefined,
        filename: importFilename || undefined,
        content: importContent,
      })
      if (res.success && res.data) {
        setImportResult(res.data)
        queryClient.invalidateQueries({ queryKey: ['parameters', projectId] })
      } else {
        alert(res.error ?? 'Import failed')
      }
    } catch (err) {
      alert(`Import failed: ${(err as Error).message}`)
    } finally {
      setIsImporting(false)
    }
  }

  const resetImport = () => {
    setImportContent('')
    setImportFilename('')
    setImportFormat('')
    setImportResult(null)
  }

  // ---------------------------------------------------------------------------
  // Subtree parameter counts. Server returns _count.parameters as DIRECT
  // children only; the sidebar shows the rolled-up total so a top-level
  // folder reflects everything inside it. Computed once per folder set
  // change.
  // ---------------------------------------------------------------------------
  const folderSubtreeCounts = useMemo((): Map<string, { direct: number; total: number }> => {
    const childrenOf = new Map<string | null, string[]>()
    for (const f of folders) {
      const p = f.parentId ?? null
      if (!childrenOf.has(p)) childrenOf.set(p, [])
      childrenOf.get(p)!.push(f.id)
    }
    const counts = new Map<string, { direct: number; total: number }>()
    const visit = (id: string): number => {
      const direct = foldersById.get(id)?._count?.parameters ?? 0
      let total = direct
      for (const childId of childrenOf.get(id) ?? []) total += visit(childId)
      counts.set(id, { direct, total })
      return total
    }
    for (const rootId of childrenOf.get(null) ?? []) visit(rootId)
    return counts
  }, [folders, foldersById])

  // ---------------------------------------------------------------------------
  // Build a flat ordered list of folder options for dropdowns (any depth)
  // ---------------------------------------------------------------------------
  // Flattened folder options for dropdowns (bulk-move + per-row folder
  // select). Memoised so the row <select>'s option list stays
  // reference-stable across re-renders -- key for <ParameterRow> memo
  // to skip rows whose data didn't actually change.
  const folderOptions = useMemo((): Array<{ value: string; label: string }> => {
    const result: Array<{ value: string; label: string }> = []
    const visit = (parentId: string | null, depth: number) => {
      const ids = folderOrderByParent.get(parentId) ?? []
      for (const id of ids) {
        const f = foldersById.get(id)
        if (!f) continue
        const prefix = depth === 0 ? '' : '\u00a0\u00a0'.repeat(depth) + '\u2514 '
        result.push({ value: f.id, label: prefix + f.name })
        visit(f.id, depth + 1)
      }
    }
    visit(null, 0)
    return result
  }, [folderOrderByParent, foldersById])
  const buildAllFolderOptions = () => folderOptions

  // Group layout mirrors the sidebar folder tree. Hoisted out of the
  // table JSX into a useMemo so (a) the computation doesn't re-run on
  // every render, and (b) the resulting arrays are stable references
  // ready for a future virtualizer to iterate (phase 2c-iii proper).
  type FlatGroup = {
    id: string
    label: string
    color: string | null
    params: typeof filteredParameters
    depth: number
    /** Server-known total for this group (subtree-aware). Falls back to
     *  params.length when not known. Surfaced in the group header so the
     *  visible count doesn't drop below reality just because pagination
     *  hasn't loaded the next page yet. */
    totalKnown?: number
  }
  const { showGroupsForTable, visibleGroupsForTable } = useMemo(() => {
    const showGroups = selectedFolderId !== '__none__' && folders.length > 0
    const flatGroups: FlatGroup[] = []
    if (showGroups) {
      const walk = (parentId: string | null, depth: number): void => {
        for (const folder of folders.filter((f) => (f.parentId ?? null) === parentId)) {
          const ownParams = filteredParameters.filter((p) => p.folderId === folder.id)
          const subtree = folderSubtreeCounts.get(folder.id)
          flatGroups.push({
            id: folder.id,
            label: folder.name,
            color: folder.color ?? null,
            params: ownParams,
            depth,
            totalKnown: subtree?.direct ?? ownParams.length,
          })
          walk(folder.id, depth + 1)
        }
      }
      if (selectedFolderId === null) {
        const ungrouped = filteredParameters.filter((p) => !p.folderId)
        if (ungrouped.length > 0) flatGroups.push({ id: '__none__', label: 'Ungrouped', color: null, params: ungrouped, depth: 0 })
        walk(null, 0)
      } else {
        const root = foldersById.get(selectedFolderId)
        if (root) {
          // Roll the entire subtree into a single group. Picking a top
          // folder should return everything inside it (including
          // sub-folders) instead of fragmenting the view across
          // sub-folder group headers — pick a sub-folder explicitly to
          // narrow further.
          const allInSubtree = filteredParameters.filter(
            (p) => p.folderId && folderSubtreeIds?.has(p.folderId),
          )
          flatGroups.push({
            id: root.id,
            label: root.name,
            color: root.color ?? null,
            params: allInSubtree,
            depth: 0,
            // Use the rolled-up subtree total so the header stays
            // accurate while the paged query is still loading rows.
            totalKnown:
              folderSubtreeCounts.get(root.id)?.total ?? allInSubtree.length,
          })
        }
      }
    } else {
      flatGroups.push({ id: '__all__', label: '', color: null, params: filteredParameters, depth: 0 })
    }
    // Hide groups below any collapsed ancestor.
    const visibleGroups: FlatGroup[] = []
    let skipBelowDepth: number | null = null
    for (const g of flatGroups) {
      if (skipBelowDepth !== null && g.depth > skipBelowDepth) continue
      skipBelowDepth = null
      visibleGroups.push(g)
      if (collapsedGroups.has(g.id)) skipBelowDepth = g.depth
    }
    return { showGroupsForTable: showGroups, visibleGroupsForTable: visibleGroups }
  }, [selectedFolderId, folders, filteredParameters, foldersById, collapsedGroups, folderSubtreeIds, folderSubtreeCounts])

  // Flat item list the virtualizer iterates over. Mixes group header
  // rows and parameter rows; the render layer branches on `kind`.
  type FlatRowItem =
    | { kind: 'group-header'; group: FlatGroup; isCollapsed: boolean; key: string }
    | { kind: 'data-row'; param: (typeof filteredParameters)[number]; group: FlatGroup; key: string }
  const flatRowItems = useMemo<FlatRowItem[]>(() => {
    const items: FlatRowItem[] = []
    for (const group of visibleGroupsForTable) {
      const isCollapsed = collapsedGroups.has(group.id)
      if (showGroupsForTable) {
        items.push({ kind: 'group-header', group, isCollapsed, key: `group-${group.id}` })
      }
      if (!isCollapsed) {
        for (const param of group.params) {
          items.push({ kind: 'data-row', param, group, key: param.id })
        }
      }
    }
    return items
  }, [visibleGroupsForTable, collapsedGroups, showGroupsForTable])

  // Window virtualizer for the parameters table. Scroll container is
  // the div that wraps <table>; bounded by max-h so only on-screen
  // rows render. Aerospace-scale projects (100k parameters) now only
  // touch ~30-40 DOM <tr>s at any moment instead of 100k.
  const tableScrollRef = useRef<HTMLDivElement>(null)
  // Fixed 36 px row height. Group headers share the same height so the
  // spacer-row math stays exact -- no drift, no blank gaps on fast
  // scroll. (tanstack/virtual #659 #997 #1001: measureElement + dynamic
  // heights + table layout is a known freeze path; we avoid it by
  // locking heights at the DOM level via ROW_FIXED_HEIGHT_PX.)
  const ROW_FIXED_HEIGHT_PX = 36
  const rowVirtualizer = useVirtualizer({
    count: flatRowItems.length,
    getScrollElement: () => tableScrollRef.current,
    estimateSize: () => ROW_FIXED_HEIGHT_PX,
    overscan: 40,
    getItemKey: (index) => flatRowItems[index]?.key ?? index,
  })

  // Infinite-append trigger. When the virtualiser's visible window
  // reaches the end of the loaded pages, fetch the next page. The
  // React Query cache keeps pages under `staleTime`, so scrolling
  // back up stays cheap.
  const virtualItemsForPaging = rowVirtualizer.getVirtualItems()
  useEffect(() => {
    if (virtualItemsForPaging.length === 0) return
    const lastIdx = virtualItemsForPaging[virtualItemsForPaging.length - 1].index
    if (
      lastIdx >= flatRowItems.length - 20 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage()
    }
  }, [virtualItemsForPaging, flatRowItems.length, hasNextPage, isFetchingNextPage, fetchNextPage])

  // ---------------------------------------------------------------------------
  // Recursive folder tree rendering — arbitrary depth, sortable at every level
  // ---------------------------------------------------------------------------
  const renderFolderTree = (parentId: string | null, depth: number): React.ReactNode => {
    const levelIds = folderOrderByParent.get(parentId) ?? []
    if (levelIds.length === 0) return null
    return (
      <SortableContext items={levelIds.map(id => `sortfolder-${id}`)} strategy={verticalListSortingStrategy}>
        {levelIds.map(folderId => {
          const folder = foldersById.get(folderId)
          if (!folder) return null
          const isSelected = selectedFolderId === folder.id
          const isMenuOpen = folderMenuOpen === folder.id
          const isRenaming = renamingFolder?.id === folder.id
          const isNestTarget = nestTargetId === folder.id
          const childIds = folderOrderByParent.get(folder.id) ?? []
          const hasChildren = childIds.length > 0
          const isExpanded = expandedParents.has(folder.id)
          const isCreatingChild = creatingSubFolderIn === folder.id
          const paddingLeft = depth * 18
          return (
            <div key={folder.id}>
              <SortableFolderWrapper folderId={folder.id} isOver={overFolderId === folder.id && !isNestTarget}>
                {(dragHandleProps) => (
                  <div
                    className={clsx(
                      'group flex items-center rounded-[5px] transition-colors',
                      isSelected
                        ? 'bg-gray-200/30 dark:bg-gray-400/15'
                        : isNestTarget
                          ? 'bg-indigo-500/10 outline outline-2 outline-dashed -outline-offset-2 outline-blue-600 dark:outline-blue-400'
                          : 'hover:bg-gray-200/20 dark:hover:bg-gray-400/10',
                    )}
                    style={{ paddingLeft }} // depth-computed indent
                  >
                    {isRenaming ? (
                      <div className="flex-1 flex items-center gap-[3px] p-1">
                        <div className="flex gap-0.5 flex-wrap shrink-0">
                          {FOLDER_COLORS.map(c => (
                            <button key={c} onClick={() => setRenamingColor(c)}
                              className={clsx(
                                'w-[11px] h-[11px] rounded-full cursor-pointer p-0',
                                renamingColor === c ? 'border-2 border-gray-900 dark:border-gray-100' : 'border border-transparent',
                              )}
                              style={{ backgroundColor: c }} // user-chosen hex
                            />
                          ))}
                        </div>
                        <input
                          autoFocus
                          value={renamingFolder?.name ?? ''}
                          onChange={e => setRenamingFolder({ id: folder.id, name: e.target.value })}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && renamingFolder?.name.trim()) {
                              updateFolderMutation.mutate({ folderId: folder.id, data: { name: renamingFolder.name, color: renamingColor } })
                            }
                            if (e.key === 'Escape') setRenamingFolder(null)
                          }}
                          className="flex-1 min-w-0 text-[11px] px-1 py-0.5 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
                        />
                        <button
                          onClick={() => { if (renamingFolder?.name.trim()) updateFolderMutation.mutate({ folderId: folder.id, data: { name: renamingFolder.name, color: renamingColor } }) }}
                          title="Save"
                          className="bg-transparent border-none cursor-pointer text-blue-600 dark:text-blue-400 p-px shrink-0"
                        >
                          <Check size={11} />
                        </button>
                        <button
                          onClick={() => setRenamingFolder(null)}
                          title="Cancel"
                          className="bg-transparent border-none cursor-pointer text-gray-600 dark:text-gray-400 p-px shrink-0"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span
                          {...dragHandleProps}
                          className="cursor-grab pt-1 pr-0.5 pb-1 pl-1 text-gray-600 dark:text-gray-400 opacity-40 flex items-center shrink-0"
                          title="Drag to reorder; hold 650ms over another folder to nest"
                        >
                          ⠿
                        </span>
                        {hasChildren ? (
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              setExpandedParents(prev => {
                                const next = new Set(prev)
                                if (next.has(folder.id)) next.delete(folder.id)
                                else next.add(folder.id)
                                return next
                              })
                            }}
                            title={isExpanded ? 'Collapse' : 'Expand'}
                            className="bg-transparent border-none cursor-pointer p-0.5 text-gray-600 dark:text-gray-400 flex items-center shrink-0"
                          >
                            <ChevronDown size={10} className={clsx('transition-transform', !isExpanded && '-rotate-90')} />
                          </button>
                        ) : (
                          <span className="w-[14px] shrink-0" />
                        )}
                        <button
                          onClick={() => setSelectedFolderId(folder.id)}
                          className={clsx(
                            'flex-1 flex items-center gap-[5px] min-w-0 py-[5px] px-[3px] border-none cursor-pointer text-left bg-transparent text-xs font-medium',
                            isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100',
                          )}
                        >
                          <FolderOpen
                            size={13}
                            className="shrink-0"
                            style={{ color: folder.color ?? '#6366f1' }} // user-chosen folder colour
                          />
                          <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                            {folder.name}
                          </span>
                          {(() => {
                            const c = folderSubtreeCounts.get(folder.id)
                            const total = c?.total ?? folder._count?.parameters ?? 0
                            const direct = c?.direct ?? folder._count?.parameters ?? 0
                            const hasChildren = total !== direct
                            return (
                              <span
                                className="text-[10px] text-gray-600 dark:text-gray-400 shrink-0"
                                title={hasChildren ? `${direct} direct + ${total - direct} in sub-folders` : undefined}
                              >
                                {total}
                              </span>
                            )
                          })()}
                        </button>
                        <div className="relative" ref={folderMenuOpen === folder.id ? folderMenuRef : undefined}>
                          <button
                            onClick={e => { e.stopPropagation(); setFolderMenuOpen(isMenuOpen ? null : folder.id); setRenamingColor(folder.color ?? FOLDER_COLORS[0]) }}
                            aria-label={`Folder actions for ${folder.name}`}
                            title={`Folder actions for ${folder.name}`}
                            className={clsx(
                              'folder-menu-btn bg-transparent border-none cursor-pointer p-1 text-gray-600 dark:text-gray-400 rounded shrink-0 transition-opacity',
                              isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100',
                            )}
                          >
                            <MoreHorizontal size={11} />
                          </button>
                          {isMenuOpen && (
                            <div className="absolute right-0 top-full z-[300] w-[158px] rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 shadow-lg overflow-hidden">
                              <button
                                onClick={() => { setRenamingFolder({ id: folder.id, name: folder.name }); setFolderMenuOpen(null) }}
                                className="w-full flex items-center gap-[7px] px-2.5 py-[7px] text-xs border-none cursor-pointer bg-transparent text-gray-900 dark:text-gray-100 text-left hover:bg-gray-200/20 dark:hover:bg-gray-400/10"
                              >
                                <Edit2 size={11} /> Rename
                              </button>
                              <button
                                onClick={() => {
                                  setCreatingSubFolderIn(folder.id)
                                  setSubFolderName('')
                                  setSubFolderColor(folder.color ?? FOLDER_COLORS[0])
                                  setExpandedParents(prev => new Set([...prev, folder.id]))
                                  setFolderMenuOpen(null)
                                }}
                                className="w-full flex items-center gap-[7px] px-2.5 py-[7px] text-xs border-none cursor-pointer bg-transparent text-gray-900 dark:text-gray-100 text-left hover:bg-gray-200/20 dark:hover:bg-gray-400/10"
                              >
                                <Plus size={11} /> New sub-folder
                              </button>
                              {folder.parentId && (
                                <button
                                  onClick={() => { updateFolderMutation.mutate({ folderId: folder.id, data: { parentId: null } }); setFolderMenuOpen(null) }}
                                  className="w-full flex items-center gap-[7px] px-2.5 py-[7px] text-xs border-none cursor-pointer bg-transparent text-gray-900 dark:text-gray-100 text-left hover:bg-gray-200/20 dark:hover:bg-gray-400/10"
                                >
                                  <FolderOpen size={11} /> Move to root
                                </button>
                              )}
                              <button
                                onClick={() => { deleteFolderMutation.mutate(folder.id); setFolderMenuOpen(null) }}
                                className="w-full flex items-center gap-[7px] px-2.5 py-[7px] text-xs border-none cursor-pointer bg-transparent text-red-500 text-left hover:bg-red-500/10"
                              >
                                <Trash2 size={11} /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </SortableFolderWrapper>
              {/* Inline sub-folder creation form */}
              {isCreatingChild && (
                <div
                  className="pr-1.5 py-1 flex flex-col gap-1"
                  style={{ paddingLeft: (depth + 1) * 12 + 8 }} // depth-computed indent
                >
                  <div className="flex gap-[3px] flex-wrap">
                    {FOLDER_COLORS.map(c => (
                      <button key={c} onClick={() => setSubFolderColor(c)}
                        className={clsx(
                          'w-3 h-3 rounded-full cursor-pointer p-0',
                          subFolderColor === c ? 'border-2 border-gray-900 dark:border-gray-100' : 'border border-transparent',
                        )}
                        style={{ backgroundColor: c }} // user-chosen hex
                      />
                    ))}
                  </div>
                  <input
                    autoFocus
                    value={subFolderName}
                    onChange={e => setSubFolderName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && subFolderName.trim()) createSubFolderMutation.mutate({ name: subFolderName.trim(), parentId: folder.id, color: subFolderColor })
                      if (e.key === 'Escape') setCreatingSubFolderIn(null)
                    }}
                    placeholder="Sub-folder name"
                    className="w-full text-[11px] px-1.5 py-[3px] border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 box-border"
                  />
                  <div className="flex gap-[3px]">
                    <button
                      onClick={() => { if (subFolderName.trim()) createSubFolderMutation.mutate({ name: subFolderName.trim(), parentId: folder.id, color: subFolderColor }) }}
                      disabled={!subFolderName.trim()}
                      className={clsx(
                        'flex-1 py-0.5 text-[11px] font-semibold rounded border-none bg-blue-600 text-white',
                        subFolderName.trim() ? 'cursor-pointer opacity-100' : 'cursor-not-allowed opacity-50',
                      )}
                    >
                      Create
                    </button>
                    <button
                      onClick={() => setCreatingSubFolderIn(null)}
                      className="px-1.5 py-0.5 text-[11px] rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {/* Recursively render children when expanded */}
              {isExpanded && hasChildren && renderFolderTree(folder.id, depth + 1)}
            </div>
          )
        })}
      </SortableContext>
    )
  }

  // ============================================================
  // Render
  // ============================================================
  return (
    <AiFeatureProvider projectId={projectId ?? null}>
    <div className="space-y-4">

      {/* ── Tab navigation ── */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {([
          { key: 'parameters', label: 'Parameters', icon: null },
          { key: 'communications', label: 'Communications', icon: <Radio size={13} /> },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={clsx(
              'flex items-center gap-[5px] px-3.5 py-[7px] text-[13px] font-medium border-none bg-transparent cursor-pointer -mb-px border-b-2',
              activeTab === tab.key
                ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400',
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Communications tab ── */}
      {activeTab === 'communications' && projectId && (
        <CommunicationsTab projectId={projectId} />
      )}

      {/* ── Parameters tab content ── */}
      {activeTab === 'parameters' && <>

      {/* ── Staleness banner ── */}
      {isStale && (
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border border-amber-500 bg-amber-500/10 text-xs text-amber-900 dark:text-amber-200">
          <AlertTriangle size={14} className="text-amber-500 shrink-0" />
          <span className="flex-1">Parameters have been updated since the last Git sync.</span>
          <button
            onClick={handleBannerSync}
            disabled={isBannerSyncing}
            className={clsx(
              'flex items-center gap-[5px] px-2.5 py-1 rounded-[5px] border border-amber-500 bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 text-[11px] font-semibold',
              isBannerSyncing ? 'cursor-not-allowed opacity-70' : 'cursor-pointer opacity-100',
            )}
          >
            <RefreshCw size={11} className={clsx(isBannerSyncing && 'animate-spin')} />
            {isBannerSyncing ? 'Syncing…' : 'Sync Now'}
          </button>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          Parameters
          {!isLoading && (() => {
            const projectTotal = projectTotalParameters || totalParameters || parameters.length
            const filtered = filteredParameters.length
            // "narrowed" = the user has an explicit filter narrowing the
            // view (search text, pill, folder, secondary filter). A
            // pagination-only state (loaded < total but no filter) is
            // NOT narrowed and shows just the project total.
            const hasActiveFilter =
              trimmedQ.length > 0 ||
              statusFilter !== 'all' ||
              dataTypeFilter !== 'all' ||
              unitFilter !== 'all' ||
              sourceFilter !== 'all' ||
              !!selectedFolderId
            const narrowed = hasActiveFilter && filtered < projectTotal
            return (
              <span
                className="text-xs font-normal text-gray-600 dark:text-gray-400 bg-gray-200/30 dark:bg-gray-400/15 px-[7px] py-0.5 rounded-[10px]"
                title={
                  hasNextPage
                    ? `${parameters.length} loaded of ${totalParameters} matching, ${projectTotal} total in project`
                    : undefined
                }
              >
                {narrowed ? `${filtered} / ${projectTotal}` : projectTotal}
              </span>
            )
          })()}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {projectId && <SafetyLinkPanel variant="relevance" count={1} />}

          {/* Settings */}
          {projectId && (
            <Link
              to={`/projects/${projectId}/parameters/settings`}
              className={clsx(BTN_TOOLBAR, 'no-underline')}
              title="Parameter settings — type registry, unit registry"
            >
              <Settings size={13} />
              Settings
            </Link>
          )}

          {/* Baselines */}
          <button
            onClick={() => setIsBaselinesOpen(true)}
            className={BTN_TOOLBAR}
            title="Create / compare / restore parameter baselines"
          >
            <History size={13} />
            Baselines
          </button>

          {/* Scenario picker — what-if overlay over default-values. */}
          <div className="relative">
            <select
              value={activeScenarioId ?? ''}
              onChange={(e) => setActiveScenarioId(e.target.value || null)}
              className={clsx(
                BTN_TOOLBAR,
                'appearance-none pr-7',
                activeScenarioId
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                  : '',
              )}
              title="Apply a what-if scenario (overlay only — underlying values stay intact)"
              aria-label="Active scenario"
            >
              <option value="">No scenario</option>
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.overrideCount})
                </option>
              ))}
            </select>
          </div>

          {/* Publish to Git */}
          <button
            onClick={() => setIsPublishOpen(true)}
            className={BTN_TOOLBAR}
            title={storedGitConfig ? `Connected: ${storedGitConfig.repoUrl}` : 'Publish parameters to Git'}
          >
            <GitBranch size={13} />
            Publish to Git
            {storedGitConfig && (
              <span
                className={clsx(
                  'w-1.5 h-1.5 rounded-full ml-0.5',
                  isStale ? 'bg-amber-500' : 'bg-green-500',
                )}
              />
            )}
          </button>

          {/* Pull from Git — import round-trip */}
          {storedGitConfig && (
            <button
              onClick={handleGitPull}
              disabled={isPulling}
              className={clsx(BTN_TOOLBAR, !isPulling && 'text-blue-600 dark:text-blue-400')}
              title={`Pull latest parameters.json from ${storedGitConfig.platform}`}
            >
              <RefreshCw size={13} className={clsx(isPulling && 'animate-spin')} />
              {isPulling ? 'Pulling…' : 'Pull from Git'}
            </button>
          )}

          {/* Import — opens the guided CSV import modal */}
          <button
            onClick={() => setIsCsvImportOpen(true)}
            className={BTN_TOOLBAR}
          >
            <Upload size={13} />
            Import
          </button>

          {/* Column visibility toggle */}
          <div ref={colMenuRef} className="relative">
            <button
              onClick={() => setIsColMenuOpen(v => !v)}
              title="Show / hide columns"
              className={BTN_TOOLBAR}
            >
              <Layers size={13} />
              Columns
              {visibleCols.size < ALL_COLS.length && (
                <span className="px-1 rounded-lg text-[10px] font-bold bg-blue-600 text-white">
                  {ALL_COLS.length - visibleCols.size} hidden
                </span>
              )}
            </button>
            {isColMenuOpen && (
              <div className={clsx(MENU_POPOVER, 'top-[calc(100%+4px)] w-[180px] py-1.5')}>
                <div className="px-3 pt-1 pb-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 mb-1">
                  Visible columns
                </div>
                {ALL_COLS.map(col => (
                  <label
                    key={col.key}
                    className="flex items-center gap-2 px-3 py-[5px] cursor-pointer text-xs text-gray-900 dark:text-gray-100 hover:bg-gray-200/20 dark:hover:bg-gray-400/10"
                  >
                    <input type="checkbox" checked={visibleCols.has(col.key)} onChange={() => toggleCol(col.key)} className="cursor-pointer" />
                    {col.label}
                  </label>
                ))}
                <div className="border-t border-gray-200 dark:border-gray-700 mt-1 px-3 py-[5px]">
                  <button
                    onClick={() => {
                      const all = new Set(DEFAULT_COLS)
                      setVisibleCols(all)
                      if (COL_STORAGE_KEY) localStorage.setItem(COL_STORAGE_KEY, JSON.stringify([...all]))
                    }}
                    className="text-[11px] text-blue-600 dark:text-blue-400 bg-transparent border-none cursor-pointer p-0"
                  >
                    Reset to default
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Export dropdown */}
          <div ref={exportRef} className="relative">
            <button
              onClick={() => setIsExportOpen(v => !v)}
              disabled={!!exportingFormat}
              className={BTN_TOOLBAR}
            >
              <Download size={13} />
              {exportingFormat ? 'Exporting…' : 'Export'}
              <ChevronDown size={11} />
            </button>
            {isExportOpen && (
              <div className={clsx(MENU_POPOVER, 'top-[calc(100%+4px)] w-[280px]')}>
                {EXPORT_GROUPS.map(group => (
                  <div key={group.label}>
                    <div className="px-3 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-[0.06em] text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-700">
                      {group.label}
                    </div>
                    {group.formats.map(f => (
                      <button
                        key={f.key}
                        onClick={() => handleExport(f.key)}
                        className="flex items-center gap-2 w-full px-3 py-[7px] text-xs text-left text-gray-900 dark:text-gray-100 bg-transparent border-none cursor-pointer hover:bg-gray-200/20 dark:hover:bg-gray-400/10"
                      >
                        <Download size={12} className="text-blue-600 dark:text-blue-400 shrink-0" />
                        {f.label}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* View toggle: List / Board / Graph */}
          <div className="flex border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
            <button
              onClick={() => setParamViewMode('list')}
              title="List view"
              className={clsx(
                'flex items-center gap-[5px] px-2.5 py-[5px] text-xs font-medium border-none cursor-pointer border-r border-gray-200 dark:border-gray-700',
                paramViewMode === 'list'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
              )}
            >
              <List size={13} />
              List
            </button>
            <button
              onClick={() => setParamViewMode('board')}
              title="Kanban board (Draft / Approved / Obsolete)"
              className={clsx(
                'flex items-center gap-[5px] px-2.5 py-[5px] text-xs font-medium border-none cursor-pointer border-r border-gray-200 dark:border-gray-700',
                paramViewMode === 'board'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
              )}
            >
              <LayoutGrid size={13} />
              Board
            </button>
            <button
              onClick={() => setParamViewMode('graph')}
              title="Dependency graph view"
              className={clsx(
                'flex items-center gap-[5px] px-2.5 py-[5px] text-xs font-medium border-none cursor-pointer',
                paramViewMode === 'graph'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
              )}
            >
              <Share2 size={13} />
              Graph
            </button>
          </div>

          {/* AI draft -- only renders when all three flags clear. */}
          <AiFeatureGuard>
            <button
              onClick={handleAiDraft}
              disabled={aiDrafting}
              title="Generate a parameter from a natural-language description using AI"
              className={clsx(
                'flex items-center gap-1.5 px-3 py-[5px] rounded-md text-xs font-semibold border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 transition-colors',
                aiDrafting ? 'cursor-wait opacity-60' : 'cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/50',
              )}
            >
              <Sparkles size={13} />
              {aiDrafting ? 'Drafting…' : 'AI draft'}
            </button>
            {/* Built-in saved view: AI-modified rows. Toggling sets the
                authorType server filter to the AI subset. */}
            <button
              onClick={() => setAiModifiedView((v) => !v)}
              title="Show only parameters touched by AI (suggested, accepted, or applied)"
              className={clsx(
                'flex items-center gap-1.5 px-3 py-[5px] rounded-md text-xs font-semibold border transition-colors',
                aiModifiedView
                  ? 'border-purple-500 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                  : 'border-purple-200 dark:border-purple-800 bg-transparent text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20',
              )}
            >
              <Sparkles size={13} />
              {aiModifiedView ? 'AI rows ✓' : 'AI rows'}
            </button>
          </AiFeatureGuard>

          {/* Create */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-[5px] rounded-md text-xs font-semibold border-none bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition-colors"
          >
            <Plus size={13} />
            New Parameter
          </button>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600 dark:text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search parameters… (Ctrl+F)"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className={clsx(
              'w-full pl-8 py-1.5 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 text-xs outline-none box-border',
              searchQuery ? 'pr-8' : 'pr-2.5',
            )}
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setDebouncedSearch('') }}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-gray-600 dark:text-gray-400 p-0"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ── Filters (pill chips, parity with Requirements page) ── */}
      <ParameterFilterBar
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        dataTypeFilter={dataTypeFilter}
        onDataTypeChange={setDataTypeFilter}
        unitFilter={unitFilter}
        onUnitChange={setUnitFilter}
        sourceFilter={sourceFilter}
        onSourceChange={setSourceFilter}
        availableDataTypes={availableDataTypes}
        availableUnits={availableUnits}
        onClearAll={() => {
          setStatusFilter('all')
          setDataTypeFilter('all')
          setUnitFilter('all')
          setSourceFilter('all')
        }}
      />


      {/* ── Folders + content layout ── */}
      <DndContext
        sensors={dndSensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
      <div className="flex gap-3 items-stretch min-h-[calc(100vh-280px)]">

        {/* ── Folder sidebar ── */}
        {isFolderSidebarOpen ? (
          <div className="w-[200px] shrink-0 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-hidden">
            {/* Sidebar header */}
            <div className="flex items-center justify-between px-2.5 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">Folders</span>
              <button
                onClick={() => setIsFolderSidebarOpen(false)}
                title="Collapse sidebar"
                className="bg-transparent border-none cursor-pointer text-gray-600 dark:text-gray-400 p-0.5 flex items-center"
              >
                <ChevronDown size={12} className="rotate-90" />
              </button>
            </div>
            <div className="p-1">
              {/* All Parameters */}
              <button
                onClick={() => setSelectedFolderId(null)}
                className={clsx(
                  'w-full flex items-center gap-1.5 px-2 py-1.5 rounded-[5px] text-xs font-medium border-none cursor-pointer text-left',
                  selectedFolderId === null
                    ? 'bg-gray-200/30 dark:bg-gray-400/15 text-blue-600 dark:text-blue-400'
                    : 'bg-transparent text-gray-900 dark:text-gray-100',
                )}
              >
                <Layers
                  size={13}
                  className={clsx(
                    'shrink-0',
                    selectedFolderId === null ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400',
                  )}
                />
                <span className="flex-1">All Parameters</span>
                <span className="text-[10px] text-gray-600 dark:text-gray-400">{projectTotalParameters || totalParameters}</span>
              </button>
              {/* Ungrouped — droppable zone */}
              <DroppableFolder folderId="ungrouped" isOver={overFolderId === 'ungrouped'}>
                <button
                  onClick={() => setSelectedFolderId('__none__')}
                  className={clsx(
                    'w-full flex items-center gap-1.5 px-2 py-1.5 rounded-[5px] text-xs font-medium border-none cursor-pointer text-left',
                    selectedFolderId === '__none__'
                      ? 'bg-gray-200/30 dark:bg-gray-400/15 text-blue-600 dark:text-blue-400'
                      : 'bg-transparent text-gray-600 dark:text-gray-400',
                  )}
                >
                  <Folder size={13} className="shrink-0" />
                  <span className="flex-1">Ungrouped</span>
                  {(() => {
                    // unfiltered project total - sum of every folder's
                    // direct count = ungrouped. Uses facetsData.total so
                    // it stays correct even when a folder filter is
                    // narrowing the parameters paged query.
                    const total = projectTotalParameters || totalParameters
                    let inFolders = 0
                    for (const c of folderSubtreeCounts.values()) inFolders += c.direct
                    const ungrouped = Math.max(0, total - inFolders)
                    return <span className="text-[10px]">{ungrouped}</span>
                  })()}
                </button>
              </DroppableFolder>
              {/* Named folders — recursive tree, sortable at every depth level */}
              {renderFolderTree(null, 0)}
              {/* New folder */}
              {isCreatingFolder ? (
                <div className="p-1.5 flex flex-col gap-[5px]">
                  <div className="flex gap-[3px] flex-wrap">
                    {FOLDER_COLORS.map(c => (
                      <button key={c} onClick={() => setCreateFolderColor(c)}
                        className={clsx(
                          'w-3.5 h-3.5 rounded-full cursor-pointer p-0',
                          createFolderColor === c ? 'border-2 border-gray-900 dark:border-gray-100' : 'border border-transparent',
                        )}
                        style={{ backgroundColor: c }} // user-chosen hex
                      />
                    ))}
                  </div>
                  <input
                    autoFocus
                    value={createFolderName}
                    onChange={e => setCreateFolderName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && createFolderName.trim()) createFolderMutation.mutate(createFolderName.trim())
                      if (e.key === 'Escape') { setIsCreatingFolder(false); setCreateFolderName('') }
                    }}
                    placeholder="Folder name"
                    className="w-full text-[11px] px-[7px] py-1 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 box-border"
                  />
                  <div className="flex gap-1">
                    <button
                      onClick={() => { if (createFolderName.trim()) createFolderMutation.mutate(createFolderName.trim()) }}
                      disabled={!createFolderName.trim()}
                      className={clsx(
                        'flex-1 py-[3px] text-[11px] font-semibold rounded border-none bg-blue-600 text-white',
                        createFolderName.trim() ? 'cursor-pointer opacity-100' : 'cursor-not-allowed opacity-50',
                      )}
                    >
                      Create
                    </button>
                    <button
                      onClick={() => { setIsCreatingFolder(false); setCreateFolderName('') }}
                      className="px-[7px] py-[3px] text-[11px] rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsCreatingFolder(true)}
                  className="w-full flex items-center gap-[5px] px-2 py-[5px] rounded-[5px] text-[11px] font-medium border-none cursor-pointer text-left bg-transparent text-gray-600 dark:text-gray-400 mt-0.5 hover:bg-gray-200/20 dark:hover:bg-gray-400/10"
                >
                  <Plus size={11} />
                  New folder
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Collapsed sidebar toggle */
          <button
            onClick={() => setIsFolderSidebarOpen(true)}
            title="Expand folder sidebar"
            className="shrink-0 flex items-center justify-center w-6 min-h-[40px] rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 cursor-pointer text-gray-600 dark:text-gray-400"
          >
            <Folder size={13} />
          </button>
        )}

        {/* ── Right: tip / graph / bulk bar / table ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">

      {/* ── Info / tip ── */}
      {parameters.length === 0 && !isLoading && (
        <div className="px-3.5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-400">
          <strong>Tip:</strong> Parameters are automatically extracted when you use the pattern <code className="bg-gray-200/30 dark:bg-gray-400/15 px-1 py-px rounded">@parameterName@</code> in function descriptions.
          You can also import an existing parameter set using the <strong>Import</strong> button.
        </div>
      )}

      {/* ── Dependency Graph view ── */}
      {paramViewMode === 'graph' && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-hidden">
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-[600px] text-sm text-gray-600 dark:text-gray-400">
                Loading graph…
              </div>
            }
          >
            <ParameterDependencyGraph parameters={filteredParameters} folders={folders} />
          </Suspense>
        </div>
      )}

      {/* ── Board view (Draft / Approved / Obsolete Kanban) ── */}
      {paramViewMode === 'board' && projectId && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-hidden">
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-[400px] text-sm text-gray-600 dark:text-gray-400">
                Loading board…
              </div>
            }
          >
            <ParameterBoardView
              parameters={filteredParameters}
              folders={folders}
              projectId={projectId}
            />
          </Suspense>
        </div>
      )}

      {/* ── Bulk action toolbar ── */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 flex-wrap px-3 py-2 rounded-lg border border-blue-600 dark:border-blue-400 bg-blue-100 dark:bg-blue-950">
          <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 mr-1">
            {selectedIds.size} selected
          </span>
          {/* Bulk move to folder. Controlled select — value always resets
              to "" after a pick so the same destination can be re-selected
              for the next batch. Sentinel "__root__" represents Ungrouped. */}
          {folders.length > 0 && (
            <select
              value=""
              onChange={async e => {
                const raw = e.target.value
                if (!raw) return
                const folderId = raw === '__root__' ? null : raw
                const count = selectedIds.size
                await Promise.all(
                  Array.from(selectedIds).map(id =>
                    parameterService.moveParameterToFolder(projectId!, id, folderId)
                  )
                )
                queryClient.invalidateQueries({ queryKey: ['parameters', projectId] })
                queryClient.invalidateQueries({ queryKey: ['parameter-folders', projectId] })
                const label = folderId
                  ? (folderOptions.find(o => o.value === folderId)?.label.trim() ?? 'folder')
                  : 'Ungrouped'
                setToastMessage(`Moved ${count} parameter${count > 1 ? 's' : ''} to ${label}`)
                setSelectedIds(new Set())
              }}
              className="px-2 py-1 rounded-md text-xs font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 cursor-pointer min-w-[160px]"
            >
              <option value="" disabled>Move to folder…</option>
              <option value="__root__">— Ungrouped (root)</option>
              {buildAllFolderOptions().map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => bulkUpdateMutation.mutate({ ids: Array.from(selectedIds), updates: { status: 'approved' } })}
            disabled={bulkUpdateMutation.isPending}
            className="px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer border border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400"
          >
            Approve
          </button>
          <button
            onClick={() => bulkUpdateMutation.mutate({ ids: Array.from(selectedIds), updates: { status: 'draft' } })}
            disabled={bulkUpdateMutation.isPending}
            className="px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
          >
            Set Draft
          </button>
          <button
            onClick={() => bulkUpdateMutation.mutate({ ids: Array.from(selectedIds), updates: { status: 'obsolete' } })}
            disabled={bulkUpdateMutation.isPending}
            className="px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
          >
            Obsolete
          </button>
          {!bulkDeleteConfirm ? (
            <button
              onClick={() => setBulkDeleteConfirm(true)}
              className="px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer border border-red-500/40 bg-red-500/10 text-red-500"
            >
              Delete
            </button>
          ) : (
            <span className="flex items-center gap-1.5">
              <span className="text-xs text-red-500 font-medium">Are you sure?</span>
              <button
                onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
                disabled={bulkDeleteMutation.isPending}
                className="px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer border-none bg-red-500 text-white"
              >
                Confirm
              </button>
              <button
                onClick={() => setBulkDeleteConfirm(false)}
                className="px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                Cancel
              </button>
            </span>
          )}
          <span className="flex-1" />
          <button
            onClick={() => { setSelectedIds(new Set()); setBulkDeleteConfirm(false) }}
            title="Clear selection"
            className="bg-transparent border-none cursor-pointer text-gray-600 dark:text-gray-400 p-0.5 flex items-center"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Table ── */}
      {paramViewMode === 'list' && (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-hidden">
        <div
          ref={tableScrollRef}
          className="overflow-auto max-h-[calc(100vh-360px)]"
        >
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-[3]">
              <tr className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-700">
                <th className="px-3 py-2 w-8 sticky left-0 z-[2] bg-white dark:bg-gray-950">
                  <input
                    type="checkbox"
                    checked={filteredParameters.length > 0 && filteredParameters.every(p => selectedIds.has(p.id))}
                    onChange={e => {
                      if (e.target.checked) {
                        setSelectedIds(new Set(filteredParameters.map(p => p.id)))
                      } else {
                        setSelectedIds(new Set())
                      }
                    }}
                    className="cursor-pointer"
                  />
                </th>
                {([
                  { label: 'Parameter',   field: 'name' as const,     colKey: null,                       sticky: true },
                  { label: 'Description', field: null,                 colKey: 'description' as ColKey, sticky: false },
                  { label: 'Type',        field: null,                 colKey: 'type' as ColKey,        sticky: false },
                  { label: 'Value',       field: null,                 colKey: 'value' as ColKey,       sticky: false },
                  { label: 'Computed',    field: null,                 colKey: 'computed' as ColKey,    sticky: false },
                  { label: 'Unit',        field: null,                 colKey: 'unit' as ColKey,        sticky: false },
                  { label: 'Folder',      field: null,                 colKey: 'folder' as ColKey,      sticky: false },
                  { label: 'Source',      field: null,                 colKey: 'source' as ColKey,      sticky: false },
                  { label: 'Status',      field: null,                 colKey: 'status' as ColKey,      sticky: false },
                  { label: 'Used in',     field: null,                 colKey: 'usedIn' as ColKey,      sticky: false },
                  { label: 'Created',     field: 'createdAt' as const, colKey: 'created' as ColKey,     sticky: false },
                  { label: '',            field: null,                 colKey: null,                    sticky: false },
                ] as Array<{ label: string; field: 'name' | 'createdAt' | 'updatedAt' | null; colKey: ColKey | null; sticky: boolean }>)
                .filter(h => h.colKey === null || visibleCols.has(h.colKey))
                .map(h => (
                  <th
                    key={h.label || 'actions'}
                    onClick={h.field ? () => handleSortBy(h.field!) : undefined}
                    className={clsx(
                      'px-3 py-2 text-left text-[10px] font-bold tracking-wider uppercase text-gray-600 dark:text-gray-400 whitespace-nowrap select-none',
                      h.field ? 'cursor-pointer' : 'cursor-default',
                      h.sticky && 'sticky left-8 z-[2] bg-white dark:bg-gray-950 shadow-[2px_0_4px_rgba(0,0,0,0.06)]',
                    )}
                    title={h.field ? `Sort by ${h.label}` : undefined}
                  >
                    <span className="inline-flex items-center gap-1">
                      {h.label}
                      {h.field && (
                        sortField === h.field
                          ? sortOrder === 'asc'
                            ? <ArrowUp size={10} className="text-blue-600 dark:text-blue-400" />
                            : <ArrowDown size={10} className="text-blue-600 dark:text-blue-400" />
                          : <ArrowUpDown size={10} className="opacity-40" />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={2 + visibleCols.size} className="px-3 py-8 text-center text-gray-600 dark:text-gray-400">Loading parameters…</td></tr>
              ) : filteredParameters.length === 0 ? (
                <tr><td colSpan={2 + visibleCols.size} className="px-3 py-8 text-center text-gray-600 dark:text-gray-400">
                  {parameters.length === 0 ? 'No parameters yet. Create one or import a file.' : 'No parameters match your filters.'}
                </td></tr>
              ) : (() => {
                const virtualItems = rowVirtualizer.getVirtualItems()
                const totalSize = rowVirtualizer.getTotalSize()
                const topPad = virtualItems[0]?.start ?? 0
                const lastEnd = virtualItems[virtualItems.length - 1]?.end ?? 0
                const bottomPad = Math.max(0, totalSize - lastEnd)
                const colSpanTotal = 2 + visibleCols.size
                return (
                  <>
                    {topPad > 0 && (
                      <tr aria-hidden="true" style={{ height: `${topPad}px` }}>
                        <td colSpan={colSpanTotal} className="p-0" />
                      </tr>
                    )}
                    {virtualItems.map((vi) => {
                      const item = flatRowItems[vi.index]
                      if (!item) return null
                      if (item.kind === 'group-header') {
                        const group = item.group
                        const isCollapsed = item.isCollapsed
                        return (
                          <tr
                            key={item.key}
                            style={{ height: ROW_FIXED_HEIGHT_PX }}
                            className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-700"
                          >
                            <td
                              colSpan={colSpanTotal}
                              className="py-[5px] pr-3"
                              style={{ paddingLeft: group.depth * 18 + 12 }}
                            >
                              <button
                                type="button"
                                onClick={() => toggleGroup(group.id)}
                                className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer p-0 text-[11px] font-bold tracking-wider uppercase text-gray-600 dark:text-gray-400"
                        >
                          {group.color && (
                            <span
                              className="w-2 h-2 rounded-full inline-block shrink-0"
                              style={{ backgroundColor: group.color }} // user-chosen hex
                            />
                          )}
                          {isCollapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                          {group.label}
                          <span
                            className="text-[10px] text-gray-600 dark:text-gray-400 font-normal normal-case tracking-normal"
                            title={
                              group.totalKnown !== undefined && group.totalKnown !== group.params.length
                                ? `${group.params.length} loaded of ${group.totalKnown} total`
                                : undefined
                            }
                          >
                            ({group.totalKnown ?? group.params.length})
                          </span>
                        </button>
                      </td>
                    </tr>
                        )
                      }
                      // data-row branch
                      const param = item.param
                      return (
                        <ParameterRow
                          key={item.key}
                          param={param as ParameterWithUsage}
                          visibleCols={visibleCols}
                          showGroups={showGroupsForTable}
                          selectedFolderId={selectedFolderId}
                          selected={selectedIds.has(param.id)}
                          foldersById={foldersById}
                          computedVal={formulaResults.get(param.id)}
                          isInlineEditing={inlineEditingId === param.id}
                          inlineEditValue={inlineEditValue}
                          deleteConfirmPending={
                            deleteParameterMutation.isPending && deleteConfirmation?.id === param.id
                          }
                          folderOptions={folderOptions}
                          onToggleSelection={handleToggleSelection}
                          onOpenDetail={handleOpenDetail}
                          onStartInlineEdit={handleStartInlineEdit}
                          onInlineEditChange={handleInlineEditChange}
                          onSaveInlineEdit={handleSaveInlineEdit}
                          onCancelInlineEdit={handleCancelInlineEdit}
                          onViewSource={handleViewSource}
                          onMoveToFolder={handleMoveToFolderFromRow}
                          scenarioOverride={scenarioOverrides.get(param.id)}
                          onOpenChangeRequest={handleOpenChangeRequest}
                          onEditClick={handleEditClick}
                          onDeleteClick={handleDeleteClick}
                        />
                      )
                    })}
                    {bottomPad > 0 && (
                      <tr aria-hidden="true" style={{ height: `${bottomPad}px` }}>
                        <td colSpan={colSpanTotal} className="p-0" />
                      </tr>
                    )}
                  </>
                )
              })()}
            </tbody>
          </table>
        </div>
      </div>
      )}

        </div>{/* end right column */}

        {/* Inline detail drawer — side-by-side with table, matches Requirements page */}
        {projectId && (
          <ParameterDetailDrawer
            isOpen={!!detailParameter}
            onClose={() => setDetailParameter(null)}
            projectId={projectId}
            parameter={detailParameter}
            onEdit={setEditingParameter}
            allParameters={parameters}
          />
        )}

        {/* Command palette (Cmd/Ctrl + Shift + P). Receives the parameter + folder
            lists and wires the four main actions. Closes after any pick. */}
        <ParameterCommandPalette
          open={isPaletteOpen}
          onClose={() => setIsPaletteOpen(false)}
          parameters={parameters}
          folders={folders}
          onOpenParameter={(id) => {
            const p = parameters.find((x) => x.id === id)
            if (p) setDetailParameter(p)
          }}
          onFilterToFolder={(folderId) => setSelectedFolderId(folderId)}
          onCreate={() => setIsCreateModalOpen(true)}
          onImport={() => setIsImportOpen(true)}
          onExport={() => setIsExportOpen(true)}
        />
        <ShortcutsOverlay
          open={isShortcutsOpen}
          onClose={() => setIsShortcutsOpen(false)}
        />
        {projectId && isBaselinesOpen && (
          <ParameterBaselinesPanel
            projectId={projectId}
            onClose={() => setIsBaselinesOpen(false)}
          />
        )}
      </div>{/* end folders + content layout */}
      <DragOverlay>
        {activeDragParamId ? (
          <div className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-semibold opacity-90 shadow-lg">
            {parameters.find(p => p.id === activeDragParamId)?.name ?? 'Parameter'}
          </div>
        ) : activeDragFolderId ? (
          <div className="px-2.5 py-[5px] rounded-md bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs font-medium opacity-90 shadow-lg border border-gray-200 dark:border-gray-700 flex items-center gap-1.5">
            <FolderOpen
              size={13}
              style={{ color: (activeDragFolderId ? foldersById.get(activeDragFolderId) : null)?.color ?? '#6366f1' }} // user-chosen hex
            />
            {(activeDragFolderId ? foldersById.get(activeDragFolderId) : null)?.name ?? 'Folder'}
          </div>
        ) : null}
      </DragOverlay>
      </DndContext>

      {/* ── Subfolder confirmation modal ── */}
      {pendingSubfolder && (() => {
        const child = foldersById.get(pendingSubfolder.childId)
        const parent = foldersById.get(pendingSubfolder.parentId)
        if (!child || !parent) return null
        return (
          <div
            className="fixed inset-0 z-[1000] bg-black/40 flex items-center justify-center"
            onClick={() => setPendingSubfolder(null)}
          >
            <div
              className="bg-white dark:bg-gray-950 rounded-[10px] border border-gray-200 dark:border-gray-700 shadow-2xl w-[360px] px-[22px] py-5 flex flex-col gap-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-2.5">
                <FolderOpen size={18} className="text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">Move into folder?</span>
              </div>
              <p className="text-[13px] text-gray-600 dark:text-gray-400 m-0 leading-relaxed">
                Do you want to move <strong className="text-gray-900 dark:text-gray-100">{child.name}</strong> into{' '}
                <strong className="text-gray-900 dark:text-gray-100">{parent.name}</strong> as a subfolder?
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setPendingSubfolder(null)}
                  className="px-3.5 py-1.5 rounded-md text-xs font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    makeFolderChildMutation.mutate({ childId: pendingSubfolder.childId, parentId: pendingSubfolder.parentId })
                    setPendingSubfolder(null)
                  }}
                  className="px-3.5 py-1.5 rounded-md text-xs font-semibold border-none bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition-colors"
                >
                  Yes, move it
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Import Modal ── */}
      {isImportOpen && (
        <div
          className="fixed inset-0 z-[1000] bg-black/50 flex items-center justify-center p-5"
          onClick={() => setIsImportOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-950 rounded-[10px] border border-gray-200 dark:border-gray-700 shadow-2xl w-full max-w-[560px] max-h-[80vh] flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-gray-200 dark:border-gray-700">
              <Upload size={16} className="text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100">Import Parameters</span>
              <span className="flex-1" />
              <button onClick={() => setIsImportOpen(false)} className="bg-transparent border-none cursor-pointer text-gray-600 dark:text-gray-400 p-1"><X size={16} /></button>
            </div>

            <div className="p-4 overflow-y-auto flex flex-col gap-3.5">
              {importResult ? (
                /* Success view */
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <CheckCircle size={18} className="text-green-500" />
                    <div>
                      <div className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">Import complete</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {importResult.imported} created · {importResult.updated} updated
                        {importResult.errors.length > 0 && ` · ${importResult.errors.length} errors`}
                      </div>
                    </div>
                  </div>
                  {importResult.warnings.length > 0 && (
                    <div className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-500/5 border border-amber-500/20 rounded-md px-2.5 py-2">
                      {importResult.warnings.map((w, i) => <div key={i}>{w}</div>)}
                    </div>
                  )}
                  {importResult.errors.length > 0 && (
                    <div className="text-[11px] text-red-700 dark:text-red-400 bg-red-500/5 border border-red-500/20 rounded-md px-2.5 py-2">
                      {importResult.errors.map((e, i) => <div key={i}>{e}</div>)}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => { resetImport() }}
                      className="px-3.5 py-1.5 rounded-md text-xs font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 cursor-pointer">
                      Import another file
                    </button>
                    <button onClick={() => setIsImportOpen(false)}
                      className="px-3.5 py-1.5 rounded-md text-xs font-semibold border-none bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition-colors">
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                /* Upload form */
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1.5">File</label>
                    <label className="flex items-center justify-center gap-2 px-4 py-5 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 cursor-pointer text-xs text-gray-600 dark:text-gray-400">
                      <Upload size={16} />
                      {importFilename ? importFilename : 'Click to upload or drop a file'}
                      <input type="file" accept=".csv,.json,.h,.hpp,.m" onChange={handleFileChange} className="hidden" />
                    </label>
                    <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-1">Supported: CSV, JSON, C/C++ header (.h), MATLAB script (.m)</p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Format <span className="font-normal">(auto-detected from extension)</span></label>
                    <select className="settings-input" value={importFormat} onChange={e => setImportFormat(e.target.value)}>
                      <option value="">Auto-detect</option>
                      {IMPORT_FORMATS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </select>
                  </div>

                  {!importFilename && (
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Or paste content</label>
                      <textarea
                        value={importContent}
                        onChange={e => setImportContent(e.target.value)}
                        placeholder="Paste CSV, JSON, C header, or MATLAB content here…"
                        rows={8}
                        className="w-full font-mono text-[11px] px-2.5 py-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 resize-y box-border"
                      />
                    </div>
                  )}

                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setIsImportOpen(false)}
                      className="px-3.5 py-1.5 rounded-md text-xs font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 cursor-pointer">
                      Cancel
                    </button>
                    <button onClick={handleImport} disabled={isImporting || !importContent}
                      className={clsx(
                        'flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold border-none bg-blue-600 hover:bg-blue-500 text-white transition-colors',
                        (!importContent || isImporting) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer opacity-100',
                      )}>
                      <Upload size={13} />
                      {isImporting ? 'Importing…' : 'Import'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Existing modals ── */}
      {deleteConfirmation && (
        <DeleteConfirmationModal
          isOpen={!!deleteConfirmation}
          itemName={deleteConfirmation.name}
          itemType="parameter"
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteConfirmation(null)}
          isDeleting={deleteParameterMutation.isPending}
        />
      )}

      {projectId && (
        <>
          <EditParameterModal
            isOpen={!!editingParameter}
            onClose={() => setEditingParameter(null)}
            projectId={projectId}
            parameter={editingParameter}
          />
          <SourceDetailsModal
            isOpen={!!viewingSource}
            onClose={() => setViewingSource(null)}
            parameter={viewingSource}
          />
          <CreateParameterModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            projectId={projectId}
          />
          {changeRequestModal && projectId && (
            <CreateChangeRequestModal
              isOpen={changeRequestModal.isOpen}
              onClose={() => setChangeRequestModal(null)}
              projectId={projectId}
              sourceType="parameter"
              sourceId={changeRequestModal.sourceId}
              sourceName={changeRequestModal.sourceName}
            />
          )}
        </>
      )}

      {projectId && (
        <ImportParameterModal
          isOpen={isCsvImportOpen}
          onClose={() => setIsCsvImportOpen(false)}
          projectId={projectId}
        />
      )}

      {projectId && (
        <PublishToGitModal
          isOpen={isPublishOpen}
          onClose={() => setIsPublishOpen(false)}
          projectId={projectId}
          parameters={parameters.map(p => ({ id: p.id, name: p.name, updatedAt: p.updatedAt, tags: p.tags as string[] | null }))}
          onConfigChange={setStoredGitConfig}
        />
      )}

      </> /* end parameters tab */}

      {/* ── Toast notification ── */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[2000] px-4.5 py-2.5 rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-[13px] font-medium shadow-lg pointer-events-none">
          {toastMessage}
        </div>
      )}

      {/* ── Bulk-job progress toast ── */}
      {bulkJobProgress && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[2000] px-4 py-3 rounded-lg bg-blue-600 text-white text-xs font-medium shadow-lg min-w-[280px]">
          <div className="flex items-center justify-between mb-2">
            <span>
              Bulk delete — {bulkJobProgress.done + bulkJobProgress.failed}/{bulkJobProgress.total}
              {bulkJobProgress.failed > 0 && (
                <span className="text-amber-200 ml-2">{bulkJobProgress.failed} failed</span>
              )}
            </span>
            <span className="text-[10px] uppercase tracking-wider opacity-80">
              {bulkJobProgress.status}
            </span>
          </div>
          <div className="h-1.5 bg-blue-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all"
              style={{
                width: `${Math.min(100, ((bulkJobProgress.done + bulkJobProgress.failed) / Math.max(1, bulkJobProgress.total)) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* ── Pull from Git result ── */}
      {pullResult && (
        <div className="fixed bottom-6 right-6 z-[2000] px-4 py-3 rounded-lg max-w-[340px] bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 shadow-lg text-xs">
          <div className="flex items-center justify-between mb-1.5">
            <strong>Pull from Git complete</strong>
            <button onClick={() => setPullResult(null)} className="bg-transparent border-none cursor-pointer text-gray-600 dark:text-gray-400 p-0.5"><X size={13} /></button>
          </div>
          <div>Created: {pullResult.imported} | Updated: {pullResult.updated}</div>
          {pullResult.errors.length > 0 && <div className="text-red-500 mt-1">{pullResult.errors.length} errors</div>}
          {pullResult.warnings.length > 0 && <div className="text-amber-500 mt-1">{pullResult.warnings.length} warnings</div>}
        </div>
      )}
    </div>
    </AiFeatureProvider>
  )
}
