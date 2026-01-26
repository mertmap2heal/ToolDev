import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search,
  X,
  Plus,
  Edit2,
  Copy,
  Upload,
  Archive,
  Trash2,
  RefreshCw,
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

  const { data: list = [], isLoading } = useQuery({
    queryKey: ['verification-templates', projectId, section, showArchived],
    queryFn: async () => {
      if (!projectId) return []
      const res = await verificationService.getTemplates(projectId, {
        type: section,
        includeArchived: showArchived,
      })
      return res.success && res.data ? res.data : []
    },
    enabled: !!projectId,
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error('No project')
      const res = await verificationService.createTemplate(projectId, {
        type: section,
        name: `New ${section === 'TEST_CASE' ? 'Test Case' : 'Test Plan'} Template`,
      })
      if (!res.success || !res.data) throw new Error(res.error || 'Create failed')
      return res.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['verification-templates', projectId] })
      navigate(`/projects/${projectId}/verification/templates/${data.id}`)
    },
  })

  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!projectId) throw new Error('No project')
      const res = await verificationService.duplicateTemplate(projectId, id)
      if (!res.success || !res.data) throw new Error(res.error || 'Duplicate failed')
      return res.data
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
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Version
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Updated
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filtered.map((t: any) => (
                  <tr
                    key={t.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                      {t.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {t.type === 'TEST_CASE' ? 'Test Case' : 'Test Plan'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          'px-2 py-1 rounded text-xs font-medium',
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
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            navigate(`/projects/${projectId}/verification/templates/${t.id}`)
                          }
                          className="p-1.5 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => duplicateMutation.mutate(t.id)}
                          disabled={duplicateMutation.isPending}
                          className="p-1.5 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                          title="Duplicate"
                        >
                          <Copy size={16} />
                        </button>
                        {t.status === 'DRAFT' && (
                          <button
                            onClick={() => publishMutation.mutate(t.id)}
                            disabled={publishMutation.isPending}
                            className="p-1.5 text-green-600 hover:text-green-700 dark:text-green-400"
                            title="Publish"
                          >
                            <Upload size={16} />
                          </button>
                        )}
                        {t.status !== 'ARCHIVED' && (
                          <button
                            onClick={() => archiveMutation.mutate(t.id)}
                            disabled={archiveMutation.isPending}
                            className="p-1.5 text-amber-600 hover:text-amber-700 dark:text-amber-400"
                            title="Archive"
                          >
                            <Archive size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteConfirm({ id: t.id, name: t.name })}
                          className="p-1.5 text-red-600 hover:text-red-700 dark:text-red-400"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
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
    </div>
  )
}
