import { useState, useRef, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Send, Loader2 } from 'lucide-react'
import { issueService } from '../../services/issue.service'
import { authService } from '../../services/auth.service'
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
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [content, setContent] = useState('')
  const [isPreview, setIsPreview] = useState(false)
  const [showMentionDropdown, setShowMentionDropdown] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionAnchor, setMentionAnchor] = useState(0)

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await authService.getUsers()
      return response.success && Array.isArray(response.data) ? response.data : []
    },
    enabled: showMentionDropdown,
  })

  const filteredMentionUsers = mentionQuery
    ? users.filter(
        (u: { name?: string; email?: string }) =>
          (u.name || '').toLowerCase().includes(mentionQuery.toLowerCase()) ||
          (u.email || '').toLowerCase().includes(mentionQuery.toLowerCase())
      )
    : users

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
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      if (content.trim()) {
        createCommentMutation.mutate(content.trim())
      }
    }
  }

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value
    const pos = e.target.selectionStart ?? v.length
    setContent(v)
    const beforeCursor = v.slice(0, pos)
    const lastAt = beforeCursor.lastIndexOf('@')
    if (lastAt >= 0) {
      const segment = beforeCursor.slice(lastAt + 1)
      if (!segment.includes(' ') && !segment.includes('\n')) {
        setMentionAnchor(lastAt)
        setMentionQuery(segment)
        setShowMentionDropdown(true)
        return
      }
    }
    setShowMentionDropdown(false)
  }

  const insertMention = (name: string) => {
    const cursor = textareaRef.current?.selectionStart ?? content.length
    const newContent = content.slice(0, mentionAnchor) + '@' + name + ' ' + content.slice(cursor)
    setContent(newContent)
    setShowMentionDropdown(false)
    setMentionQuery('')
    setTimeout(() => {
      textareaRef.current?.focus()
      const newPos = mentionAnchor + name.length + 2
      textareaRef.current?.setSelectionRange(newPos, newPos)
    }, 0)
  }

  useEffect(() => {
    if (!showMentionDropdown) return
    const h = () => setShowMentionDropdown(false)
    document.addEventListener('click', h)
    return () => document.removeEventListener('click', h)
  }, [showMentionDropdown])

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <form onSubmit={handleSubmit} className="space-y-3">
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
            <div className="min-h-[100px] px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50">
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
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={handleContentChange}
                onKeyDown={handleKeyDown}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Write a comment... Use @ to mention someone. Cmd/Ctrl + Enter to submit"
              />
              {showMentionDropdown && (
                <div
                  className="absolute z-20 mt-1 w-56 max-h-40 overflow-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg"
                  onClick={(e) => e.stopPropagation()}
                >
                  {filteredMentionUsers.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No users found</div>
                  ) : (
                    filteredMentionUsers.slice(0, 8).map((u: { id: string; name?: string; email?: string }) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => insertMention(u.name || u.email || u.id)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        {u.name || u.email || u.id}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
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
