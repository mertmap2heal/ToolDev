import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageCircle, Send, Trash2, Edit2, X, Check } from 'lucide-react'
import { validationService, type ValidationCommentRow } from '../../services/validation.service'
import { RenderWithEntityRefs } from '../../utils/entityRefs'

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
    const initials = (c.author?.name ?? '?')
      .split(' ')
      .map((s) => s[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
    return (
      <li
        key={c.id}
        style={{
          marginLeft: depth * 18,
          paddingLeft: depth > 0 ? 10 : 0,
          borderLeft: depth > 0 ? '1px solid var(--pv-line)' : undefined,
        }}
      >
        <div className="pv-dr-comment">
          <span className="pv-avatar">{initials}</span>
          <div className="body">
            <div className="head">
              <b>{c.author?.name ?? 'Unknown'}</b>
              <span className="when" title={new Date(c.createdAt).toLocaleString()}>
                {relativeTime(c.createdAt)}
                {c.updatedAt !== c.createdAt && !isDeleted && ' · edited'}
              </span>
            </div>
            {isDeleted ? (
              <p className="text" style={{ color: 'var(--pv-fg-4)', fontStyle: 'italic' }}>(deleted)</p>
            ) : editing === c.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <textarea
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  rows={2}
                  style={{
                    width: '100%',
                    padding: 6,
                    fontSize: 12,
                    border: '1px solid var(--pv-line)',
                    borderRadius: 4,
                    background: 'var(--pv-bg)',
                    color: 'var(--pv-fg)',
                    fontFamily: 'inherit',
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(null)
                      setEditDraft('')
                    }}
                    style={{ fontSize: 11, color: 'var(--pv-fg-3)', background: 'none', border: 0, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => submitEdit(c.id)}
                    style={{ fontSize: 11, color: 'var(--pv-blue)', background: 'none', border: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 2 }}
                  >
                    <Check size={11} /> Save
                  </button>
                </div>
              </div>
            ) : (
              <p className="text" style={{ whiteSpace: 'pre-wrap' }}>
                <RenderWithEntityRefs text={c.body} />
              </p>
            )}
            {!isDeleted && editing !== c.id && (
              <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  type="button"
                  onClick={() => {
                    setReplyTo(replyTo === c.id ? null : c.id)
                    setReplyDraft('')
                  }}
                  style={{ fontSize: 11, color: 'var(--pv-blue)', background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
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
                      style={{ fontSize: 11, color: 'var(--pv-fg-3)', background: 'none', border: 0, padding: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 2 }}
                    >
                      <Edit2 size={11} /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(c.id)}
                      style={{ fontSize: 11, color: 'var(--pv-fg-3)', background: 'none', border: 0, padding: 0, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 2 }}
                    >
                      <Trash2 size={11} /> Delete
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
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
      <div className="pv-dr-comment-add">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          placeholder="Leave a comment, raise a question, or document a decision… Reference REQ-001, PRM-014, VAL-…"
        />
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={submit}
            disabled={!draft.trim() || submitting}
            aria-label="Post comment"
            className="pv-btn primary compact"
          >
            <Send size={12} /> Post
          </button>
        </div>
      </div>
    </section>
  )
}
