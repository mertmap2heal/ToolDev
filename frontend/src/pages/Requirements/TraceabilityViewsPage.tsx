import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FolderPlus, Folder, Trash2, Edit2, Plus, ArrowLeft, Table } from 'lucide-react'
import clsx from 'clsx'
import { traceabilityViewsService, type SavedViewFolder, type TraceabilitySavedView } from '../../services/traceabilityViews.service'
import TraceabilityMatrix from '../../components/requirements/TraceabilityMatrix'
import CreateTraceabilityViewModal from '../../components/requirements/CreateTraceabilityViewModal'

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

  const [selectedFolderKey, setSelectedFolderKey] = useState<'unfiled' | string>('unfiled')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [isCreateViewOpen, setIsCreateViewOpen] = useState(false)
  const [openMatrixView, setOpenMatrixView] = useState<TraceabilitySavedView | null>(null)

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

  const folderIdFilter = selectedFolderKey === 'unfiled' ? null : selectedFolderKey
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

  const toggleExpanded = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }))

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
          <button
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
            title="Rename folder"
            onClick={(e) => {
              e.stopPropagation()
              const next = window.prompt('Folder name', n.name)
              if (next && next.trim() && next.trim() !== n.name) updateFolderMutation.mutate({ folderId: n.id, name: next.trim() })
            }}
          >
            <Edit2 size={14} className="text-gray-500 dark:text-gray-400" />
          </button>
          <button
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
            title="Delete folder"
            onClick={(e) => {
              e.stopPropagation()
              if (window.confirm(`Delete folder \"${n.name}\"? Subfolders will be deleted. Views will be moved to Unfiled.`)) {
                deleteFolderMutation.mutate(n.id)
              }
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
          </div>
        </div>
        <button
          onClick={() => setIsCreateViewOpen(true)}
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
                const name = window.prompt('New folder name')
                if (!name || !name.trim()) return
                createFolderMutation.mutate({ name: name.trim(), parentId: selectedFolderKey === 'unfiled' ? null : selectedFolderKey })
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
                'w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700/60',
                selectedFolderKey === 'unfiled' && 'bg-blue-50 dark:bg-blue-900/25'
              )}
              onClick={() => setSelectedFolderKey('unfiled')}
            >
              <Folder size={16} className="text-gray-500 dark:text-gray-400" />
              <span className="text-sm text-gray-800 dark:text-gray-200">Unfiled</span>
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
              {views.length} view(s)
            </div>
          </div>
          <div className="p-3">
            {loadingViews ? (
              <div className="text-sm text-gray-500">Loading views…</div>
            ) : views.length === 0 ? (
              <div className="text-sm text-gray-600 dark:text-gray-300">
                No saved views in this folder.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {views.map((v) => (
                  <div key={v.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 dark:text-white truncate">{v.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Updated {String(v.updatedAt).slice(0, 10)}
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
                          title="Delete view"
                          onClick={() => {
                            if (window.confirm(`Delete view \"${v.name}\"?`)) deleteViewMutation.mutate(v.id)
                          }}
                        >
                          <Trash2 size={14} className="text-red-600" />
                        </button>
                      </div>
                    </div>
                    {v.definitionJson && (
                      <pre className="mt-2 text-[11px] bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded p-2 overflow-auto max-h-28">
                        {v.definitionJson}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {isCreateViewOpen && (
        <CreateTraceabilityViewModal
          projectId={projectId}
          initialFolderId={folderIdFilter}
          onClose={() => setIsCreateViewOpen(false)}
          onCreated={(v) => {
            setIsCreateViewOpen(false)
            queryClient.invalidateQueries({ queryKey: ['traceability-views', projectId, folderIdFilter] })
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
    </div>
  )
}

