import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FolderPlus, Folder, Trash2, Edit2, Plus, ArrowLeft, Table, Search, Copy, X, Check } from 'lucide-react'
import clsx from 'clsx'
import { traceabilityViewsService, type SavedViewFolder, type TraceabilitySavedView } from '../../services/traceabilityViews.service'
import TraceabilityMatrix from '../../components/requirements/TraceabilityMatrix'
import CreateTraceabilityViewModal from '../../components/requirements/CreateTraceabilityViewModal'
import { LINKAGE_TARGET_OPTIONS } from '../../linkage/requirementLinkDialogConfig'

type FolderNode = SavedViewFolder & { children: FolderNode[] }

function buildFolderTree(folders: SavedViewFolder[]): FolderNode[] {
  const byId = new Map<string, FolderNode>()
  for (const f of folders) byId.set(f.id, { ...f, children: [] })
  const roots: FolderNode[] = []
  for (const f of byId.values()) {
    const pid = f.parentId
    if (pid && byId.has(pid)) byId.get(pid)!.children.push(f)
    else roots.push(f)
  }
  const sort = (a: FolderNode, b: FolderNode) =>
    (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)
  const walk = (nodes: FolderNode[]) => {
    nodes.sort(sort)
    for (const n of nodes) walk(n.children)
  }
  walk(roots)
  return roots
}

export default function TraceabilityViewsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [selectedFolderKey, setSelectedFolderKey] = useState<'all' | 'unfiled' | string>('unfiled')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [viewModal, setViewModal] = useState<
    | { open: true; mode: 'create' | 'edit' | 'duplicate'; view?: TraceabilitySavedView | null }
    | { open: false }
  >({ open: false })
  const [openMatrixView, setOpenMatrixView] = useState<TraceabilitySavedView | null>(null)
  const [previewViewId, setPreviewViewId] = useState<string | null>(null)

  const [viewSearch, setViewSearch] = useState('')
  const [sortKey, setSortKey] = useState<'updated_desc' | 'updated_asc' | 'name_asc' | 'name_desc'>('updated_desc')
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>('all')
  const [suspectOnlyFilter, setSuspectOnlyFilter] = useState<'all' | 'suspect_only'>('all')

  const [folderModal, setFolderModal] = useState<
    | { open: true; mode: 'create' | 'rename' | 'delete'; folder?: SavedViewFolder | null; parentId?: string | null }
    | { open: false }
  >({ open: false })
  const [folderNameDraft, setFolderNameDraft] = useState('')

  const [deleteViewModal, setDeleteViewModal] = useState<{ open: true; view: TraceabilitySavedView } | { open: false }>({
    open: false,
  })

  const { data: folders = [], isLoading: loadingFolders } = useQuery({
    queryKey: ['traceability-view-folders', projectId],
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID required')
      const r = await traceabilityViewsService.getFolders(projectId)
      if (r.success && r.data) return r.data
      throw new Error(r.error || 'Failed to load folders')
    },
    enabled: !!projectId,
  })

  const folderTree = useMemo(() => buildFolderTree(folders), [folders])

  const folderIdFilter = selectedFolderKey === 'unfiled' ? null : selectedFolderKey === 'all' ? undefined : selectedFolderKey
  const { data: views = [], isLoading: loadingViews } = useQuery({
    queryKey: ['traceability-views', projectId, folderIdFilter],
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID required')
      const r = await traceabilityViewsService.getViews(projectId, folderIdFilter)
      if (r.success && r.data) return r.data
      throw new Error(r.error || 'Failed to load views')
    },
    enabled: !!projectId,
  })

  const { data: allViewsForCounts = [] } = useQuery({
    queryKey: ['traceability-views-all', projectId],
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID required')
      const r = await traceabilityViewsService.getViews(projectId, undefined)
      return r.success && r.data ? r.data : []
    },
    enabled: !!projectId,
  })

  const createFolderMutation = useMutation({
    mutationFn: async (data: { name: string; parentId?: string | null }) => {
      if (!projectId) throw new Error('Project ID required')
      return traceabilityViewsService.createFolder(projectId, data)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['traceability-view-folders', projectId] }),
  })

  const updateFolderMutation = useMutation({
    mutationFn: async (data: { folderId: string; name: string }) => {
      if (!projectId) throw new Error('Project ID required')
      return traceabilityViewsService.updateFolder(projectId, data.folderId, { name: data.name })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['traceability-view-folders', projectId] }),
  })

  const deleteFolderMutation = useMutation({
    mutationFn: async (folderId: string) => {
      if (!projectId) throw new Error('Project ID required')
      return traceabilityViewsService.deleteFolder(projectId, folderId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['traceability-view-folders', projectId] })
      queryClient.invalidateQueries({ queryKey: ['traceability-views', projectId] })
      if (selectedFolderKey !== 'unfiled') setSelectedFolderKey('unfiled')
    },
  })

  const deleteViewMutation = useMutation({
    mutationFn: async (viewId: string) => {
      if (!projectId) throw new Error('Project ID required')
      return traceabilityViewsService.deleteView(projectId, viewId)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['traceability-views', projectId, folderIdFilter] }),
  })

  const moveViewMutation = useMutation({
    mutationFn: async (data: { viewId: string; folderId: string | null }) => {
      if (!projectId) throw new Error('Project ID required')
      return traceabilityViewsService.updateView(projectId, data.viewId, { folderId: data.folderId })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['traceability-views', projectId] })
      queryClient.invalidateQueries({ queryKey: ['traceability-views-all', projectId] })
    },
  })

  const toggleExpanded = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }))

  const safeParseDefinition = (definitionJson: string | null | undefined) => {
    if (!definitionJson) return null
    try {
      const parsed = JSON.parse(definitionJson) as any
      if (parsed && parsed.viewKind === 'traceability_matrix') return parsed
    } catch {
      // ignore
    }
    return null
  }

  const summarize = (v: TraceabilitySavedView): string => {
    const def = safeParseDefinition(v.definitionJson)
    if (!def) return 'No definition'
    const targetLabel =
      LINKAGE_TARGET_OPTIONS.find((o) => o.value === def.linkageTargetType)?.label ?? String(def.linkageTargetType ?? 'Target')
    const rowBits = def.rowMode ? `${def.rowMode}${Array.isArray(def.pinnedRequirementIds) && def.pinnedRequirementIds.length ? ` (${def.pinnedRequirementIds.length} pinned)` : ''}` : '—'
    const colBits = def.colMode ? `${def.colMode}${Array.isArray(def.pinnedTargetIds) && def.pinnedTargetIds.length ? ` (${def.pinnedTargetIds.length} pinned)` : ''}` : '—'
    const linked = def.filterLinked && def.filterLinked !== 'all' ? ` • ${def.filterLinked}` : ''
    const suspect = def.showSuspectOnly ? ' • suspect only' : ''
    return `${targetLabel} • Rows: ${rowBits} • Cols: ${colBits}${linked}${suspect}`
  }

  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = { unfiled: 0 }
    for (const v of allViewsForCounts) {
      const fid = (v.folderId ?? '') || 'unfiled'
      counts[fid] = (counts[fid] ?? 0) + 1
    }
    return counts
  }, [allViewsForCounts])

  const filteredSortedViews = useMemo(() => {
    const q = viewSearch.trim().toLowerCase()
    let list = [...views]
    if (q) list = list.filter((v) => (v.name ?? '').toLowerCase().includes(q))
    if (targetTypeFilter !== 'all') {
      list = list.filter((v) => {
        const def = safeParseDefinition(v.definitionJson)
        return String(def?.linkageTargetType ?? '') === targetTypeFilter
      })
    }
    if (suspectOnlyFilter === 'suspect_only') {
      list = list.filter((v) => !!safeParseDefinition(v.definitionJson)?.showSuspectOnly)
    }
    const cmp = (a: TraceabilitySavedView, b: TraceabilitySavedView) => {
      if (sortKey === 'name_asc') return (a.name ?? '').localeCompare(b.name ?? '')
      if (sortKey === 'name_desc') return (b.name ?? '').localeCompare(a.name ?? '')
      const ta = new Date(String(a.updatedAt)).getTime()
      const tb = new Date(String(b.updatedAt)).getTime()
      if (sortKey === 'updated_asc') return ta - tb
      return tb - ta
    }
    list.sort(cmp)
    return list
  }, [views, viewSearch, sortKey, targetTypeFilter, suspectOnlyFilter])

  const renderFolderNode = (n: FolderNode, depth = 0) => {
    const isOpen = !!expanded[n.id]
    const isSelected = selectedFolderKey === n.id
    return (
      <div key={n.id}>
        <div
          className={clsx(
            'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/60',
            isSelected && 'bg-blue-50 dark:bg-blue-900/25'
          )}
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => setSelectedFolderKey(n.id)}
        >
          <button
            className="shrink-0 text-gray-500 dark:text-gray-400"
            onClick={(e) => {
              e.stopPropagation()
              toggleExpanded(n.id)
            }}
            title={isOpen ? 'Collapse' : 'Expand'}
          >
            <Folder size={16} />
          </button>
          <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 truncate">{n.name}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {folderCounts[n.id] ?? 0}
          </span>
          <button
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
            title="Rename folder"
            onClick={(e) => {
              e.stopPropagation()
              setFolderNameDraft(n.name)
              setFolderModal({ open: true, mode: 'rename', folder: n })
            }}
          >
            <Edit2 size={14} className="text-gray-500 dark:text-gray-400" />
          </button>
          <button
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
            title="Delete folder"
            onClick={(e) => {
              e.stopPropagation()
              setFolderModal({ open: true, mode: 'delete', folder: n })
            }}
          >
            <Trash2 size={14} className="text-red-600" />
          </button>
        </div>
        {isOpen && n.children.length > 0 && (
          <div className="mt-1">
            {n.children.map((c) => renderFolderNode(c, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  if (!projectId) {
    return <div className="p-6 text-gray-600 dark:text-gray-300">Project ID missing.</div>
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/projects/${projectId}/requirements`)}
            className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm flex items-center gap-2"
          >
            <ArrowLeft size={16} />
            Back to Requirements
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Table size={18} />
              Saved Traceability Views
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Project-shared custom traceability matrices.</p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 max-w-2xl leading-relaxed">
              Supports recurring coverage and bidirectional trace reviews (ISO/IEC/IEEE 29148; DO-178C/DO-254 and ARP4754A themes)
              per your verification and allocation plan.
            </p>
          </div>
        </div>
        <button
          onClick={() => setViewModal({ open: true, mode: 'create', view: null })}
          className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm flex items-center gap-2"
        >
          <Plus size={16} />
          Create view
        </button>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-4 lg:col-span-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="text-sm font-medium text-gray-800 dark:text-gray-200">Folders</div>
            <button
              className="px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-sm flex items-center gap-1"
              onClick={() => {
                setFolderNameDraft('')
                setFolderModal({
                  open: true,
                  mode: 'create',
                  parentId: selectedFolderKey === 'unfiled' || selectedFolderKey === 'all' ? null : selectedFolderKey,
                })
              }}
              title="New folder"
            >
              <FolderPlus size={16} />
              New
            </button>
          </div>
          <div className="p-2 space-y-1 max-h-[70vh] overflow-auto">
            <button
              className={clsx(
                'w-full text-left flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700/60',
                selectedFolderKey === 'all' && 'bg-blue-50 dark:bg-blue-900/25'
              )}
              onClick={() => setSelectedFolderKey('all')}
            >
              <div className="flex items-center gap-2">
                <Table size={16} className="text-gray-500 dark:text-gray-400" />
                <span className="text-sm text-gray-800 dark:text-gray-200">All views</span>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">{allViewsForCounts.length}</span>
            </button>
            <button
              className={clsx(
                'w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700/60',
                selectedFolderKey === 'unfiled' && 'bg-blue-50 dark:bg-blue-900/25'
              )}
              onClick={() => setSelectedFolderKey('unfiled')}
            >
              <Folder size={16} className="text-gray-500 dark:text-gray-400" />
              <span className="text-sm text-gray-800 dark:text-gray-200">Unfiled</span>
              <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">{folderCounts.unfiled ?? 0}</span>
            </button>
            {loadingFolders ? (
              <div className="p-2 text-sm text-gray-500">Loading folders…</div>
            ) : (
              folderTree.map((n) => renderFolderNode(n))
            )}
          </div>
        </div>

        <div className="col-span-12 md:col-span-8 lg:col-span-9 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
              Views
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {filteredSortedViews.length} view(s)
            </div>
          </div>
          <div className="p-3">
            <div className="flex flex-col lg:flex-row lg:items-center gap-2 mb-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={viewSearch}
                  onChange={(e) => setViewSearch(e.target.value)}
                  placeholder="Search saved views…"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as any)}
                  className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  title="Sort"
                >
                  <option value="updated_desc">Updated (newest)</option>
                  <option value="updated_asc">Updated (oldest)</option>
                  <option value="name_asc">Name (A→Z)</option>
                  <option value="name_desc">Name (Z→A)</option>
                </select>
                <select
                  value={targetTypeFilter}
                  onChange={(e) => setTargetTypeFilter(e.target.value)}
                  className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  title="Target type"
                >
                  <option value="all">All target types</option>
                  {LINKAGE_TARGET_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <select
                  value={suspectOnlyFilter}
                  onChange={(e) => setSuspectOnlyFilter(e.target.value as any)}
                  className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  title="Suspect filter"
                >
                  <option value="all">All</option>
                  <option value="suspect_only">Suspect-only views</option>
                </select>
              </div>
            </div>

            {loadingViews ? (
              <div className="text-sm text-gray-500">Loading views…</div>
            ) : filteredSortedViews.length === 0 ? (
              <div className="text-sm text-gray-600 dark:text-gray-300">
                No saved views match the current filters.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {filteredSortedViews.map((v) => (
                  <div key={v.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 dark:text-white truncate">{v.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Updated {String(v.updatedAt).slice(0, 10)}
                        </div>
                        <div className="text-[11px] text-gray-600 dark:text-gray-400 mt-1">
                          {summarize(v)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          className="px-2 py-1 text-xs rounded-md bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={() => setOpenMatrixView(v)}
                        >
                          Open
                        </button>
                        <button
                          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                          title="Edit view"
                          onClick={() => setViewModal({ open: true, mode: 'edit', view: v })}
                        >
                          <Edit2 size={14} className="text-gray-600 dark:text-gray-300" />
                        </button>
                        <button
                          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                          title="Duplicate view"
                          onClick={() => setViewModal({ open: true, mode: 'duplicate', view: v })}
                        >
                          <Copy size={14} className="text-gray-600 dark:text-gray-300" />
                        </button>
                        <select
                          className="px-2 py-1 text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
                          title="Move to folder"
                          value={(v.folderId ?? '') || ''}
                          onChange={(e) => moveViewMutation.mutate({ viewId: v.id, folderId: e.target.value ? e.target.value : null })}
                        >
                          <option value="">Unfiled</option>
                          {folders.map((f) => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                        </select>
                        <button
                          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                          title="Delete view"
                          onClick={() => {
                            setDeleteViewModal({ open: true, view: v })
                          }}
                        >
                          <Trash2 size={14} className="text-red-600" />
                        </button>
                      </div>
                    </div>
                    <div className="mt-2">
                      <button
                        className="text-xs text-gray-600 dark:text-gray-400 hover:underline"
                        onClick={() => setPreviewViewId((p) => (p === v.id ? null : v.id))}
                      >
                        {previewViewId === v.id ? 'Hide details' : 'Preview details'}
                      </button>
                      {previewViewId === v.id && v.definitionJson && (
                        <pre className="mt-2 text-[11px] bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded p-2 overflow-auto max-h-40">
                          {v.definitionJson}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {viewModal.open && (
        <CreateTraceabilityViewModal
          projectId={projectId}
          initialFolderId={folderIdFilter}
          folders={folders}
          mode={viewModal.mode}
          initialView={viewModal.view ?? null}
          onClose={() => setViewModal({ open: false })}
          onCreated={(v) => {
            setViewModal({ open: false })
            queryClient.invalidateQueries({ queryKey: ['traceability-views', projectId, folderIdFilter] })
            queryClient.invalidateQueries({ queryKey: ['traceability-views-all', projectId] })
            setOpenMatrixView(v)
          }}
        />
      )}

      {openMatrixView && (
        <TraceabilityMatrix
          projectId={projectId}
          savedViewId={openMatrixView.id}
          onClose={() => setOpenMatrixView(null)}
        />
      )}

      {folderModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70]">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[520px] max-w-[95vw]">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                {folderModal.mode === 'create'
                  ? 'New folder'
                  : folderModal.mode === 'rename'
                    ? 'Rename folder'
                    : 'Delete folder'}
              </div>
              <button
                onClick={() => setFolderModal({ open: false })}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X size={18} className="text-gray-600 dark:text-gray-300" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {folderModal.mode === 'delete' ? (
                <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  Delete folder <span className="font-medium">“{folderModal.folder?.name}”</span>? Subfolders will be deleted.
                  Views will be moved to <span className="font-medium">Unfiled</span>.
                </div>
              ) : (
                <>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Folder name</label>
                  <input
                    value={folderNameDraft}
                    onChange={(e) => setFolderNameDraft(e.target.value)}
                    placeholder="e.g. Verification coverage"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    autoFocus
                  />
                  {folderModal.mode === 'create' && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      New folders will be created under the currently selected folder.
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2">
              <button
                onClick={() => setFolderModal({ open: false })}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
              >
                Cancel
              </button>

              {folderModal.mode === 'delete' ? (
                <button
                  onClick={() => {
                    const id = folderModal.folder?.id
                    if (!id) return
                    deleteFolderMutation.mutate(id)
                    setFolderModal({ open: false })
                  }}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm flex items-center gap-2"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              ) : folderModal.mode === 'rename' ? (
                <button
                  onClick={() => {
                    const id = folderModal.folder?.id
                    const next = folderNameDraft.trim()
                    if (!id || !next) return
                    updateFolderMutation.mutate({ folderId: id, name: next })
                    setFolderModal({ open: false })
                  }}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm flex items-center gap-2"
                >
                  <Check size={14} />
                  Save
                </button>
              ) : (
                <button
                  onClick={() => {
                    const next = folderNameDraft.trim()
                    if (!next) return
                    createFolderMutation.mutate({ name: next, parentId: folderModal.parentId ?? null })
                    setFolderModal({ open: false })
                  }}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm flex items-center gap-2"
                >
                  <Plus size={14} />
                  Create
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {deleteViewModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70]">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[520px] max-w-[95vw]">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-900 dark:text-white">Delete view</div>
              <button
                onClick={() => setDeleteViewModal({ open: false })}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X size={18} className="text-gray-600 dark:text-gray-300" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                Delete view <span className="font-medium">“{deleteViewModal.view.name}”</span>?
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                This removes the saved definition. It won’t delete requirements or links.
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteViewModal({ open: false })}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteViewMutation.mutate(deleteViewModal.view.id)
                  setDeleteViewModal({ open: false })
                }}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm flex items-center gap-2"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

