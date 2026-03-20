import { useState, useRef } from 'react'
import { X } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { taskService } from '../../services/task.service'
import TagPicker from './TagPicker'
import type { CreateTaskDto, TaskStatus } from 'shared/types/task.types'
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges'

interface CreateTaskModalProps {
  isOpen: boolean
  onClose: () => void
  projectId?: string
  initialStatus?: TaskStatus
}

export default function CreateTaskModal({ isOpen, onClose, projectId, initialStatus }: CreateTaskModalProps) {
  const onDiscardRef = useRef<() => void>()
  const { markDirty, resetDirty, guardClose, warningDialog, draftBanner } = useUnsavedChanges(onClose, isOpen, () => onDiscardRef.current?.())
  const [formData, setFormDataBase] = useState<CreateTaskDto>({
    title: '',
    descriptionRich: '',
    status: initialStatus || 'BACKLOG',
    priority: 'MEDIUM',
    startDate: '',
    dueDate: '',
    estimateMinutes: undefined,
    blocked: false,
    blockedReason: '',
    tagIds: [],
  })
  const setFormData = (v: CreateTaskDto | ((prev: CreateTaskDto) => CreateTaskDto)) => { setFormDataBase(v as any); markDirty() }
  const [errors, setErrors] = useState<Record<string, string>>({})

  onDiscardRef.current = () => {
    setFormDataBase({
      title: '',
      descriptionRich: '',
      status: initialStatus || 'BACKLOG',
      priority: 'MEDIUM',
      startDate: '',
      dueDate: '',
      estimateMinutes: undefined,
      blocked: false,
      blockedReason: '',
      tagIds: [],
    })
    setErrors({})
  }

  const queryClient = useQueryClient()

  const createTaskMutation = useMutation({
    mutationFn: (data: CreateTaskDto) => taskService.createTask(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      resetDirty()
      onClose()
      setFormData({
        title: '',
        descriptionRich: '',
        status: 'BACKLOG',
        priority: 'MEDIUM',
        startDate: '',
        dueDate: '',
        estimateMinutes: undefined,
        blocked: false,
        blockedReason: '',
        tagIds: [],
      })
      setErrors({})
    },
    onError: (error: any) => {
      console.error('Create task error:', error)
      setErrors({ submit: error?.error || 'Failed to create task' })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    if (!formData.title || formData.title.trim().length === 0) {
      setErrors({ title: 'Title is required' })
      return
    }

    if (formData.blocked && !formData.blockedReason) {
      setErrors({ blockedReason: 'Blocked reason is required when task is blocked' })
      return
    }

    const submitData: CreateTaskDto = {
      ...formData,
      projectId: projectId || undefined,
      estimateMinutes: formData.estimateMinutes ? parseInt(String(formData.estimateMinutes), 10) : undefined,
      startDate: formData.startDate || undefined,
      dueDate: formData.dueDate || undefined,
      blockedReason: formData.blocked ? formData.blockedReason : undefined,
    }

    createTaskMutation.mutate(submitData)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={(e) => { if (e.target === e.currentTarget) guardClose() }}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create Task</h2>
          <div className="flex items-center gap-2">
            {draftBanner}
            <button
              onClick={guardClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errors.submit && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-red-800 dark:text-red-400 text-sm">
              {errors.submit}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                errors.title ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="Enter task title"
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.title}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={formData.descriptionRich}
              onChange={(e) => setFormData({ ...formData, descriptionRich: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter task description"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="BACKLOG">Backlog</option>
                <option value="TODO">Todo</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="IN_REVIEW">In Review</option>
                <option value="DONE">Done</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tags
            </label>
            <TagPicker
              selectedTagIds={formData.tagIds || []}
              onTagIdsChange={(tagIds) => setFormData({ ...formData, tagIds })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Estimate (minutes)
            </label>
            <input
              type="number"
              value={formData.estimateMinutes || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  estimateMinutes: e.target.value ? parseInt(e.target.value, 10) : undefined,
                })
              }
              min="0"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter estimate in minutes"
            />
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.blocked}
                onChange={(e) => setFormData({ ...formData, blocked: e.target.checked, blockedReason: '' })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Blocked</span>
            </label>
            {formData.blocked && (
              <div className="mt-2">
                <input
                  type="text"
                  value={formData.blockedReason}
                  onChange={(e) => setFormData({ ...formData, blockedReason: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                    errors.blockedReason ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="Reason for blocking"
                />
                {errors.blockedReason && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.blockedReason}</p>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={guardClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createTaskMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {createTaskMutation.isPending ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
      {warningDialog}
    </div>
  )
}
