import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, History, Loader2, Edit2, Trash2, Check, X } from 'lucide-react'
import { issueService } from '../../services/issue.service'
import type { IssueActivity, IssueComment } from 'shared/types/engineering.types'
import { formatDistanceToNow } from 'date-fns'
import clsx from 'clsx'

interface IssueActivityFeedProps {
  projectId: string
  issueId: string
  currentUserId?: string | null
}

export default function IssueActivityFeed({ projectId, issueId, currentUserId }: IssueActivityFeedProps) {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<'all' | 'comments' | 'history'>('all')
  const [sort, setSort] = useState<'oldest' | 'newest'>('oldest')
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [deleteConfirmCommentId, setDeleteConfirmCommentId] = useState<string | null>(null)

  const { data: activitiesData, isLoading } = useQuery({
    queryKey: ['issue-activity', projectId, issueId, filter, sort],
    queryFn: async () => {
      const response = await issueService.getIssueActivity(projectId, issueId, filter, sort)
      return response.success ? response.data : []
    },
  })

  const activities = activitiesData || []

  const updateCommentMutation = useMutation({
    mutationFn: async ({ commentId, content }: { commentId: string; content: string }) => {
      return issueService.updateComment(projectId, commentId, { content })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue-activity', projectId, issueId] })
      queryClient.invalidateQueries({ queryKey: ['issue', projectId, issueId] })
      setEditingCommentId(null)
      setEditingContent('')
    },
    onError: (error: any) => {
      console.error('Update comment error:', error)
      alert(error?.error || 'Failed to update comment')
    },
  })

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      return issueService.deleteComment(projectId, commentId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue-activity', projectId, issueId] })
      queryClient.invalidateQueries({ queryKey: ['issue', projectId, issueId] })
      setDeleteConfirmCommentId(null)
    },
    onError: (error: any) => {
      console.error('Delete comment error:', error)
      alert(error?.error || 'Failed to delete comment')
    },
  })

  const isCommentAuthor = (comment: IssueComment) => currentUserId && comment.authorId === currentUserId

  const renderActivity = (activity: IssueActivity) => {
    if ('content' in activity) {
      const comment = activity as unknown as IssueComment
      const canEdit = isCommentAuthor(comment)
      const isEditing = editingCommentId === comment.id

      return (
        <div key={comment.id} className="flex gap-2">
          <div className="flex-shrink-0">
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-medium">
              {comment.authorName?.charAt(0).toUpperCase() || '?'}
            </div>
          </div>
          <div className="flex-1">
            <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-gray-900 dark:text-white">
                    {comment.authorName || 'Unknown User'}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    commented {formatDistanceToNow(new Date(comment.createdAt))} ago
                  </span>
                </div>
                {canEdit && !isEditing && !deleteConfirmCommentId && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCommentId(comment.id)
                        setEditingContent(comment.content)
                      }}
                      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      title="Edit comment"
                    >
                      <Edit2 size={14} className="text-gray-600 dark:text-gray-400" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmCommentId(comment.id)}
                      className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors"
                      title="Delete comment"
                    >
                      <Trash2 size={14} className="text-red-600 dark:text-red-400" />
                    </button>
                  </div>
                )}
              </div>
              {isEditing ? (
                <div className="space-y-2">
                  <textarea
                    value={editingContent}
                    onChange={(e) => setEditingContent(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                    rows={3}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (editingContent.trim() && editingContent !== comment.content) {
                          updateCommentMutation.mutate({ commentId: comment.id, content: editingContent.trim() })
                        } else {
                          setEditingCommentId(null)
                          setEditingContent('')
                        }
                      }}
                      disabled={updateCommentMutation.isPending || !editingContent.trim()}
                      className="px-2 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                    >
                      <Check size={14} />
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCommentId(null)
                        setEditingContent('')
                      }}
                      className="px-2 py-1.5 border border-gray-300 dark:border-gray-600 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-1"
                    >
                      <X size={14} />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : deleteConfirmCommentId === comment.id ? (
                <div className="flex items-center gap-2 py-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Delete this comment?</span>
                  <button
                    type="button"
                    onClick={() => deleteCommentMutation.mutate(comment.id)}
                    disabled={deleteCommentMutation.isPending}
                    className="px-2 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleteCommentMutation.isPending ? 'Deleting...' : 'Delete'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmCommentId(null)}
                    className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {comment.content}
                </p>
              )}
            </div>
          </div>
        </div>
      )
    } else {
      // System note
      const note = activity as unknown as import('shared/types/engineering.types').IssueSystemNote
      return (
        <div key={note.id} className="flex gap-2">
          <div className="flex-shrink-0">
            <div className="w-7 h-7 rounded-full bg-gray-600 flex items-center justify-center text-white text-xs">
              <History size={14} />
            </div>
          </div>
          <div className="flex-1">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              <span className="font-medium">{note.userName || 'System'}</span>
              {' '}
              {formatSystemAction(note.action, note.oldValue || null, note.newValue || null)}
              {' '}
              <span className="text-gray-500 dark:text-gray-400">
                {formatDistanceToNow(new Date(note.createdAt))} ago
              </span>
            </div>
          </div>
        </div>
      )
    }
  }

  const formatSystemAction = (action: string | undefined, oldValue: string | null, newValue: string | null) => {
    if (!action) return 'performed an action'

    switch (action) {
      case 'status_changed':
        return (
          <>
            changed status from <span className="font-medium">{oldValue}</span> to{' '}
            <span className="font-medium">{newValue}</span>
          </>
        )
      case 'title_changed':
        return 'changed the title'
      case 'description_changed':
        return 'updated the description'
      case 'assignee_changed':
        return oldValue ? (
          <>changed assignee to <span className="font-medium">{newValue}</span></>
        ) : (
          <>assigned to <span className="font-medium">{newValue}</span></>
        )
      case 'assignee_removed':
        return 'removed assignee'
      case 'priority_changed':
        return (
          <>
            changed priority from <span className="font-medium">{oldValue}</span> to{' '}
            <span className="font-medium">{newValue}</span>
          </>
        )
      case 'labels_changed':
        return 'updated labels'
      case 'due_date_changed':
        return oldValue ? 'changed due date' : 'set due date'
      case 'due_date_removed':
        return 'removed due date'
      case 'estimated_time_changed':
        return 'updated estimated time'
      case 'link_added':
        return (
          <>
            linked <span className="font-medium">{newValue}</span>
          </>
        )
      case 'link_removed':
        return (
          <>
            unlinked <span className="font-medium">{newValue}</span>
          </>
        )
      default:
        return action.replace(/_/g, ' ')
    }
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            )}
          >
            All
          </button>
          <button
            onClick={() => setFilter('comments')}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1',
              filter === 'comments'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            )}
          >
            <MessageSquare size={14} />
            Comments
          </button>
          <button
            onClick={() => setFilter('history')}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1',
              filter === 'history'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            )}
          >
            <History size={14} />
            History
          </button>
        </div>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as 'oldest' | 'newest')}
          className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="oldest">Oldest first</option>
          <option value="newest">Newest first</option>
        </select>
      </div>

      {/* Activity list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-6 text-gray-500 dark:text-gray-400">
          No {filter !== 'all' ? filter : 'activity'} yet
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => renderActivity(activity))}
        </div>
      )}
    </div>
  )
}
