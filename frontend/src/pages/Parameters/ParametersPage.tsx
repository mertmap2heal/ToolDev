import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Search, X, Check, Trash2, Edit2, Plus, Filter, ChevronDown, ChevronUp,
  FileText, Upload, Download, GitBranch, RefreshCw, CheckCircle,
  AlertTriangle, Settings, Radio, List, Share2,
  Folder, FolderOpen, MoreHorizontal, Layers, ArrowUpDown, ArrowUp, ArrowDown,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
import ParameterDependencyGraph from '../../components/parameters/ParameterDependencyGraph'
import ImportParameterModal from '../../components/parameters/ImportParameterModal'
import CommunicationsTab from './CommunicationsTab'
import type { Parameter, ParameterFolder } from 'shared/types/engineering.types'
import clsx from 'clsx'
import { format } from 'date-fns'

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
      { key: 'json', label: 'JSON (.json)' },
      { key: 'yaml', label: 'YAML (.yaml)' },
      { key: 'csv',  label: 'CSV (.csv)' },
      { key: 'xml',  label: 'XML (.xml)' },
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
  excel: 'parameters.xlsx', pdf: 'parameters.pdf',
}

const IMPORT_FORMATS = [
  { key: 'csv',      label: 'CSV (.csv)' },
  { key: 'json',     label: 'JSON (.json)' },
  { key: 'c_header', label: 'C/C++ header (.h)' },
  { key: 'matlab',   label: 'MATLAB script (.m)' },
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
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState<'parameters' | 'communications'>('parameters')
  const [changeRequestModal, setChangeRequestModal] = useState<{ isOpen: boolean; sourceId: string; sourceName: string } | null>(null)
  const [dataTypeFilter, setDataTypeFilter] = useState<string>('all')
  const [unitFilter, setUnitFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [paramViewMode, setParamViewMode] = useState<'list' | 'graph'>('list')
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
  type ColKey = 'description' | 'type' | 'value' | 'computed' | 'unit' | 'source' | 'status' | 'usedIn' | 'created'
  const ALL_COLS: { key: ColKey; label: string }[] = [
    { key: 'description', label: 'Description' },
    { key: 'type',        label: 'Type' },
    { key: 'value',       label: 'Value' },
    { key: 'computed',    label: 'Computed' },
    { key: 'unit',        label: 'Unit' },
    { key: 'source',      label: 'Source' },
    { key: 'status',      label: 'Status' },
    { key: 'usedIn',      label: 'Used in' },
    { key: 'created',     label: 'Created' },
  ]
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

  const { data: parameters = [], isLoading } = useQuery({
    queryKey: ['parameters', projectId, true, sortField, sortOrder],
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID required')
      const response = await parameterService.getParameters(projectId, {
        includeUsageCounts: true,
        sort: sortField,
        order: sortOrder,
      })
      if (response.success && response.data) return response.data as ParameterWithUsage[]
      throw new Error(response.error || 'Failed to load parameters')
    },
    enabled: !!projectId,
  })

  // Folder queries and mutations
  const { data: foldersData } = useQuery({
    queryKey: ['parameter-folders', projectId],
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID required')
      const response = await parameterService.getFolders(projectId)
      if (response.success && response.data) return response.data
      throw new Error(response.error || 'Failed to load folders')
    },
    enabled: !!projectId,
  })
  const folders: ParameterFolder[] = foldersData ?? []

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
      // Param drag: track which folder we're hovering over
      if (!overId || !overId.startsWith('folder-')) { setOverFolderId(null); return }
      setOverFolderId(overId.replace('folder-', ''))
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
      const activeFolderData = folders.find(f => f.id === activeFolder)
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
    if (overId === 'folder-ungrouped') {
      moveToFolderMutation.mutate({ parameterId: paramId, folderId: null })
    } else if (overId.startsWith('folder-')) {
      const targetFolderId = overId.replace('folder-', '')
      moveToFolderMutation.mutate({ parameterId: paramId, folderId: targetFolderId })
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
    mutationFn: (ids: string[]) => {
      if (!projectId) throw new Error('Project ID required')
      return parameterService.bulkDelete(projectId, ids)
    },
    onSuccess: (_data, ids) => {
      queryClient.invalidateQueries({ queryKey: ['parameters', projectId] })
      setSelectedIds(new Set())
      setBulkDeleteConfirm(false)
      setToastMessage(`${ids.length} parameter${ids.length > 1 ? 's' : ''} deleted`)
    },
    onError: (error: any) => {
      console.error('Bulk delete error:', error)
      alert(error?.error || 'Bulk delete failed')
      setBulkDeleteConfirm(false)
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

  const handleDeleteClick = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation()
    setDeleteConfirmation({ id, name })
  }

  const handleEditClick = (e: React.MouseEvent, parameter: Parameter) => {
    e.stopPropagation()
    setEditingParameter(parameter)
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
  // Build a flat ordered list of folder options for dropdowns (any depth)
  // ---------------------------------------------------------------------------
  const buildAllFolderOptions = (): Array<{ value: string; label: string }> => {
    const result: Array<{ value: string; label: string }> = []
    const visit = (parentId: string | null, depth: number) => {
      const ids = folderOrderByParent.get(parentId) ?? []
      for (const id of ids) {
        const f = folders.find(x => x.id === id)
        if (!f) continue
        const prefix = depth === 0 ? '' : '\u00a0\u00a0'.repeat(depth) + '\u2514 '
        result.push({ value: f.id, label: prefix + f.name })
        visit(f.id, depth + 1)
      }
    }
    visit(null, 0)
    return result
  }

  // ---------------------------------------------------------------------------
  // Recursive folder tree rendering — arbitrary depth, sortable at every level
  // ---------------------------------------------------------------------------
  const renderFolderTree = (parentId: string | null, depth: number): React.ReactNode => {
    const levelIds = folderOrderByParent.get(parentId) ?? []
    if (levelIds.length === 0) return null
    return (
      <SortableContext items={levelIds.map(id => `sortfolder-${id}`)} strategy={verticalListSortingStrategy}>
        {levelIds.map(folderId => {
          const folder = folders.find(f => f.id === folderId)
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
                          <span className="text-[10px] text-gray-600 dark:text-gray-400 shrink-0">
                            {folder._count?.parameters ?? 0}
                          </span>
                        </button>
                        <div className="relative" ref={folderMenuOpen === folder.id ? folderMenuRef : undefined}>
                          <button
                            onClick={e => { e.stopPropagation(); setFolderMenuOpen(isMenuOpen ? null : folder.id); setRenamingColor(folder.color ?? FOLDER_COLORS[0]) }}
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
          {!isLoading && (
            <span className="text-xs font-normal text-gray-600 dark:text-gray-400 bg-gray-200/30 dark:bg-gray-400/15 px-[7px] py-0.5 rounded-[10px]">
              {filteredParameters.length !== parameters.length
                ? `${filteredParameters.length} / ${parameters.length}`
                : parameters.length}
            </span>
          )}
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

          {/* View toggle: List / Graph */}
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

      {/* ── Filters ── */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-hidden">
        <button
          onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
          className="w-full flex items-center justify-between px-3.5 py-2.5 bg-transparent border-none cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Filter size={13} className="text-gray-600 dark:text-gray-400" />
            <span className="text-xs font-medium text-gray-900 dark:text-gray-100">Filters</span>
          </div>
          {isFiltersExpanded
            ? <ChevronUp size={14} className="text-gray-600 dark:text-gray-400" />
            : <ChevronDown size={14} className="text-gray-600 dark:text-gray-400" />
          }
        </button>
        {isFiltersExpanded && (
          <div className="px-3.5 py-2.5 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2.5">
              {[
                { label: 'Data Type', value: dataTypeFilter, onChange: setDataTypeFilter, options: [
                  { value: 'all', label: 'All Data Types' }, { value: 'unassigned', label: 'Unassigned' },
                  ...Array.from(new Set(parameters.map(p => p.dataType).filter(Boolean))).map(v => ({ value: v!, label: v! }))
                ]},
                { label: 'Unit', value: unitFilter, onChange: setUnitFilter, options: [
                  { value: 'all', label: 'All Units' }, { value: 'unassigned', label: 'Unassigned' },
                  ...Array.from(new Set(parameters.map(p => p.unit).filter(Boolean))).map(v => ({ value: v!, label: v! }))
                ]},
                { label: 'Source', value: sourceFilter, onChange: setSourceFilter, options: [
                  { value: 'all', label: 'All Sources' }, { value: 'has-source', label: 'Has Source' }, { value: 'unassigned', label: 'Unassigned' }
                ]},
                { label: 'Status', value: statusFilter, onChange: setStatusFilter, options: [
                  { value: 'all', label: 'All Statuses' }, { value: 'draft', label: 'Draft' }, { value: 'approved', label: 'Approved' }, { value: 'obsolete', label: 'Obsolete' }
                ]},
              ].map(filter => (
                <div key={filter.label}>
                  <label className="block text-[11px] font-semibold text-gray-600 dark:text-gray-400 mb-1">{filter.label}</label>
                  <select
                    value={filter.value}
                    onChange={e => filter.onChange(e.target.value)}
                    className="settings-input"
                  >
                    {filter.options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>


      {/* ── Folders + content layout ── */}
      <DndContext
        sensors={dndSensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
      <div className="flex gap-3 items-start">

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
                <span className="text-[10px] text-gray-600 dark:text-gray-400">{parameters.length}</span>
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
                  <span className="text-[10px]">{parameters.filter(p => !p.folderId).length}</span>
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
          <ParameterDependencyGraph parameters={filteredParameters} />
        </div>
      )}

      {/* ── Bulk action toolbar ── */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 flex-wrap px-3 py-2 rounded-lg border border-blue-600 dark:border-blue-400 bg-blue-100 dark:bg-blue-950">
          <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 mr-1">
            {selectedIds.size} selected
          </span>
          {/* Bulk move to folder */}
          {folders.length > 0 && (
            <select
              defaultValue=""
              onChange={async e => {
                const folderId = e.target.value || null
                await Promise.all(
                  Array.from(selectedIds).map(id =>
                    parameterService.moveParameterToFolder(projectId!, id, folderId)
                  )
                )
                queryClient.invalidateQueries({ queryKey: ['parameters', projectId] })
                queryClient.invalidateQueries({ queryKey: ['parameter-folders', projectId] })
                setToastMessage(`Moved ${selectedIds.size} parameter${selectedIds.size > 1 ? 's' : ''} to ${folderId ? (folders.find(f => f.id === folderId)?.name ?? 'folder') : 'root'}`)
                setSelectedIds(new Set())
              }}
              className="px-2 py-1 rounded-md text-xs font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 cursor-pointer"
            >
              <option value="">Move to folder…</option>
              <option value="">— Root (ungrouped)</option>
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
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
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
                // Build groups only when showing All Parameters; otherwise flat list
                const showGroups = selectedFolderId === null && folders.length > 0
                type Group = { id: string; label: string; color: string | null; params: typeof filteredParameters }
                const groups: Group[] = []
                if (showGroups) {
                  // Ungrouped parameters first, then each named folder
                  const ungrouped = filteredParameters.filter(p => !p.folderId)
                  if (ungrouped.length > 0) groups.push({ id: '__none__', label: 'Ungrouped', color: null, params: ungrouped })
                  for (const folder of folders) {
                    const inFolder = filteredParameters.filter(p => p.folderId === folder.id)
                    if (inFolder.length > 0) groups.push({ id: folder.id, label: folder.name, color: folder.color ?? null, params: inFolder })
                  }
                } else {
                  groups.push({ id: '__all__', label: '', color: null, params: filteredParameters })
                }

                return groups.flatMap(group => {
                  const isCollapsed = collapsedGroups.has(group.id)
                  const groupHeaderRow = showGroups ? (
                    <tr key={`group-${group.id}`} className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-700">
                      <td colSpan={2 + visibleCols.size} className="px-3 py-[5px]">
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
                          <span className="text-[10px] text-gray-600 dark:text-gray-400 font-normal normal-case tracking-normal">
                            ({group.params.length})
                          </span>
                        </button>
                      </td>
                    </tr>
                  ) : null

                  if (isCollapsed) return groupHeaderRow ? [groupHeaderRow] : []

                  const dataRows = group.params.map((param) => {
                const folder = folders.find(f => f.id === param.folderId)
                const parentFolder = folder?.parentId ? folders.find(f => f.id === folder.parentId) : null
                const folderPath = folder
                  ? parentFolder ? `${parentFolder.name} / ${folder.name}` : folder.name
                  : null
                // Show folder badge when: viewing all params, OR viewing a parent folder (params from sub-folders)
                const showFolderBadge = folder && (
                  selectedFolderId === null ||
                  (selectedFolderId !== null && selectedFolderId !== param.folderId)
                )
                const computedVal = formulaResults.get(param.id)
                const isInlineEditing = inlineEditingId === param.id
                return (
                <DraggableRow key={param.id} parameterId={param.id} folderColor={showGroups ? null : folder?.color}>
                  <td className="px-3 py-2 w-8 sticky left-0 z-[1] bg-gray-50 dark:bg-gray-800" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(param.id)}
                      onChange={() => {
                        setSelectedIds(prev => {
                          const next = new Set(prev)
                          if (next.has(param.id)) next.delete(param.id)
                          else next.add(param.id)
                          return next
                        })
                      }}
                      className="cursor-pointer"
                    />
                  </td>
                  <td className="px-3 py-1.5 sticky left-8 z-[1] bg-gray-50 dark:bg-gray-800 shadow-[2px_0_4px_rgba(0,0,0,0.06)]">
                    <button type="button" onClick={() => setDetailParameter(param)}
                      className="bg-transparent border-none cursor-pointer text-blue-600 dark:text-blue-400 font-semibold text-xs p-0 whitespace-nowrap block">
                      {param.name}
                    </button>
                    {showFolderBadge && folderPath && (
                      <span
                        className="inline-flex items-center gap-[3px] text-[10px] mt-px text-gray-600 dark:text-gray-400"
                        style={folder?.color ? { color: folder.color } : undefined} // user-chosen hex
                      >
                        <Folder size={9} className="shrink-0" />
                        {folderPath}
                      </span>
                    )}
                  </td>
                  {visibleCols.has('description') && (
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400 max-w-[200px]">
                      <span className="overflow-hidden block text-ellipsis whitespace-nowrap" title={param.description ?? ''}>
                        {param.description || '—'}
                      </span>
                    </td>
                  )}
                  {visibleCols.has('type') && (
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{param.dataType || '—'}</td>
                  )}
                  {visibleCols.has('value') && (
                    <td
                      className="px-3 py-2 font-mono text-gray-900 dark:text-gray-100 min-w-[80px]"
                      onClick={e => {
                        if (!isInlineEditing) {
                          e.stopPropagation()
                          setInlineEditingId(param.id)
                          setInlineEditValue(param.defaultValue ?? '')
                        }
                      }}
                      title={isInlineEditing ? undefined : 'Click to edit value'}
                    >
                      {isInlineEditing ? (
                        <input
                          autoFocus
                          value={inlineEditValue}
                          onChange={e => setInlineEditValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.stopPropagation(); saveInlineValue(param.id) }
                            if (e.key === 'Escape') { e.stopPropagation(); setInlineEditingId(null) }
                          }}
                          onClick={e => e.stopPropagation()}
                          className="w-full px-1.5 py-0.5 font-mono text-xs border border-blue-600 dark:border-blue-400 rounded bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 outline-none"
                        />
                      ) : (
                        <span className="flex items-center gap-[5px]">
                          <span>{param.defaultValue || '—'}</span>
                          {param.formula && (
                            <span
                              title={param.formula}
                              className="inline-flex items-center justify-center px-1.5 py-px rounded text-[10px] font-bold font-serif italic bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 cursor-default shrink-0"
                            >
                              f
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                  )}
                  {visibleCols.has('computed') && (
                    <td className={clsx(
                      'px-3 py-2 font-mono text-[11px]',
                      computedVal ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400',
                    )}>
                      {computedVal ?? (param.formula ? '…' : '—')}
                    </td>
                  )}
                  {visibleCols.has('unit') && (
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{param.unit || '—'}</td>
                  )}
                  {visibleCols.has('source') && (
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                      {param.sourceFunction ? (
                        <button type="button" onClick={() => setViewingSource(param)}
                          className="bg-transparent border-none cursor-pointer text-blue-600 dark:text-blue-400 text-xs p-0">
                          {param.sourceFunction.functionId || 'N/A'}: {param.sourceFunction.name}
                        </button>
                      ) : '—'}
                    </td>
                  )}
                  {visibleCols.has('status') && (
                    <td className="px-3 py-2">
                      <span className={clsx(
                        'px-[7px] py-0.5 rounded-[10px] text-[10px] font-semibold',
                        (param.status ?? 'draft') === 'approved' && 'bg-green-500/10 text-green-700 dark:text-green-400',
                        (param.status ?? 'draft') === 'obsolete' && 'bg-gray-200/30 dark:bg-gray-400/15 text-gray-600 dark:text-gray-400',
                        (param.status ?? 'draft') === 'draft' && 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
                      )}>
                        {param.status ?? 'draft'}
                      </span>
                    </td>
                  )}
                  {visibleCols.has('usedIn') && (
                    <td className="px-3 py-2">
                      {(param as ParameterWithUsage).requirementCount != null ? (
                        <button type="button" onClick={() => setDetailParameter(param)}
                          className="bg-transparent border-none cursor-pointer text-blue-600 dark:text-blue-400 font-semibold text-xs p-0">
                          {(param as ParameterWithUsage).requirementCount}
                        </button>
                      ) : '—'}
                    </td>
                  )}
                  {visibleCols.has('created') && (
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {format(new Date(param.createdAt), 'MMM dd, yyyy')}
                    </td>
                  )}
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <button onClick={(e) => { e.stopPropagation(); setChangeRequestModal({ isOpen: true, sourceId: param.id, sourceName: param.name }) }}
                        title="Change Request"
                        className="bg-transparent border-none cursor-pointer p-[3px] rounded text-green-500 hover:bg-green-500/10 transition-colors">
                        <FileText size={14} />
                      </button>
                      <button onClick={(e) => handleEditClick(e, param)}
                        title="Edit"
                        className="bg-transparent border-none cursor-pointer p-[3px] rounded text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950 transition-colors">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={(e) => handleDeleteClick(e, param.id, param.name)}
                        disabled={deleteParameterMutation.isPending && deleteConfirmation?.id === param.id}
                        title="Delete"
                        className={clsx(
                          'bg-transparent border-none cursor-pointer p-[3px] rounded text-red-500 hover:bg-red-500/10 transition-colors',
                          deleteParameterMutation.isPending && deleteConfirmation?.id === param.id && 'opacity-40',
                        )}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </DraggableRow>
                )
              })
              return groupHeaderRow ? [groupHeaderRow, ...dataRows] : dataRows
            })
          })()}
            </tbody>
          </table>
        </div>
      </div>
      )}

        </div>{/* end right column */}
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
              style={{ color: folders.find(f => f.id === activeDragFolderId)?.color ?? '#6366f1' }} // user-chosen hex
            />
            {folders.find(f => f.id === activeDragFolderId)?.name ?? 'Folder'}
          </div>
        ) : null}
      </DragOverlay>
      </DndContext>

      {/* ── Subfolder confirmation modal ── */}
      {pendingSubfolder && (() => {
        const child = folders.find(f => f.id === pendingSubfolder.childId)
        const parent = folders.find(f => f.id === pendingSubfolder.parentId)
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
          <ParameterDetailDrawer
            isOpen={!!detailParameter}
            onClose={() => setDetailParameter(null)}
            projectId={projectId}
            parameter={detailParameter}
            onEdit={setEditingParameter}
            allParameters={parameters}
          />
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
  )
}
