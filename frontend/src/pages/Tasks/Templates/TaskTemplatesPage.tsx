import { useState } from 'react'
import TaskNavigation from '../../../components/tasks/TaskNavigation'
import {
  FileText,
  Plus,
  Copy,
  Trash2,
  Edit2,
  Play,
  Search,
  Tag,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MoreVertical,
  X,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../../services/api'

interface TaskTemplate {
  id: string
  name?: string
  description?: string
  defaultStatus?: string
  defaultPriority?: string
  estimatedMinutes?: number
  tags?: string[]
  createdAt?: string
  updatedAt?: string
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  MEDIUM: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

export default function TaskTemplatesPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editTemplate, setEditTemplate] = useState<TaskTemplate | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState({ name: '', description: '', defaultPriority: 'MEDIUM', estimatedMinutes: 60 })
  const [activeMenu, setActiveMenu] = useState<string | null>(null)

  const { data: templates, isLoading } = useQuery<TaskTemplate[]>({
    queryKey: ['task-templates'],
    queryFn: async () => {
      const response = await apiClient.get<TaskTemplate[] | unknown>('/task-templates')
      const data = response.data
      return Array.isArray(data) ? data : []
    },
  })

  const createMutation = useMutation({
    mutationFn: async (data: Partial<TaskTemplate>) => apiClient.post('/task-templates', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-templates'] })
      setShowCreateModal(false)
      setCreateForm({ name: '', description: '', defaultPriority: 'MEDIUM', estimatedMinutes: 60 })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/task-templates/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['task-templates'] }),
  })

  const createFromTemplateMutation = useMutation({
    mutationFn: async (id: string) => apiClient.post(`/task-templates/${id}/create-task`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const filtered = (templates || []).filter((t) =>
    !search || (t.name || '').toLowerCase().includes(search.toLowerCase()) || (t.description || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <TaskNavigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-900/30">
              <FileText size={18} className="text-violet-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Task Templates</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Create reusable templates for common tasks</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm"
          >
            <Plus size={13} /> New Template
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400"
          />
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mb-5 text-xs text-gray-500">
          <span className="font-medium">{filtered.length} template{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-3" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full mb-2" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center">
            <FileText size={36} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No templates found</p>
            <p className="text-xs text-gray-400 mt-1">Create a template to standardize task creation</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Create First Template
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((template) => (
              <div
                key={template.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow group"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">{template.name || 'Untitled'}</h3>
                    <div className="relative">
                      <button
                        onClick={() => setActiveMenu(activeMenu === template.id ? null : template.id)}
                        className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <MoreVertical size={14} />
                      </button>
                      {activeMenu === template.id && (
                        <div className="absolute right-0 top-6 z-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 w-36">
                          <button
                            onClick={() => { setEditTemplate(template); setActiveMenu(null) }}
                            className="w-full text-left px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                          >
                            <Edit2 size={11} /> Edit
                          </button>
                          <button
                            onClick={() => { deleteMutation.mutate(template.id); setActiveMenu(null) }}
                            className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                          >
                            <Trash2 size={11} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {template.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">{template.description}</p>
                  )}

                  <div className="flex items-center gap-2 flex-wrap mb-3">
                    {template.defaultPriority && (
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${PRIORITY_COLORS[template.defaultPriority] || PRIORITY_COLORS.MEDIUM}`}>
                        {template.defaultPriority}
                      </span>
                    )}
                    {template.estimatedMinutes && (
                      <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                        <Clock size={9} /> {template.estimatedMinutes}m
                      </span>
                    )}
                    {(template.tags || []).slice(0, 2).map((tag) => (
                      <span key={tag} className="flex items-center gap-0.5 text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                        <Tag size={8} /> {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="border-t border-gray-100 dark:border-gray-700 px-5 py-3">
                  <button
                    onClick={() => createFromTemplateMutation.mutate(template.id)}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                  >
                    <Play size={11} /> Create Task from Template
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Template Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">New Template</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 block">Name</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  placeholder="Template name"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 block">Description</label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white resize-none"
                  rows={3}
                  placeholder="Describe the template"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 block">Priority</label>
                  <select
                    value={createForm.defaultPriority}
                    onChange={(e) => setCreateForm({ ...createForm, defaultPriority: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 block">Est. Minutes</label>
                  <input
                    type="number"
                    value={createForm.estimatedMinutes}
                    onChange={(e) => setCreateForm({ ...createForm, estimatedMinutes: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                    min={1}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowCreateModal(false)} className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 dark:text-gray-400">Cancel</button>
              <button
                onClick={() => createMutation.mutate({ name: createForm.name, description: createForm.description, defaultPriority: createForm.defaultPriority, estimatedMinutes: createForm.estimatedMinutes })}
                disabled={!createForm.name}
                className="px-4 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                Create Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
