import { useState } from 'react'
import { Send } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { taskService } from '../../services/task.service'
import type { TaskComment } from 'shared/types/task.types'
import { format } from 'date-fns'

interface CommentsTabProps {
  taskId: string
}

export default function CommentsTab({ taskId }: CommentsTabProps) {
  const [newComment, setNewComment] = useState('')
  const queryClient = useQueryClient()

  const { data: commentsData, isLoading } = useQuery({
    queryKey: ['task-comments', taskId],
    queryFn: async () => {
      const response = await taskService.getComments(taskId)
      if (response.success && response.data) {
        return response.data
      }
      return []
    },
  })

  const createCommentMutation = useMutation({
    mutationFn: (data: { bodyRich: string; authorName?: string }) =>
      taskService.createComment(taskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-comments', taskId] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setNewComment('')
    },
  })

  const comments = commentsData || []

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newComment.trim()) {
      createCommentMutation.mutate({ bodyRich: newComment.trim() })
    }
  }

  if (isLoading) {
    return <div className="text-gray-500 dark:text-gray-400">Loading comments...</div>
  }

  return (
    <div className="space-y-4">
      {/* Comment Form */}
      <form onSubmit={handleSubmit} className="space-y-2">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          rows={3}
          placeholder="Add a comment..."
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!newComment.trim() || createCommentMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            <Send size={16} />
            {createCommentMutation.isPending ? 'Posting...' : 'Post Comment'}
          </button>
        </div>
      </form>

      {/* Comments List */}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No comments yet. Be the first to comment!
          </div>
        ) : (
          comments.map((comment: TaskComment) => (
            <div
              key={comment.id}
              className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="font-medium text-gray-900 dark:text-white">
                  {comment.authorName || 'Anonymous'}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {format(new Date(comment.createdAt), 'MMM dd, yyyy HH:mm')}
                </div>
              </div>
              <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {comment.bodyRich}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
