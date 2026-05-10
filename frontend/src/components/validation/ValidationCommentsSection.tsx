import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageCircle, Send, Trash2, Edit2, X, Check } from 'lucide-react'
import { validationService, type ValidationCommentRow } from '../../services/validation.service'

interface Props {
  projectId: string
  itemId: string
  currentUserId: string
}

interface ThreadedComment extends ValidationCommentRow {
  children: ThreadedComment[]
}

function thread(comments: ValidationCommentRow[]): ThreadedComment[] {
  const byId = new Map<string, ThreadedComment>()
  comments.forEach((c) => byId.set(c.id, { ...c, children: [] }))
  const roots: ThreadedComment[] = []
  byId.forEach((c) => {
    if (c.parentId && byId.has(c.parentId)) {
      byId.get(c.parentId)!.children.push(c)
    } else {
      roots.push(c)
    }
  })
  return roots
}

function relativeTime(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

export default function ValidationCommentsSection({
  projectId,
  itemId,
  currentUserId,
}: Props) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { data: comments = [] } = useQuery({
    queryKey: ['validation-comments', projectId, itemId],
    queryFn: async () => {
      const res = await validationService.listComments(projectId, itemId)
      return res.success && res.data ? res.data : []
    },
  })

  const tree = useMemo(() => thread(comments), [comments])
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ['validation-comments', projectId, itemId],
    })

  const submit = async () => {
    if (!draft.trim()) return
    setSubmitting(true)
    const res = await validationService.createComment(projectId, itemId, { body: draft.trim() })
    setSubmitting(false)
    if (res.success) {
      setDraft('')
      invalidate()
    }
  }

  const submitReply = async (parentId: string) => {
    if (!replyDraft.trim()) return
    const res = await validationService.createComment(projectId, itemId, {
      body: replyDraft.trim(),
      parentId,
    })
    if (res.success) {
      setReplyDraft('')
      setReplyTo(null)
      invalidate()
    }
  }

  const submitEdit = async (commentId: string) => {
    if (!editDraft.trim()) return
    const res = await validationService.updateComment(projectId, itemId, commentId, editDraft.trim())
    if (res.success) {
      setEditing(null)
      setEditDraft('')
      invalidate()
    }
  }

  const remove = async (commentId: string) => {
    if (!window.confirm('Delete this comment?')) return
    await validationService.deleteComment(projectId, itemId, commentId)
    invalidate()
  }

  const renderComment = (c: ThreadedComment, depth: number) => {
    const isMine = c.authorUserId === currentUserId
    const isDeleted = !!c.deletedAt
    return (
      <li key={c.id} className={depth > 0 ? 'ml-5 mt-2 pl-3 border-l border-gray-200 dark:border-gray-700' : ''}>
        <div className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-2 text-sm">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-semibold text-gray-900 dark:text-white truncate">
              {c.author?.name ?? 'Unknown'}
            </span>
            <span className="text-[11px] text-gray-500" title={new Date(c.createdAt).toLocaleString()}>
              {relativeTime(c.createdAt)}
              {c.updatedAt !== c.createdAt && !isDeleted && ' · edited'}
            </span>
          </div>
          {isDeleted ? (
            <p className="text-xs text-gray-400 italic">(deleted)</p>
          ) : editing === c.id ? (
            <div className="space-y-1">
              <textarea
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                rows={2}
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
              />
              <div className="flex justify-end gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null)
                    setEditDraft('')
                  }}
                  className="text-[11px] text-gray-500 hover:underline"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => submitEdit(c.id)}
                  className="text-[11px] flex items-center gap-0.5 text-blue-600 hover:text-blue-700"
                >
                  <Check size={11} /> Save
                </button>
              </div>
            </div>
          ) : (
            <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{c.body}</p>
          )}
          {!isDeleted && editing !== c.id && (
            <div className="mt-1 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setReplyTo(replyTo === c.id ? null : c.id)
                  setReplyDraft('')
                }}
                className="text-[11px] text-blue-600 hover:underline"
              >
                Reply
              </button>
              {isMine && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(c.id)
                      setEditDraft(c.body)
                    }}
                    className="text-[11px] text-gray-500 hover:text-blue-600 flex items-center gap-0.5"
                  >
                    <Edit2 size={11} /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(c.id)}
                    className="text-[11px] text-gray-500 hover:text-red-600 flex items-center gap-0.5"
                  >
                    <Trash2 size={11} /> Delete
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        {replyTo === c.id && (
          <div className="mt-1 ml-3 flex gap-1">
            <textarea
              value={replyDraft}
              onChange={(e) => setReplyDraft(e.target.value)}
              rows={2}
              placeholder="Reply…"
              className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
              autoFocus
            />
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => {
                  setReplyTo(null)
                  setReplyDraft('')
                }}
                aria-label="Cancel"
                className="text-gray-400 hover:text-gray-700"
              >
                <X size={14} />
              </button>
              <button
                type="button"
                onClick={() => submitReply(c.id)}
                aria-label="Send reply"
                className="text-blue-600 hover:text-blue-700"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        )}
        {c.children.length > 0 && (
          <ul>{c.children.map((child) => renderComment(child, depth + 1))}</ul>
        )}
      </li>
    )
  }

  const liveCount = comments.filter((c) => !c.deletedAt).length

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1">
          <MessageCircle size={12} /> Discussion {liveCount > 0 && <span>({liveCount})</span>}
        </h3>
      </div>
      {tree.length === 0 ? (
        <p className="text-xs text-gray-500 italic mb-2">
          No comments yet — start the discussion below.
        </p>
      ) : (
        <ul className="space-y-2 mb-3">{tree.map((c) => renderComment(c, 0))}</ul>
      )}
      <div className="flex gap-2 items-start">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          placeholder="Leave a comment, raise a question, or document a decision…"
          className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!draft.trim() || submitting}
          aria-label="Post comment"
          className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
        >
          <Send size={14} /> Post
        </button>
      </div>
    </section>
  )
}
