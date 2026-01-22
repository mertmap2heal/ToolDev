import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { taskService } from '../../services/task.service'
import type { TaskTag } from '../../../shared/types/task.types'

interface TagPickerProps {
  selectedTagIds: string[]
  onTagIdsChange: (tagIds: string[]) => void
  taskId?: string
}

export default function TagPicker({ selectedTagIds, onTagIdsChange, taskId }: TagPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const queryClient = useQueryClient()

  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const response = await taskService.getTags()
      if (response.success && response.data) {
        return response.data
      }
      return []
    },
  })

  const tags = tagsData || []

  const createTagMutation = useMutation({
    mutationFn: (data: { name: string; color?: string }) => taskService.createTag(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      setNewTagName('')
    },
  })

  const linkTagMutation = useMutation({
    mutationFn: ({ taskId, tagId }: { taskId: string; tagId: string }) =>
      taskService.linkTagToTask(taskId, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  const unlinkTagMutation = useMutation({
    mutationFn: ({ taskId, tagId }: { taskId: string; tagId: string }) =>
      taskService.unlinkTagFromTask(taskId, tagId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  const handleTagToggle = (tagId: string) => {
    if (taskId) {
      // If taskId is provided, use API to link/unlink
      if (selectedTagIds.includes(tagId)) {
        unlinkTagMutation.mutate({ taskId, tagId })
      } else {
        linkTagMutation.mutate({ taskId, tagId })
      }
    } else {
      // Otherwise, just update local state
      if (selectedTagIds.includes(tagId)) {
        onTagIdsChange(selectedTagIds.filter((id) => id !== tagId))
      } else {
        onTagIdsChange([...selectedTagIds, tagId])
      }
    }
  }

  const handleCreateTag = () => {
    if (newTagName.trim()) {
      createTagMutation.mutate({ name: newTagName.trim() })
    }
  }

  const selectedTags = tags.filter((tag: TaskTag) => selectedTagIds.includes(tag.id))

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-2">
        {selectedTags.map((tag: TaskTag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
            style={{
              backgroundColor: tag.color ? `${tag.color}20` : undefined,
              color: tag.color || undefined,
            }}
          >
            {tag.name}
            {!taskId && (
              <button
                onClick={() => handleTagToggle(tag.id)}
                className="hover:opacity-70"
              >
                <X size={12} />
              </button>
            )}
          </span>
        ))}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <Plus size={12} />
          Add Tag
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-10 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateTag()
                  }
                }}
                placeholder="Create new tag..."
                className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <button
                onClick={handleCreateTag}
                className="px-2 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {tags.map((tag: TaskTag) => (
                <label
                  key={tag.id}
                  className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedTagIds.includes(tag.id)}
                    onChange={() => handleTagToggle(tag.id)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-900 dark:text-white">{tag.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
