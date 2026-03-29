import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Search, X, Trash2, Edit2, Plus, Filter, ChevronDown, ChevronUp,
  FileText, Upload, Download, GitBranch, RefreshCw, CheckCircle,
  AlertTriangle, Settings, Radio, List, Share2,
  Folder, FolderOpen, MoreHorizontal, Layers,
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

import SafetyLinkPanel from '../../components/safety/SafetyLinkPanel'
import { parameterService, type ParameterWithUsage } from '../../services/parameter.service'
import DeleteConfirmationModal from '../../components/projects/DeleteConfirmationModal'
import EditParameterModal from '../../components/parameters/EditParameterModal'
import ParameterDetailDrawer from '../../components/parameters/ParameterDetailDrawer'
import SourceDetailsModal from '../../components/parameters/SourceDetailsModal'
import CreateParameterModal from '../../components/parameters/CreateParameterModal'
import CreateChangeRequestModal from '../../components/changeRequests/CreateChangeRequestModal'
import PublishToGitModal, { type GitPublishStoredConfig } from '../../components/parameters/PublishToGitModal'
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
// DraggableRow — wraps a parameter row so it can be dragged onto a folder
// ---------------------------------------------------------------------------
function DraggableRow({
  parameterId,
  children,
}: {
  parameterId: string
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `param-${parameterId}` })
  return (
    <tr
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.4 : 1, cursor: 'grab', borderBottom: '1px solid var(--theme-border)' }}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--theme-sidebar-item-hover)')}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
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
      style={{
        outline: isOver ? '2px solid var(--theme-accent)' : 'none',
        outlineOffset: -2,
        borderRadius: 6,
        transition: 'outline 0.1s',
      }}
    >
      {children}
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
]

const FORMAT_EXTENSIONS: Record<string, string> = {
  matlab: 'parameters.m', simulink: 'create_parameters_sldd.m', mat: 'create_parameters_mat.m',
  python: 'parameters.py', c_header: 'parameters.h', ada: 'parameters.ads',
  xtce: 'parameters.xtce', autosar: 'parameters.arxml', ros: 'parameters_ros.yaml',
  dds: 'parameters.idl', json: 'parameters.json', yaml: 'parameters.yaml',
  csv: 'parameters.csv', xml: 'parameters.xml',
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
  const folderMenuRef = useRef<HTMLDivElement>(null)

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

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

  // Git publish state
  const gitPublishKey = projectId ? `git-publish-config-${projectId}` : null
  const [storedGitConfig, setStoredGitConfig] = useState<GitPublishStoredConfig | null>(null)
  const [isPublishOpen, setIsPublishOpen] = useState(false)
  const [isBannerSyncing, setIsBannerSyncing] = useState(false)

  // Load persisted Git publish config
  useEffect(() => {
    if (!gitPublishKey) return
    try {
      const stored = localStorage.getItem(gitPublishKey)
      if (stored) setStoredGitConfig(JSON.parse(stored))
    } catch { /* ignore */ }
  }, [gitPublishKey])

  // Direct sync from staleness banner — no modal needed
  const handleBannerSync = async () => {
    if (!projectId || !storedGitConfig || isBannerSyncing) return
    setIsBannerSyncing(true)
    try {
      const res = await parameterService.gitPublishSync(projectId, {
        platform: storedGitConfig.platform,
        baseUrl: storedGitConfig.baseUrl,
        token: storedGitConfig.token,
        repoId: storedGitConfig.repoId,
        branch: storedGitConfig.defaultBranch,
        selectedFormats: storedGitConfig.selectedFormats,
        ...(storedGitConfig.selectedTags?.length ? { selectedTags: storedGitConfig.selectedTags } : {}),
        username: storedGitConfig.username,
        workspace: storedGitConfig.workspace,
        org: storedGitConfig.org,
        project: storedGitConfig.project,
      })
      if (res.success && res.data) {
        const updated: GitPublishStoredConfig = {
          ...storedGitConfig,
          lastSyncedAt: res.data.pushedAt ?? new Date().toISOString(),
          lastCommitSha: res.data.commitSha,
          parameterCount: res.data.parameterCount,
        }
        setStoredGitConfig(updated)
        if (gitPublishKey) localStorage.setItem(gitPublishKey, JSON.stringify(updated))
      } else {
        // Show modal so user can see the error
        setIsPublishOpen(true)
      }
    } catch {
      setIsPublishOpen(true)
    } finally {
      setIsBannerSyncing(false)
    }
  }

  // Close export dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setIsExportOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const { data: parameters = [], isLoading } = useQuery({
    queryKey: ['parameters', projectId, true],
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID required')
      const response = await parameterService.getParameters(projectId, { includeUsageCounts: true })
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
    mutationFn: (name: string) => {
      if (!projectId) throw new Error('Project ID required')
      return parameterService.createFolder(projectId, { name, color: createFolderColor })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parameter-folders', projectId] })
      setCreateFolderName('')
      setCreateFolderColor(FOLDER_COLORS[0])
      setIsCreatingFolder(false)
    },
  })

  const updateFolderMutation = useMutation({
    mutationFn: ({ folderId, data }: { folderId: string; data: { name?: string; color?: string | null } }) => {
      if (!projectId) throw new Error('Project ID required')
      return parameterService.updateFolder(projectId, folderId, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parameter-folders', projectId] })
      setRenamingFolder(null)
    },
  })

  const deleteFolderMutation = useMutation({
    mutationFn: (folderId: string) => {
      if (!projectId) throw new Error('Project ID required')
      return parameterService.deleteFolder(projectId, folderId)
    },
    onSuccess: (_data, folderId) => {
      queryClient.invalidateQueries({ queryKey: ['parameter-folders', projectId] })
      queryClient.invalidateQueries({ queryKey: ['parameters', projectId] })
      if (selectedFolderId === folderId) setSelectedFolderId(null)
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
    if (id.startsWith('param-')) setActiveDragParamId(id.replace('param-', ''))
  }

  const handleDragOver = (event: DragOverEvent) => {
    if (!event.over) { setOverFolderId(null); return }
    const overId = String(event.over.id)
    if (!overId.startsWith('folder-')) { setOverFolderId(null); return }
    // overId is "folder-<actualId>" or "folder-ungrouped"
    setOverFolderId(overId.replace('folder-', ''))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragParamId(null)
    setOverFolderId(null)
    const { active, over } = event
    if (!over) return
    const paramId = String(active.id).replace('param-', '')
    const overId = String(over.id)
    if (overId === 'folder-ungrouped') {
      // Drop on ungrouped zone — remove from any folder
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

  // Apply folder filter first, then search/column filters
  const folderFilteredParameters =
    selectedFolderId === null
      ? parameters
      : selectedFolderId === '__none__'
        ? parameters.filter(p => !p.folderId)
        : parameters.filter(p => p.folderId === selectedFolderId)

  const filteredParameters = folderFilteredParameters.filter((param) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
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

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="space-y-4">

      {/* ── Tab navigation ── */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--theme-border)', paddingBottom: 0 }}>
        {([
          { key: 'parameters', label: 'Parameters', icon: null },
          { key: 'communications', label: 'Communications', icon: <Radio size={13} /> },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 14px', fontSize: 13, fontWeight: 500,
              border: 'none', borderBottom: activeTab === tab.key ? '2px solid var(--theme-accent)' : '2px solid transparent',
              backgroundColor: 'transparent', cursor: 'pointer',
              color: activeTab === tab.key ? 'var(--theme-accent)' : 'var(--theme-text-muted)',
              marginBottom: -1,
            }}
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
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
          borderRadius: 8, border: '1px solid #f59e0b', backgroundColor: 'rgba(245,158,11,0.08)',
          fontSize: 12, color: '#92400e',
        }}>
          <AlertTriangle size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
          <span style={{ flex: 1 }}>Parameters have been updated since the last Git sync.</span>
          <button
            onClick={handleBannerSync}
            disabled={isBannerSyncing}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px',
              borderRadius: 5, border: '1px solid #f59e0b', backgroundColor: '#fef3c7',
              color: '#92400e', fontSize: 11, fontWeight: 600,
              cursor: isBannerSyncing ? 'not-allowed' : 'pointer',
              opacity: isBannerSyncing ? 0.7 : 1,
            }}
          >
            <RefreshCw size={11} style={isBannerSyncing ? { animation: 'spin 1s linear infinite' } : undefined} />
            {isBannerSyncing ? 'Syncing…' : 'Sync Now'}
          </button>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-lg font-bold" style={{ color: 'var(--theme-text)' }}>Parameters</h2>
        <div className="flex flex-wrap items-center gap-2">
          {projectId && <SafetyLinkPanel variant="relevance" count={1} />}

          {/* Settings */}
          {projectId && (
            <Link
              to={`/projects/${projectId}/parameters/settings`}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                border: '1px solid var(--theme-border)',
                backgroundColor: 'var(--theme-surface)',
                color: 'var(--theme-text-muted)',
                textDecoration: 'none',
              }}
              title="Parameter settings — type registry, unit registry"
            >
              <Settings size={13} />
              Settings
            </Link>
          )}

          {/* Publish to Git */}
          <button
            onClick={() => setIsPublishOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
              border: '1px solid var(--theme-border)',
              backgroundColor: 'var(--theme-surface)',
              color: 'var(--theme-text-muted)',
              cursor: 'pointer',
            }}
            title={storedGitConfig ? `Connected: ${storedGitConfig.repoUrl}` : 'Publish parameters to Git'}
          >
            <GitBranch size={13} />
            Publish to Git
            {storedGitConfig && <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: isStale ? '#f59e0b' : '#22c55e', marginLeft: 2 }} />}
          </button>

          {/* Import CSV (dedicated modal with preview) */}
          <button
            onClick={() => setIsCsvImportOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
              border: '1px solid var(--theme-border)',
              backgroundColor: 'var(--theme-surface)',
              color: 'var(--theme-text-muted)',
              cursor: 'pointer',
            }}
          >
            <Upload size={13} />
            Import CSV
          </button>

          {/* Import (all formats) */}
          <button
            onClick={() => { resetImport(); setIsImportOpen(true) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
              border: '1px solid var(--theme-border)',
              backgroundColor: 'var(--theme-surface)',
              color: 'var(--theme-text-muted)',
              cursor: 'pointer',
            }}
          >
            <Upload size={13} />
            Import
          </button>

          {/* Export dropdown */}
          <div ref={exportRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setIsExportOpen(v => !v)}
              disabled={!!exportingFormat}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                border: '1px solid var(--theme-border)',
                backgroundColor: 'var(--theme-surface)',
                color: 'var(--theme-text-muted)',
                cursor: exportingFormat ? 'not-allowed' : 'pointer',
                opacity: exportingFormat ? 0.6 : 1,
              }}
            >
              <Download size={13} />
              {exportingFormat ? 'Exporting…' : 'Export'}
              <ChevronDown size={11} />
            </button>
            {isExportOpen && (
              <div style={{
                position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 200,
                width: 280, borderRadius: 8,
                border: '1px solid var(--theme-border)',
                backgroundColor: 'var(--theme-surface)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                overflow: 'hidden',
              }}>
                {EXPORT_GROUPS.map(group => (
                  <div key={group.label}>
                    <div style={{
                      padding: '6px 12px 4px',
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                      textTransform: 'uppercase', color: 'var(--theme-text-muted)',
                      backgroundColor: 'var(--theme-bg)',
                      borderBottom: '1px solid var(--theme-border)',
                    }}>
                      {group.label}
                    </div>
                    {group.formats.map(f => (
                      <button
                        key={f.key}
                        onClick={() => handleExport(f.key)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          width: '100%', padding: '7px 12px',
                          fontSize: 12, textAlign: 'left',
                          color: 'var(--theme-text)',
                          backgroundColor: 'transparent',
                          border: 'none', cursor: 'pointer',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--theme-sidebar-item-hover)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <Download size={12} style={{ color: 'var(--theme-accent)', flexShrink: 0 }} />
                        {f.label}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* View toggle: List / Graph */}
          <div style={{ display: 'flex', border: '1px solid var(--theme-border)', borderRadius: 6, overflow: 'hidden' }}>
            <button
              onClick={() => setParamViewMode('list')}
              title="List view"
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 10px', fontSize: 12, fontWeight: 500,
                border: 'none', cursor: 'pointer',
                backgroundColor: paramViewMode === 'list' ? 'var(--theme-accent)' : 'var(--theme-surface)',
                color: paramViewMode === 'list' ? '#fff' : 'var(--theme-text-muted)',
                borderRight: '1px solid var(--theme-border)',
              }}
            >
              <List size={13} />
              List
            </button>
            <button
              onClick={() => setParamViewMode('graph')}
              title="Dependency graph view"
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 10px', fontSize: 12, fontWeight: 500,
                border: 'none', cursor: 'pointer',
                backgroundColor: paramViewMode === 'graph' ? 'var(--theme-accent)' : 'var(--theme-surface)',
                color: paramViewMode === 'graph' ? '#fff' : 'var(--theme-text-muted)',
              }}
            >
              <Share2 size={13} />
              Graph
            </button>
          </div>

          {/* Create */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
              border: 'none', backgroundColor: 'var(--theme-accent)', color: '#fff', cursor: 'pointer',
            }}
          >
            <Plus size={13} />
            New Parameter
          </button>
        </div>
      </div>

      {/* ── Search ── */}
      <div style={{
        borderRadius: 8, border: '1px solid var(--theme-border)',
        backgroundColor: 'var(--theme-surface)', padding: 12,
      }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--theme-text-muted)' }} />
          <input
            type="text"
            placeholder="Search parameters…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%', paddingLeft: 32, paddingRight: searchQuery ? 32 : 10,
              paddingTop: 6, paddingBottom: 6,
              border: '1px solid var(--theme-border)', borderRadius: 6,
              backgroundColor: 'var(--theme-bg)', color: 'var(--theme-text)',
              fontSize: 12, outline: 'none', boxSizing: 'border-box',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-text-muted)', padding: 0 }}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ── Filters ── */}
      <div style={{ borderRadius: 8, border: '1px solid var(--theme-border)', backgroundColor: 'var(--theme-surface)', overflow: 'hidden' }}>
        <button
          onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Filter size={13} style={{ color: 'var(--theme-text-muted)' }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--theme-text)' }}>Filters</span>
          </div>
          {isFiltersExpanded
            ? <ChevronUp size={14} style={{ color: 'var(--theme-text-muted)' }} />
            : <ChevronDown size={14} style={{ color: 'var(--theme-text-muted)' }} />
          }
        </button>
        {isFiltersExpanded && (
          <div style={{ padding: '10px 14px', borderTop: '1px solid var(--theme-border)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
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
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--theme-text-muted)', marginBottom: 4 }}>{filter.label}</label>
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
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>

        {/* ── Folder sidebar ── */}
        {isFolderSidebarOpen ? (
          <div style={{
            width: 200, flexShrink: 0,
            borderRadius: 8, border: '1px solid var(--theme-border)',
            backgroundColor: 'var(--theme-surface)',
            overflow: 'hidden',
          }}>
            {/* Sidebar header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 10px', borderBottom: '1px solid var(--theme-border)',
              backgroundColor: 'var(--theme-bg)',
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--theme-text-muted)' }}>Folders</span>
              <button
                onClick={() => setIsFolderSidebarOpen(false)}
                title="Collapse sidebar"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-text-muted)', padding: 2, display: 'flex', alignItems: 'center' }}
              >
                <ChevronDown size={12} style={{ transform: 'rotate(90deg)' }} />
              </button>
            </div>
            <div style={{ padding: '4px 4px' }}>
              {/* All Parameters */}
              <button
                onClick={() => setSelectedFolderId(null)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 8px', borderRadius: 5, fontSize: 12, fontWeight: 500,
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                  backgroundColor: selectedFolderId === null ? 'var(--theme-sidebar-item-active)' : 'transparent',
                  color: selectedFolderId === null ? 'var(--theme-accent)' : 'var(--theme-text)',
                }}
              >
                <Layers size={13} style={{ flexShrink: 0, color: selectedFolderId === null ? 'var(--theme-accent)' : 'var(--theme-text-muted)' }} />
                <span style={{ flex: 1 }}>All Parameters</span>
                <span style={{ fontSize: 10, color: 'var(--theme-text-muted)' }}>{parameters.length}</span>
              </button>
              {/* Ungrouped — droppable zone */}
              <DroppableFolder folderId="ungrouped" isOver={overFolderId === 'ungrouped'}>
                <button
                  onClick={() => setSelectedFolderId('__none__')}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 8px', borderRadius: 5, fontSize: 12, fontWeight: 500,
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    backgroundColor: selectedFolderId === '__none__' ? 'var(--theme-sidebar-item-active)' : 'transparent',
                    color: selectedFolderId === '__none__' ? 'var(--theme-accent)' : 'var(--theme-text-muted)',
                  }}
                >
                  <Folder size={13} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>Ungrouped</span>
                  <span style={{ fontSize: 10 }}>{parameters.filter(p => !p.folderId).length}</span>
                </button>
              </DroppableFolder>
              {/* Named folders */}
              {folders.map(folder => {
                const isSelected = selectedFolderId === folder.id
                const isMenuOpen = folderMenuOpen === folder.id
                const isRenaming = renamingFolder?.id === folder.id
                return (
                  <DroppableFolder key={folder.id} folderId={folder.id} isOver={overFolderId === folder.id}>
                    <div
                      style={{
                        display: 'flex', alignItems: 'center',
                        borderRadius: 5,
                        backgroundColor: isSelected ? 'var(--theme-sidebar-item-active)' : 'transparent',
                      }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.backgroundColor = 'var(--theme-sidebar-item-hover)' }}
                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent' }}
                    >
                      {isRenaming ? (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px' }}>
                          {/* Color picker */}
                          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', width: 90 }}>
                            {FOLDER_COLORS.map(c => (
                              <button key={c} onClick={() => setRenamingColor(c)}
                                style={{ width: 12, height: 12, borderRadius: '50%', border: renamingColor === c ? '2px solid var(--theme-text)' : '1px solid transparent', backgroundColor: c, cursor: 'pointer', padding: 0 }} />
                            ))}
                          </div>
                          <input
                            autoFocus
                            value={renamingFolder?.name ?? ''}
                            onChange={e => setRenamingFolder({ id: folder.id, name: e.target.value })}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && renamingFolder) {
                                updateFolderMutation.mutate({ folderId: folder.id, data: { name: renamingFolder.name, color: renamingColor } })
                              }
                              if (e.key === 'Escape') setRenamingFolder(null)
                            }}
                            style={{
                              flex: 1, fontSize: 11, padding: '2px 5px',
                              border: '1px solid var(--theme-border)', borderRadius: 4,
                              backgroundColor: 'var(--theme-bg)', color: 'var(--theme-text)',
                            }}
                          />
                          <button onClick={() => setRenamingFolder(null)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-text-muted)', padding: 1 }}>
                            <X size={11} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => setSelectedFolderId(folder.id)}
                            style={{
                              flex: 1, display: 'flex', alignItems: 'center', gap: 6,
                              padding: '6px 8px', fontSize: 12, fontWeight: 500,
                              border: 'none', cursor: 'pointer', textAlign: 'left', background: 'none',
                              color: isSelected ? 'var(--theme-accent)' : 'var(--theme-text)',
                            }}
                          >
                            <FolderOpen size={13} style={{ flexShrink: 0, color: folder.color ?? '#6366f1' }} />
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {folder.name}
                            </span>
                            <span style={{ fontSize: 10, color: 'var(--theme-text-muted)' }}>
                              {folder._count?.parameters ?? 0}
                            </span>
                          </button>
                          {/* Context menu trigger */}
                          <div style={{ position: 'relative' }} ref={folderMenuOpen === folder.id ? folderMenuRef : undefined}>
                            <button
                              onClick={e => { e.stopPropagation(); setFolderMenuOpen(isMenuOpen ? null : folder.id); setRenamingColor(folder.color ?? FOLDER_COLORS[0]) }}
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                padding: '4px 5px', color: 'var(--theme-text-muted)',
                                opacity: isMenuOpen ? 1 : 0,
                                borderRadius: 4,
                              }}
                              className="folder-menu-btn"
                              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
                              onMouseLeave={e => { if (!isMenuOpen) (e.currentTarget as HTMLButtonElement).style.opacity = '0' }}
                            >
                              <MoreHorizontal size={12} />
                            </button>
                            {isMenuOpen && (
                              <div style={{
                                position: 'absolute', right: 0, top: '100%', zIndex: 300,
                                width: 140, borderRadius: 6,
                                border: '1px solid var(--theme-border)',
                                backgroundColor: 'var(--theme-surface)',
                                boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                                overflow: 'hidden',
                              }}>
                                <button
                                  onClick={() => { setRenamingFolder({ id: folder.id, name: folder.name }); setFolderMenuOpen(null) }}
                                  style={{
                                    width: '100%', display: 'flex', alignItems: 'center', gap: 7,
                                    padding: '7px 10px', fontSize: 12, border: 'none', cursor: 'pointer',
                                    backgroundColor: 'transparent', color: 'var(--theme-text)', textAlign: 'left',
                                  }}
                                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--theme-sidebar-item-hover)')}
                                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                                >
                                  <Edit2 size={11} /> Rename
                                </button>
                                <button
                                  onClick={() => { deleteFolderMutation.mutate(folder.id); setFolderMenuOpen(null) }}
                                  style={{
                                    width: '100%', display: 'flex', alignItems: 'center', gap: 7,
                                    padding: '7px 10px', fontSize: 12, border: 'none', cursor: 'pointer',
                                    backgroundColor: 'transparent', color: '#ef4444', textAlign: 'left',
                                  }}
                                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.06)')}
                                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                                >
                                  <Trash2 size={11} /> Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </DroppableFolder>
                )
              })}
              {/* New folder */}
              {isCreatingFolder ? (
                <div style={{ padding: '6px 6px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {FOLDER_COLORS.map(c => (
                      <button key={c} onClick={() => setCreateFolderColor(c)}
                        style={{ width: 14, height: 14, borderRadius: '50%', border: createFolderColor === c ? '2px solid var(--theme-text)' : '1px solid transparent', backgroundColor: c, cursor: 'pointer', padding: 0 }} />
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
                    style={{
                      width: '100%', fontSize: 11, padding: '4px 7px',
                      border: '1px solid var(--theme-border)', borderRadius: 4,
                      backgroundColor: 'var(--theme-bg)', color: 'var(--theme-text)',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={() => { if (createFolderName.trim()) createFolderMutation.mutate(createFolderName.trim()) }}
                      disabled={!createFolderName.trim()}
                      style={{ flex: 1, padding: '3px 0', fontSize: 11, fontWeight: 600, borderRadius: 4, border: 'none', backgroundColor: 'var(--theme-accent)', color: '#fff', cursor: createFolderName.trim() ? 'pointer' : 'not-allowed', opacity: createFolderName.trim() ? 1 : 0.5 }}
                    >
                      Create
                    </button>
                    <button
                      onClick={() => { setIsCreatingFolder(false); setCreateFolderName('') }}
                      style={{ padding: '3px 7px', fontSize: 11, borderRadius: 4, border: '1px solid var(--theme-border)', backgroundColor: 'var(--theme-surface)', color: 'var(--theme-text)', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsCreatingFolder(true)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 8px', borderRadius: 5, fontSize: 11, fontWeight: 500,
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    backgroundColor: 'transparent', color: 'var(--theme-text-muted)',
                    marginTop: 2,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--theme-sidebar-item-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
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
            style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 24, minHeight: 40, borderRadius: 6,
              border: '1px solid var(--theme-border)',
              backgroundColor: 'var(--theme-surface)',
              cursor: 'pointer', color: 'var(--theme-text-muted)',
            }}
          >
            <Folder size={13} />
          </button>
        )}

        {/* ── Right: tip / graph / bulk bar / table ── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Info / tip ── */}
      {parameters.length === 0 && !isLoading && (
        <div style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--theme-border)', backgroundColor: 'var(--theme-surface)', fontSize: 12, color: 'var(--theme-text-muted)' }}>
          <strong>Tip:</strong> Parameters are automatically extracted when you use the pattern <code style={{ backgroundColor: 'var(--theme-sidebar-item-active)', padding: '1px 4px', borderRadius: 3 }}>@parameterName@</code> in function descriptions.
          You can also import an existing parameter set using the <strong>Import</strong> button.
        </div>
      )}

      {/* ── Dependency Graph view ── */}
      {paramViewMode === 'graph' && (
        <div style={{ borderRadius: 8, border: '1px solid var(--theme-border)', backgroundColor: 'var(--theme-surface)', overflow: 'hidden' }}>
          <ParameterDependencyGraph parameters={filteredParameters} />
        </div>
      )}

      {/* ── Bulk action toolbar ── */}
      {selectedIds.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          padding: '8px 12px', borderRadius: 8,
          border: '1px solid var(--theme-accent)',
          backgroundColor: 'var(--theme-accent-subtle)',
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--theme-text)', marginRight: 4 }}>
            {selectedIds.size} selected
          </span>
          <button
            onClick={() => bulkUpdateMutation.mutate({ ids: Array.from(selectedIds), updates: { status: 'approved' } })}
            disabled={bulkUpdateMutation.isPending}
            style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '1px solid rgba(34,197,94,0.4)', backgroundColor: 'rgba(34,197,94,0.12)', color: '#15803d' }}
          >
            Approve
          </button>
          <button
            onClick={() => bulkUpdateMutation.mutate({ ids: Array.from(selectedIds), updates: { status: 'draft' } })}
            disabled={bulkUpdateMutation.isPending}
            style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '1px solid rgba(245,158,11,0.4)', backgroundColor: 'rgba(245,158,11,0.12)', color: '#b45309' }}
          >
            Set Draft
          </button>
          <button
            onClick={() => bulkUpdateMutation.mutate({ ids: Array.from(selectedIds), updates: { status: 'obsolete' } })}
            disabled={bulkUpdateMutation.isPending}
            style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '1px solid var(--theme-border)', backgroundColor: 'var(--theme-surface)', color: 'var(--theme-text-muted)' }}
          >
            Obsolete
          </button>
          {!bulkDeleteConfirm ? (
            <button
              onClick={() => setBulkDeleteConfirm(true)}
              style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '1px solid rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.08)', color: '#ef4444' }}
            >
              Delete
            </button>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 500 }}>Are you sure?</span>
              <button
                onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
                disabled={bulkDeleteMutation.isPending}
                style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', backgroundColor: '#ef4444', color: '#fff' }}
              >
                Confirm
              </button>
              <button
                onClick={() => setBulkDeleteConfirm(false)}
                style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '1px solid var(--theme-border)', backgroundColor: 'var(--theme-surface)', color: 'var(--theme-text)' }}
              >
                Cancel
              </button>
            </span>
          )}
          <span style={{ flex: 1 }} />
          <button
            onClick={() => { setSelectedIds(new Set()); setBulkDeleteConfirm(false) }}
            title="Clear selection"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-text-muted)', padding: 2, display: 'flex', alignItems: 'center' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Table ── */}
      {paramViewMode === 'list' && <DndContext
        sensors={dndSensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
      <div style={{ borderRadius: 8, border: '1px solid var(--theme-border)', backgroundColor: 'var(--theme-surface)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--theme-bg)', borderBottom: '1px solid var(--theme-border)' }}>
                <th style={{ padding: '8px 12px', width: 32 }}>
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
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                {['Parameter', 'Description', 'Type', 'Value', 'Unit', 'Source', 'Status', 'Used in', 'Created', ''].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--theme-text-muted)', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={11} style={{ padding: '32px 12px', textAlign: 'center', color: 'var(--theme-text-muted)' }}>Loading parameters…</td></tr>
              ) : filteredParameters.length === 0 ? (
                <tr><td colSpan={11} style={{ padding: '32px 12px', textAlign: 'center', color: 'var(--theme-text-muted)' }}>
                  {parameters.length === 0 ? 'No parameters yet. Create one or import a file.' : 'No parameters match your filters.'}
                </td></tr>
              ) : filteredParameters.map((param) => (
                <DraggableRow key={param.id} parameterId={param.id}>
                  <td style={{ padding: '8px 12px', width: 32 }} onClick={e => e.stopPropagation()}>
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
                      style={{ cursor: 'pointer' }}
                    />
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <button type="button" onClick={() => setDetailParameter(param)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-accent)', fontWeight: 600, fontSize: 12, padding: 0 }}>
                      {param.name}
                    </button>
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--theme-text-muted)', maxWidth: 200 }}>
                    <span style={{ overflow: 'hidden', display: 'block', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={param.description ?? ''}>
                      {param.description || '—'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--theme-text-muted)' }}>{param.dataType || '—'}</td>
                  <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: 'var(--theme-text)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span>{param.defaultValue || '—'}</span>
                      {param.formula && (
                        <span
                          title={param.formula}
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            padding: '1px 5px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                            fontFamily: 'serif', fontStyle: 'italic',
                            backgroundColor: 'rgba(245,158,11,0.12)',
                            color: '#b45309',
                            border: '1px solid rgba(245,158,11,0.3)',
                            cursor: 'default',
                            flexShrink: 0,
                          }}
                        >
                          f
                        </span>
                      )}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--theme-text-muted)' }}>{param.unit || '—'}</td>
                  <td style={{ padding: '8px 12px', color: 'var(--theme-text-muted)' }}>
                    {param.sourceFunction ? (
                      <button type="button" onClick={() => setViewingSource(param)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-accent)', fontSize: 12, padding: 0 }}>
                        {param.sourceFunction.functionId || 'N/A'}: {param.sourceFunction.name}
                      </button>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{
                      padding: '2px 7px', borderRadius: 10, fontSize: 10, fontWeight: 600,
                      backgroundColor: (param.status ?? 'draft') === 'approved' ? 'rgba(34,197,94,0.12)' : (param.status ?? 'draft') === 'obsolete' ? 'var(--theme-sidebar-item-active)' : 'rgba(245,158,11,0.12)',
                      color: (param.status ?? 'draft') === 'approved' ? '#15803d' : (param.status ?? 'draft') === 'obsolete' ? 'var(--theme-text-muted)' : '#b45309',
                    }}>
                      {param.status ?? 'draft'}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    {(param as ParameterWithUsage).requirementCount != null ? (
                      <button type="button" onClick={() => setDetailParameter(param)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-accent)', fontWeight: 600, fontSize: 12, padding: 0 }}>
                        {(param as ParameterWithUsage).requirementCount}
                      </button>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--theme-text-muted)', whiteSpace: 'nowrap' }}>
                    {format(new Date(param.createdAt), 'MMM dd, yyyy')}
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button onClick={(e) => { e.stopPropagation(); setChangeRequestModal({ isOpen: true, sourceId: param.id, sourceName: param.name }) }}
                        title="Change Request" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, borderRadius: 4, color: '#22c55e' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(34,197,94,0.1)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                        <FileText size={14} />
                      </button>
                      <button onClick={(e) => handleEditClick(e, param)}
                        title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, borderRadius: 4, color: 'var(--theme-accent)' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--theme-accent-subtle)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                        <Edit2 size={14} />
                      </button>
                      <button onClick={(e) => handleDeleteClick(e, param.id, param.name)}
                        disabled={deleteParameterMutation.isPending && deleteConfirmation?.id === param.id}
                        title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, borderRadius: 4, color: '#ef4444', opacity: (deleteParameterMutation.isPending && deleteConfirmation?.id === param.id) ? 0.4 : 1 }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </DraggableRow>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <DragOverlay>
        {activeDragParamId ? (
          <div style={{
            padding: '6px 12px', borderRadius: 6,
            backgroundColor: 'var(--theme-accent)', color: '#fff',
            fontSize: 12, fontWeight: 600, opacity: 0.9,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          }}>
            {parameters.find(p => p.id === activeDragParamId)?.name ?? 'Parameter'}
          </div>
        ) : null}
      </DragOverlay>
      </DndContext>}

        </div>{/* end right column */}
      </div>{/* end folders + content layout */}

      {/* ── Import Modal ── */}
      {isImportOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20,
        }} onClick={() => setIsImportOpen(false)}>
          <div style={{
            backgroundColor: 'var(--theme-bg)', borderRadius: 10,
            border: '1px solid var(--theme-border)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.24)',
            width: '100%', maxWidth: 560, maxHeight: '80vh',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--theme-border)' }}>
              <Upload size={16} style={{ color: 'var(--theme-accent)' }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--theme-text)' }}>Import Parameters</span>
              <span style={{ flex: 1 }} />
              <button onClick={() => setIsImportOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--theme-text-muted)', padding: 4 }}><X size={16} /></button>
            </div>

            <div style={{ padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {importResult ? (
                /* Success view */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 8, backgroundColor: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                    <CheckCircle size={18} style={{ color: '#22c55e' }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--theme-text)' }}>Import complete</div>
                      <div style={{ fontSize: 12, color: 'var(--theme-text-muted)' }}>
                        {importResult.imported} created · {importResult.updated} updated
                        {importResult.errors.length > 0 && ` · ${importResult.errors.length} errors`}
                      </div>
                    </div>
                  </div>
                  {importResult.warnings.length > 0 && (
                    <div style={{ fontSize: 11, color: '#b45309', backgroundColor: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 6, padding: '8px 10px' }}>
                      {importResult.warnings.map((w, i) => <div key={i}>{w}</div>)}
                    </div>
                  )}
                  {importResult.errors.length > 0 && (
                    <div style={{ fontSize: 11, color: '#b91c1c', backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '8px 10px' }}>
                      {importResult.errors.map((e, i) => <div key={i}>{e}</div>)}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { resetImport() }}
                      style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, border: '1px solid var(--theme-border)', backgroundColor: 'var(--theme-surface)', color: 'var(--theme-text)', cursor: 'pointer' }}>
                      Import another file
                    </button>
                    <button onClick={() => setIsImportOpen(false)}
                      style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', backgroundColor: 'var(--theme-accent)', color: '#fff', cursor: 'pointer' }}>
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                /* Upload form */
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--theme-text-muted)', marginBottom: 6 }}>File</label>
                    <label style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      padding: '20px 16px', borderRadius: 8,
                      border: '2px dashed var(--theme-border)',
                      backgroundColor: 'var(--theme-surface)', cursor: 'pointer',
                      fontSize: 12, color: 'var(--theme-text-muted)',
                    }}>
                      <Upload size={16} />
                      {importFilename ? importFilename : 'Click to upload or drop a file'}
                      <input type="file" accept=".csv,.json,.h,.hpp,.m" onChange={handleFileChange} style={{ display: 'none' }} />
                    </label>
                    <p style={{ fontSize: 11, color: 'var(--theme-text-muted)', marginTop: 5 }}>Supported: CSV, JSON, C/C++ header (.h), MATLAB script (.m)</p>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--theme-text-muted)', marginBottom: 6 }}>Format <span style={{ fontWeight: 400 }}>(auto-detected from extension)</span></label>
                    <select className="settings-input" value={importFormat} onChange={e => setImportFormat(e.target.value)}>
                      <option value="">Auto-detect</option>
                      {IMPORT_FORMATS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </select>
                  </div>

                  {!importFilename && (
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--theme-text-muted)', marginBottom: 6 }}>Or paste content</label>
                      <textarea
                        value={importContent}
                        onChange={e => setImportContent(e.target.value)}
                        placeholder="Paste CSV, JSON, C header, or MATLAB content here…"
                        rows={8}
                        style={{
                          width: '100%', fontFamily: 'monospace', fontSize: 11,
                          padding: '8px 10px', borderRadius: 6,
                          border: '1px solid var(--theme-border)',
                          backgroundColor: 'var(--theme-bg)', color: 'var(--theme-text)',
                          resize: 'vertical', boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={() => setIsImportOpen(false)}
                      style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 500, border: '1px solid var(--theme-border)', backgroundColor: 'var(--theme-surface)', color: 'var(--theme-text)', cursor: 'pointer' }}>
                      Cancel
                    </button>
                    <button onClick={handleImport} disabled={isImporting || !importContent}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', backgroundColor: 'var(--theme-accent)', color: '#fff', cursor: (!importContent || isImporting) ? 'not-allowed' : 'pointer', opacity: (!importContent || isImporting) ? 0.5 : 1 }}>
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
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 2000,
          padding: '10px 18px', borderRadius: 8,
          backgroundColor: 'var(--theme-text)', color: 'var(--theme-bg)',
          fontSize: 13, fontWeight: 500,
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          pointerEvents: 'none',
        }}>
          {toastMessage}
        </div>
      )}
    </div>
  )
}
