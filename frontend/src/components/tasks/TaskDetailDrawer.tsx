import { useState, useRef, useEffect } from 'react'
import { X, Calendar, Clock, Flag, AlertCircle, ChevronDown } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { taskService } from '../../services/task.service'
import TagPicker from './TagPicker'
import CommentsTab from './CommentsTab'
import AttachmentsTab from './AttachmentsTab'
import DependenciesTab from './DependenciesTab'
import ActivityTab from './ActivityTab'
import type { Task, TaskStatus, TaskPriority, UpdateTaskDto } from 'shared/types/task.types'
import { format } from 'date-fns'

interface TaskDetailDrawerProps {
  task: Task
  isOpen: boolean
  onClose: () => void
  onUpdate?: (task: Task) => void
}

export default function TaskDetailDrawer({ task, isOpen, onClose, onUpdate }: TaskDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'subtasks' | 'dependencies' | 'attachments' | 'comments' | 'activity'>('overview')
  const [priorityDropdownOpen, setPriorityDropdownOpen] = useState(false)
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const priorityDropdownRef = useRef<HTMLDivElement>(null)
  const statusDropdownRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  const updateTaskMutation = useMutation({
    mutationFn: (updates: UpdateTaskDto) => taskService.updateTask(task.id, updates),
    onSuccess: (response) => {
      if (response.success && response.data) {
        queryClient.invalidateQueries({ queryKey: ['tasks'] })
        onUpdate?.(response.data)
      }
    },
  })

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'LOW':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'BACKLOG':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
      case 'TODO':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      case 'IN_PROGRESS':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'IN_REVIEW':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
      case 'DONE':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const getPriorityOptionColor = (priority: TaskPriority) => {
    // Use neutral background with colored text for better visibility in dropdown
    switch (priority) {
      case 'CRITICAL':
        return 'bg-white dark:bg-gray-800 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border-l-2 border-red-500'
      case 'HIGH':
        return 'bg-white dark:bg-gray-800 text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 border-l-2 border-orange-500'
      case 'MEDIUM':
        return 'bg-white dark:bg-gray-800 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 border-l-2 border-yellow-500'
      case 'LOW':
        return 'bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-l-2 border-blue-500'
      default:
        return 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
    }
  }

  const getStatusOptionColor = (status: TaskStatus) => {
    // Use neutral background with colored text for better visibility in dropdown
    switch (status) {
      case 'BACKLOG':
        return 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
      case 'TODO':
        return 'bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-l-2 border-blue-500'
      case 'IN_PROGRESS':
        return 'bg-white dark:bg-gray-800 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 border-l-2 border-yellow-500'
      case 'IN_REVIEW':
        return 'bg-white dark:bg-gray-800 text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 border-l-2 border-purple-500'
      case 'DONE':
        return 'bg-white dark:bg-gray-800 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 border-l-2 border-green-500'
      default:
        return 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
    }
  }

  const priorityOptions: { value: TaskPriority; label: string }[] = [
    { value: 'LOW', label: 'Low' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'HIGH', label: 'High' },
    { value: 'CRITICAL', label: 'Critical' },
  ]

  const statusOptions: { value: TaskStatus; label: string }[] = [
    { value: 'BACKLOG', label: 'Backlog' },
    { value: 'TODO', label: 'Todo' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'IN_REVIEW', label: 'In Review' },
    { value: 'DONE', label: 'Done' },
  ]

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (priorityDropdownRef.current && !priorityDropdownRef.current.contains(event.target as Node)) {
        setPriorityDropdownOpen(false)
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setStatusDropdownOpen(false)
      }
    }

    if (priorityDropdownOpen || statusDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [priorityDropdownOpen, statusDropdownOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 w-full max-w-2xl h-[calc(100%-1rem)] my-2 mr-2 rounded-2xl shadow-sm overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-50/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-gray-100 dark:border-gray-700/50 px-4 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{task.title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 px-6">
          <div className="flex gap-4">
            {(['overview', 'subtasks', 'dependencies', 'attachments', 'comments', 'activity'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Status and Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div className="relative" ref={statusDropdownRef}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Status
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusDropdownOpen(!statusDropdownOpen)
                      setPriorityDropdownOpen(false)
                    }}
                    className={`w-full px-4 py-2 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between ${getStatusColor(task.status)}`}
                  >
                    <span>{statusOptions.find((opt) => opt.value === task.status)?.label || task.status}</span>
                    <ChevronDown size={16} className="ml-2" />
                  </button>
                  {statusDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
                      {statusOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            updateTaskMutation.mutate({ status: option.value })
                            setStatusDropdownOpen(false)
                          }}
                          className={`w-full px-4 py-2 text-left ${getStatusOptionColor(option.value)} ${
                            task.status === option.value ? 'font-semibold' : ''
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="relative" ref={priorityDropdownRef}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Priority
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setPriorityDropdownOpen(!priorityDropdownOpen)
                      setStatusDropdownOpen(false)
                    }}
                    className={`w-full px-4 py-2 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between ${getPriorityColor(task.priority)}`}
                  >
                    <span>{priorityOptions.find((opt) => opt.value === task.priority)?.label || task.priority}</span>
                    <ChevronDown size={16} className="ml-2" />
                  </button>
                  {priorityDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
                      {priorityOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            updateTaskMutation.mutate({ priority: option.value })
                            setPriorityDropdownOpen(false)
                          }}
                          className={`w-full px-4 py-2 text-left ${getPriorityOptionColor(option.value)} ${
                            task.priority === option.value ? 'font-semibold' : ''
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Calendar size={16} className="inline mr-2" />
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : ''}
                    onChange={(e) =>
                      updateTaskMutation.mutate({ startDate: e.target.value || undefined })
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Calendar size={16} className="inline mr-2" />
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''}
                    onChange={(e) =>
                      updateTaskMutation.mutate({ dueDate: e.target.value || undefined })
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Estimate */}
              {task.estimateMinutes && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Clock size={16} className="inline mr-2" />
                    Estimate
                  </label>
                  <div className="text-gray-900 dark:text-white">
                    {task.estimateMinutes} minutes ({Math.round(task.estimateMinutes / 60)} hours)
                  </div>
                </div>
              )}

              {/* Blocked */}
              {task.blocked && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="text-red-600 dark:text-red-400 mt-0.5" size={20} />
                    <div>
                      <div className="font-medium text-red-800 dark:text-red-400">Blocked</div>
                      {task.blockedReason && (
                        <div className="text-sm text-red-700 dark:text-red-300 mt-1">
                          {task.blockedReason}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tags
                </label>
                <TagPicker
                  projectId={task.projectId ?? undefined}
                  selectedTagIds={task.tags?.map((t: any) => t.tagId) || []}
                  onTagIdsChange={(tagIds) => {
                    updateTaskMutation.mutate({ tagIds })
                  }}
                  taskId={task.id}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <div className="prose dark:prose-invert max-w-none">
                  <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {task.descriptionRich || 'No description provided.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'subtasks' && (
            <div className="text-gray-500 dark:text-gray-400">
              Subtasks functionality will be implemented here.
            </div>
          )}

          {activeTab === 'dependencies' && (
            <DependenciesTab taskId={task.id} />
          )}

          {activeTab === 'attachments' && (
            <AttachmentsTab taskId={task.id} />
          )}

          {activeTab === 'comments' && (
            <CommentsTab taskId={task.id} />
          )}

          {activeTab === 'activity' && (
            <ActivityTab taskId={task.id} />
          )}
        </div>
      </div>
    </div>
  )
}
