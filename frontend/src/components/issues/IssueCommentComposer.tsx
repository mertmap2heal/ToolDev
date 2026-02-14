import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Send, Loader2 } from 'lucide-react'
import { issueService } from '../../services/issue.service'
import clsx from 'clsx'

interface IssueCommentComposerProps {
  projectId: string
  issueId: string
  parentCommentId?: string
  onCancel?: () => void
}

export default function IssueCommentComposer({
  projectId,
  issueId,
  parentCommentId,
  onCancel,
}: IssueCommentComposerProps) {
  const queryClient = useQueryClient()
  const [content, setContent] = useState('')
  const [isPreview, setIsPreview] = useState(false)

  const createCommentMutation = useMutation({
    mutationFn: async (commentContent: string) => {
      return issueService.createComment(projectId, issueId, {
        content: commentContent,
        parentCommentId,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue-activity', projectId, issueId] })
      queryClient.invalidateQueries({ queryKey: ['issue', projectId, issueId] })
      setContent('')
      onCancel?.()
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (content.trim()) {
      createCommentMutation.mutate(content.trim())
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl + Enter to submit
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      if (content.trim()) {
        createCommentMutation.mutate(content.trim())
      }
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {parentCommentId ? 'Reply' : 'Add a comment'}
            </label>
            <div className="flex items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => setIsPreview(false)}
                className={clsx(
                  'px-3 py-1 rounded transition-colors',
                  !isPreview
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                )}
              >
                Write
              </button>
              <button
                type="button"
                onClick={() => setIsPreview(true)}
                className={clsx(
                  'px-3 py-1 rounded transition-colors',
                  isPreview
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                )}
              >
                Preview
              </button>
            </div>
          </div>

          {isPreview ? (
            <div className="min-h-[120px] px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              {content ? (
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {content}
                </p>
              ) : (
                <p className="text-gray-500 dark:text-gray-500 italic">
                  Nothing to preview
                </p>
              )}
            </div>
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={6}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Write a comment... (Cmd/Ctrl + Enter to submit)"
            />
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Markdown supported
          </div>
          <div className="flex items-center gap-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={createCommentMutation.isPending}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={!content.trim() || createCommentMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {createCommentMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send size={16} />
              )}
              {parentCommentId ? 'Reply' : 'Comment'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
