import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search,
  X,
  Plus,
  Edit2,
  Copy,
  Download,
  Upload,
  Archive,
  Trash2,
  RefreshCw,
  MoreVertical,
} from 'lucide-react'
import { verificationService } from '../../services/verification.service'
import clsx from 'clsx'

type TemplateType = 'TEST_CASE' | 'TEST_PLAN'

export default function TemplatesLandingPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [section, setSection] = useState<TemplateType>('TEST_CASE')
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null)
  const [kebabId, setKebabId] = useState<string | null>(null)
  const [exportPlaceholder, setExportPlaceholder] = useState(false)

  interface TemplateListItem {
    id: string
    name?: string
    type?: string
    status?: string
    [key: string]: unknown
  }
  const { data: list = [], isLoading } = useQuery<TemplateListItem[]>({
    queryKey: ['verification-templates', projectId, section, showArchived],
    queryFn: async () => {
      if (!projectId) return []
      const res = await verificationService.getTemplates(projectId, {
        type: section,
        includeArchived: showArchived,
      })
      return res.success && res.data ? (res.data as TemplateListItem[]) : []
    },
    enabled: !!projectId,
  })

  const createMutation = useMutation<{ id: string }>({
    mutationFn: async () => {
      if (!projectId) throw new Error('No project')
      const res = await verificationService.createTemplate(projectId, {
        type: section,
        name: `New ${section === 'TEST_CASE' ? 'Test Case' : 'Test Plan'} Template`,
      })
      if (!res.success || !res.data) throw new Error(res.error || 'Create failed')
      return res.data as { id: string }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['verification-templates', projectId] })
      navigate(`/projects/${projectId}/verification/templates/${data.id}`)
    },
  })

  const duplicateMutation = useMutation<{ id: string }>({
    mutationFn: async (id: string) => {
      if (!projectId) throw new Error('No project')
      const res = await verificationService.duplicateTemplate(projectId, id)
      if (!res.success || !res.data) throw new Error(res.error || 'Duplicate failed')
      return res.data as { id: string }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['verification-templates', projectId] })
      navigate(`/projects/${projectId}/verification/templates/${data.id}`)
    },
  })

  const publishMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!projectId) throw new Error('No project')
      const res = await verificationService.publishTemplate(projectId, id)
      if (!res.success) throw new Error(res.error || 'Publish failed')
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verification-templates', projectId] })
    },
  })

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!projectId) throw new Error('No project')
      const res = await verificationService.archiveTemplate(projectId, id)
      if (!res.success) throw new Error(res.error || 'Archive failed')
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verification-templates', projectId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!projectId) throw new Error('No project')
      await verificationService.deleteTemplate(projectId, id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verification-templates', projectId] })
      setDeleteConfirm(null)
    },
  })

  const filtered = list.filter((t: any) =>
    (t.name || '').toLowerCase().includes(search.toLowerCase())
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PUBLISHED':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'ARCHIVED':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
      default:
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400'
    }
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Templates</h3>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div
            className={clsx(
              'flex rounded-lg border-2 overflow-hidden',
              'border-gray-200 dark:border-gray-600'
            )}
          >
            <button
              onClick={() => setSection('TEST_CASE')}
              className={clsx(
                'px-4 py-2 text-sm font-medium',
                section === 'TEST_CASE'
                  ? 'bg-blue-600 text-white dark:bg-blue-500'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              )}
            >
              Test Case Templates
            </button>
            <button
              onClick={() => setSection('TEST_PLAN')}
              className={clsx(
                'px-4 py-2 text-sm font-medium',
                section === 'TEST_PLAN'
                  ? 'bg-blue-600 text-white dark:bg-blue-500'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              )}
            >
              Test Plan Templates
            </button>
          </div>
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            Show archived
          </label>
          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
          >
            <Plus size={16} />
            New Template
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="animate-spin text-gray-400" size={24} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-gray-500 dark:text-gray-400">
            No templates found. Create one with &quot;New Template&quot;.
          </div>
        ) : (
          <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Version
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Last Updated
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filtered.map((t: any, index) => (
                  <tr
                    key={t.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-sm text-gray-600 dark:text-gray-400">
                      {t.type === 'TEST_CASE' ? 'TCT' : 'TPT'}-{String(index + 1).padStart(3, '0')}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {t.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {t.type === 'TEST_CASE' ? 'Test Case' : 'Test Plan'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          'px-2 py-1 rounded-full text-xs font-medium',
                          getStatusColor(t.status || 'DRAFT')
                        )}
                      >
                        {t.status || 'DRAFT'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {t.version ?? 1}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {t.updatedAt
                        ? new Date(t.updatedAt).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            const tab = t.type === 'TEST_PLAN' ? 'plans' : 'cases'
                            navigate(`/projects/${projectId}/verification?tab=${tab}&useTemplateId=${t.id}`)
                          }}
                          className="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                          title="Use"
                        >
                          <Plus size={16} />
                        </button>
                        <button
                          onClick={() =>
                            navigate(`/projects/${projectId}/verification/templates/${t.id}`)
                          }
                          className="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => duplicateMutation.mutate(t.id)}
                          disabled={duplicateMutation.isPending}
                          className="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                          title="Duplicate"
                        >
                          <Copy size={16} />
                        </button>
                        <button
                          onClick={() => setExportPlaceholder(true)}
                          className="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                          title="Export (placeholder)"
                        >
                          <Download size={16} />
                        </button>
                        <div className="relative inline-block">
                          <button
                            onClick={() => setKebabId(kebabId === t.id ? null : t.id)}
                            className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                            title="More"
                          >
                            <MoreVertical size={16} />
                          </button>
                          {kebabId === t.id && (
                            <div className="absolute right-0 top-full mt-1 py-1 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
                              {t.status === 'DRAFT' && (
                                <button
                                  onClick={() => {
                                    publishMutation.mutate(t.id)
                                    setKebabId(null)
                                  }}
                                  disabled={publishMutation.isPending}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                                >
                                  Publish
                                </button>
                              )}
                              {t.status !== 'ARCHIVED' && (
                                <button
                                  onClick={() => {
                                    archiveMutation.mutate(t.id)
                                    setKebabId(null)
                                  }}
                                  disabled={archiveMutation.isPending}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
                                >
                                  Archive
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setDeleteConfirm({ id: t.id, name: t.name })
                                  setKebabId(null)
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Confirm Delete
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Delete template <strong>{deleteConfirm.name}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirm.id)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {exportPlaceholder && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setExportPlaceholder(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Planned Feature</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Export template will be implemented in a future release.
            </p>
            <button
              onClick={() => setExportPlaceholder(false)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
