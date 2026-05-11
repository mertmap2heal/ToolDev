import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageCircle, Send, Trash2, Edit2, X, Check } from 'lucide-react'
import { parseEntityRefs, EntityRefChip } from '../../utils/entityRefs'
import MarkdownEditor, { MarkdownPreview } from './MarkdownEditor'

// Universal discussion / chat component. Multiple modules need a threaded,
// editable, deletable comment list against an entity (parameter, validation
// item, requirement, change request, etc.). Each module wires the component
// to its own backend by providing a DiscussionAdapter. The widget itself
// has no module-specific knowledge.

export interface DiscussionAuthor {
  id: string
  name?: string | null
  email?: string | null
}

export interface DiscussionComment {
  id: string
  body: string
  authorUserId: string
  author?: DiscussionAuthor | null
  parentId?: string | null
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

export interface DiscussionAdapter {
  list(): Promise<DiscussionComment[]>
  create(body: string, parentId?: string | null): Promise<DiscussionComment | null>
  update(id: string, body: string): Promise<DiscussionComment | null>
  remove(id: string): Promise<boolean>
}

export interface MentionableMember {
  id: string
  name?: string | null
  email?: string | null
}

// Saved comment bodies are rendered through MarkdownPreview (cycle 101) so
// formatting / lists / tables / code / mention chips / entity-ref chips all
// share one pipeline with the composer's Preview tab.

interface ThreadedComment extends DiscussionComment {
  children: ThreadedComment[]
}

function thread(comments: DiscussionComment[]): ThreadedComment[] {
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

function initialsFor(c: DiscussionComment): string {
  const name = (c.author?.name ?? '').trim()
  if (name) {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? '')
      .join('') || '?'
  }
  const email = c.author?.email ?? ''
  return email ? email[0]?.toUpperCase() ?? '?' : '?'
}

interface Props {
  adapter: DiscussionAdapter
  /** React Query cache key — must be stable per entity (e.g. ['validation-comments', projectId, itemId]) */
  queryKey: unknown[]
  currentUserId: string
  /** Optional placeholder for the composer textarea */
  placeholder?: string
  /** Whether replies are allowed (default: true) */
  allowReplies?: boolean
  /** Optional title override (default: "Discussion") */
  title?: string
  /** Mentionable project members. When supplied, '@' opens an autocomplete. */
  members?: MentionableMember[]
}

export default function EntityDiscussion({
  adapter,
  queryKey,
  currentUserId,
  placeholder = 'Leave a comment, raise a question, or document a decision… Reference REQ-001, PRM-014, VAL-… and @mention teammates.',
  allowReplies = true,
  title = 'Discussion',
  members = [],
}: Props) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { data: comments = [] } = useQuery({
    queryKey,
    queryFn: () => adapter.list(),
  })

  const tree = useMemo(() => thread(comments), [comments])
  const invalidate = () => queryClient.invalidateQueries({ queryKey })

  const submit = async () => {
    if (!draft.trim()) return
    setSubmitting(true)
    const res = await adapter.create(draft.trim(), null)
    setSubmitting(false)
    if (res) {
      setDraft('')
      invalidate()
    }
  }

  const submitReply = async (parentId: string) => {
    if (!replyDraft.trim()) return
    const res = await adapter.create(replyDraft.trim(), parentId)
    if (res) {
      setReplyDraft('')
      setReplyTo(null)
      invalidate()
    }
  }

  const submitEdit = async (commentId: string) => {
    if (!editDraft.trim()) return
    const res = await adapter.update(commentId, editDraft.trim())
    if (res) {
      setEditing(null)
      setEditDraft('')
      invalidate()
    }
  }

  const remove = async (commentId: string) => {
    if (!window.confirm('Delete this comment?')) return
    await adapter.remove(commentId)
    invalidate()
  }

  const renderComment = (c: ThreadedComment, depth: number) => {
    const isMine = c.authorUserId === currentUserId
    const isDeleted = !!c.deletedAt
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
          <span className="pv-avatar">{initialsFor(c)}</span>
          <div className="body">
            <div className="head">
              <b>{c.author?.name ?? c.author?.email ?? 'Unknown'}</b>
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
              <div className="text">
                <MarkdownPreview source={c.body} members={members} />
              </div>
            )}
            {!isDeleted && editing !== c.id && (
              <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 12 }}>
                {allowReplies && (
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
                )}
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
          <MessageCircle size={12} /> {title} {liveCount > 0 && <span>({liveCount})</span>}
        </h3>
      </div>
      {tree.length === 0 ? (
        <p className="text-xs text-gray-500 italic mb-2">
          No comments yet — start the discussion below.
        </p>
      ) : (
        <ul className="space-y-2 mb-3">{tree.map((c) => renderComment(c, 0))}</ul>
      )}
      {/* One canonical composer across the app — see memory/feedback_universal_chat.md. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <MarkdownEditor
          value={draft}
          onChange={setDraft}
          placeholder={placeholder}
          members={members}
          rows={3}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 11,
            color: 'var(--pv-fg-3)',
          }}
        >
          <span>@ to mention · Ctrl+Enter to post</span>
          <button
            type="button"
            onClick={submit}
            disabled={!draft.trim() || submitting}
            aria-label="Post comment"
            className="pv-btn primary compact"
            style={{ height: 26, padding: '0 12px', fontSize: 12 }}
          >
            <Send size={12} /> Post
          </button>
        </div>
      </div>
    </section>
  )
}
