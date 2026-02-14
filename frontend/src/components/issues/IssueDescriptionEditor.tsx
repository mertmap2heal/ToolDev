import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Edit2, X, Check, Loader2 } from 'lucide-react'
import { issueService } from '../../services/issue.service'
import type { Issue } from 'shared/types/engineering.types'
import clsx from 'clsx'

interface IssueDescriptionEditorProps {
  issue: Issue
  isEditing: boolean
  onToggleEdit: () => void
  projectId: string
}

export default function IssueDescriptionEditor({
  issue,
  isEditing,
  onToggleEdit,
  projectId,
}: IssueDescriptionEditorProps) {
  const queryClient = useQueryClient()
  const [description, setDescription] = useState(issue.description || '')

  const updateDescriptionMutation = useMutation({
    mutationFn: async (newDescription: string) => {
      return issueService.updateIssue(projectId, issue.id, { description: newDescription })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', projectId, issue.id] })
      queryClient.invalidateQueries({ queryKey: ['issue-activity', projectId, issue.id] })
      onToggleEdit()
    },
  })

  const handleSave = () => {
    if (description !== issue.description) {
      updateDescriptionMutation.mutate(description)
    } else {
      onToggleEdit()
    }
  }

  const handleCancel = () => {
    setDescription(issue.description || '')
    onToggleEdit()
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
          Description
        </h3>
        {!isEditing && (
          <button
            onClick={onToggleEdit}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <Edit2 size={16} className="text-gray-600 dark:text-gray-400" />
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder="Add a description..."
          />
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={updateDescriptionMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              {updateDescriptionMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check size={16} />
              )}
              Save
            </button>
            <button
              onClick={handleCancel}
              disabled={updateDescriptionMutation.isPending}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <X size={16} />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="prose prose-slate dark:prose-invert max-w-none">
          {issue.description ? (
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {issue.description}
            </p>
          ) : (
            <p className="text-gray-500 dark:text-gray-500 italic">
              No description provided.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
