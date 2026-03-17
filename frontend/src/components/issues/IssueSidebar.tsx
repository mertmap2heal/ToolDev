import { useState } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { 
  User, 
  Tag, 
  Calendar, 
  Clock, 
  Users,
  ChevronDown,
  X,
  Plus,
  Loader2
} from 'lucide-react'
import { issueService } from '../../services/issue.service'
import { authService } from '../../services/auth.service'
import type { Issue, IssueLabel, IssueType } from 'shared/types/engineering.types'
import clsx from 'clsx'

const ISSUE_TYPE_OPTIONS: { value: IssueType; label: string }[] = [
  { value: 'specification_error', label: 'Specification Error' },
  { value: 'design_error', label: 'Design Error' },
  { value: 'coding_error', label: 'Coding Error' },
  { value: 'documentation_error', label: 'Documentation Error' },
  { value: 'interface_error', label: 'Interface Error' },
  { value: 'other', label: 'Other' },
]

interface IssueSidebarProps {
  issue: Issue
  projectId: string
  currentUser: any
}

export default function IssueSidebar({ issue, projectId, currentUser }: IssueSidebarProps) {
  const queryClient = useQueryClient()
  
  // State for editing
  const [isEditingAssignee, setIsEditingAssignee] = useState(false)
  const [isEditingLabels, setIsEditingLabels] = useState(false)
  const [isCreatingLabel, setIsCreatingLabel] = useState(false)
  const [newLabelName, setNewLabelName] = useState('')
  const [newLabelColor, setNewLabelColor] = useState('#3B82F6')

  // Fetch users (from Admin Directory)
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await authService.getUsers()
      return response.success && Array.isArray(response.data) ? response.data : []
    },
    enabled: isEditingAssignee,
  })

  const users = usersData || []

  // Fetch labels
  const { data: labelsData } = useQuery({
    queryKey: ['labels', projectId],
    queryFn: async () => {
      const response = await issueService.getProjectLabels(projectId)
      return response.success && Array.isArray(response.data) ? response.data : []
    },
  })

  const labels = labelsData || []

  // Update issue mutation
  const updateIssueMutation = useMutation({
    mutationFn: async (data: Parameters<typeof issueService.updateIssue>[2]) => {
      return issueService.updateIssue(projectId, issue.id, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', projectId, issue.id] })
      queryClient.invalidateQueries({ queryKey: ['issue-activity', projectId, issue.id] })
      setIsEditingAssignee(false)
      setIsEditingLabels(false)
    },
  })

  // Create label mutation
  const createLabelMutation = useMutation({
    mutationFn: async (data: { name: string; color: string }) => {
      return issueService.createProjectLabel(projectId, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels', projectId] })
      setNewLabelName('')
      setNewLabelColor('#3B82F6')
      setIsCreatingLabel(false)
    },
  })

  const handleAssigneeChange = (userId: string) => {
    updateIssueMutation.mutate({ assigneeId: userId || undefined })
  }

  const handleLabelsChange = (labelIds: string[]) => {
    updateIssueMutation.mutate({ labelIds })
  }

  const handleCreateLabel = () => {
    if (newLabelName.trim()) {
      createLabelMutation.mutate({
        name: newLabelName.trim(),
        color: newLabelColor,
      })
    }
  }

  const labelColors = [
    '#3B82F6', // blue
    '#10B981', // green
    '#F59E0B', // amber
    '#EF4444', // red
    '#8B5CF6', // purple
    '#EC4899', // pink
    '#6B7280', // gray
  ]

  return (
    <div className="space-y-3">
      {/* Assignee */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <User size={16} />
            Assignee
          </h4>
          {!isEditingAssignee && (
            <button
              onClick={() => setIsEditingAssignee(true)}
              className="text-xs text-blue-600 hover:text-blue-700 transition-colors"
            >
              Edit
            </button>
          )}
        </div>

        {isEditingAssignee ? (
          <div className="space-y-2">
            <select
              value={issue.assigneeId || ''}
              onChange={(e) => handleAssigneeChange(e.target.value)}
              disabled={updateIssueMutation.isPending}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Unassigned</option>
              {users.map((user: any) => (
                <option key={user.id} value={user.id}>
                  {user.name || user.email}
                </option>
              ))}
            </select>
            <button
              onClick={() => setIsEditingAssignee(false)}
              className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : issue.assignee ? (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
              {issue.assignee.name?.charAt(0).toUpperCase() || '?'}
            </div>
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {issue.assignee.name || issue.assignee.email}
            </span>
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">
            No one assigned
          </p>
        )}
      </div>

      {/* Problem Report Type (DO-178C) */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
          Problem Report Type
        </h4>
        <select
          value={issue.issueType || ''}
          onChange={(e) => {
            const v = e.target.value
            updateIssueMutation.mutate({ issueType: (v ? v as IssueType : undefined) })
          }}
          disabled={updateIssueMutation.isPending}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Not set</option>
          {ISSUE_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">DO-178C classification</p>
      </div>

      {/* Labels */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Tag size={16} />
            Labels
          </h4>
          <button
            onClick={() => setIsEditingLabels(!isEditingLabels)}
            className="text-xs text-blue-600 hover:text-blue-700 transition-colors"
          >
            {isEditingLabels ? 'Done' : 'Edit'}
          </button>
        </div>

        {isEditingLabels && (
          <div className="mb-2 space-y-2">
            {labels.map((label: IssueLabel) => {
              const isSelected = issue.labelIds?.includes(label.id)
              return (
                <label
                  key={label.id}
                  className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      const newLabelIds = e.target.checked
                        ? [...(issue.labelIds || []), label.id]
                        : (issue.labelIds || []).filter(id => id !== label.id)
                      handleLabelsChange(newLabelIds)
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span
                    className="px-2 py-1 rounded text-xs font-medium"
                    style={{
                      backgroundColor: `${label.color}20`,
                      color: label.color,
                    }}
                  >
                    {label.name}
                  </span>
                </label>
              )
            })}

            {!isCreatingLabel ? (
              <button
                onClick={() => setIsCreatingLabel(true)}
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 transition-colors"
              >
                <Plus size={14} />
                Create new label
              </button>
            ) : (
              <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-2">
                <input
                  type="text"
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  placeholder="Label name"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex items-center gap-2">
                  {labelColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewLabelColor(color)}
                      className={clsx(
                        'w-6 h-6 rounded border-2 transition-all',
                        newLabelColor === color
                          ? 'border-gray-900 dark:border-white scale-110'
                          : 'border-transparent'
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCreateLabel}
                    disabled={!newLabelName.trim() || createLabelMutation.isPending}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {createLabelMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
                  </button>
                  <button
                    onClick={() => {
                      setIsCreatingLabel(false)
                      setNewLabelName('')
                      setNewLabelColor('#3B82F6')
                    }}
                    className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {issue.labels && issue.labels.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {issue.labels.map((label) => (
              <span
                key={label.id}
                className="px-2 py-1 rounded text-xs font-medium"
                style={{
                  backgroundColor: `${label.color}20`,
                  color: label.color,
                }}
              >
                {label.name}
              </span>
            ))}
          </div>
        ) : (
          !isEditingLabels && (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
              No labels
            </p>
          )
        )}
      </div>

      {/* Dates */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
          <Calendar size={16} />
          Dates
        </h4>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400">Start date:</span>
            <span className="text-gray-900 dark:text-white">
              {issue.startDate ? new Date(issue.startDate).toLocaleDateString() : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400">Due date:</span>
            <span className="text-gray-900 dark:text-white">
              {issue.dueDate ? new Date(issue.dueDate).toLocaleDateString() : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Time tracking */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-2">
          <Clock size={16} />
          Time Tracking
        </h4>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400">Estimated:</span>
            <span className="text-gray-900 dark:text-white">
              {issue.estimatedTime ? `${issue.estimatedTime}h` : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-400">Actual:</span>
            <span className="text-gray-900 dark:text-white">
              {issue.actualTime ? `${issue.actualTime}h` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Participants */}
      {issue.participants && issue.participants.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-2">
            <Users size={16} />
            Participants ({issue.participants.length})
          </h4>
          <div className="space-y-2">
            {issue.participants.map((participant) => (
              <div key={participant.id} className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-medium">
                  {participant.name?.charAt(0).toUpperCase() || '?'}
                </div>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {participant.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
