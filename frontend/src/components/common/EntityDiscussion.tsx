import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageCircle, Send, Trash2, Edit2, X, Check } from 'lucide-react'
import { parseEntityRefs, EntityRefChip } from '../../utils/entityRefs'

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

// Body markup convention for a mention. Matches the format already in use in
// the Parameters Discussion so the same body strings round-trip cleanly:
//   "@[Display Name](userId-uuid)"
const MENTION_TOKEN_RE = /@\[([^\]]+)\]\(([^)]+)\)/g

function renderCommentBody(body: string, members: MentionableMember[]): React.ReactNode[] {
  // Two-pass: first split out mention tokens, then for every non-mention chunk
  // run parseEntityRefs so REQ-001 style ids inside the chunk become chips.
  const out: React.ReactNode[] = []
  let lastIndex = 0
  const re = new RegExp(MENTION_TOKEN_RE.source, 'g')
  let m: RegExpExecArray | null
  let key = 0
  const memberById = new Map(members.map((u) => [u.id, u]))

  const renderChunk = (chunk: string): React.ReactNode[] => {
    if (!chunk) return []
    const segs = parseEntityRefs(chunk)
    return segs.map((s, i) =>
      s.type === 'text' ? (
        <span key={`t-${key}-${i}`}>{s.text}</span>
      ) : (
        <EntityRefChip key={`r-${key}-${i}`} prefix={s.prefix} number={s.number} />
      ),
    )
  }

  while ((m = re.exec(body)) !== null) {
    const [whole, name, userId] = m
    if (m.index > lastIndex) {
      out.push(...renderChunk(body.slice(lastIndex, m.index)))
    }
    const known = memberById.get(userId)
    const display = known?.name ?? known?.email ?? name
    out.push(
      <span
        key={`mention-${key++}`}
        title={known ? `${known.name ?? ''} <${known.email ?? ''}>` : 'Mentioned user'}
        style={{
          display: 'inline',
          padding: '0 4px',
          margin: '0 1px',
          borderRadius: 3,
          background: 'var(--pv-blue-tint, rgba(43,108,176,0.12))',
          color: 'var(--pv-blue-ink, #1e4778)',
          fontWeight: 500,
        }}
      >
        @{display}
      </span>,
    )
    lastIndex = m.index + whole.length
  }
  if (lastIndex < body.length) {
    out.push(...renderChunk(body.slice(lastIndex)))
  }
  if (out.length === 0) out.push(...renderChunk(body))
  return out
}

function memberInitials(m: MentionableMember): string {
  const src = (m.name && m.name.trim()) || (m.email ? m.email.split('@')[0] : '?')
  return src
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('') || '?'
}

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
              <p className="text" style={{ whiteSpace: 'pre-wrap' }}>
                {renderCommentBody(c.body, members)}
              </p>
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
      <MentionComposer
        value={draft}
        onChange={setDraft}
        onSubmit={submit}
        disabled={!draft.trim() || submitting}
        placeholder={placeholder}
        members={members}
      />
    </section>
  )
}

// ---------------------------------------------------------------------------
// Composer with @mention autocomplete
// ---------------------------------------------------------------------------

interface ComposerProps {
  value: string
  onChange: (next: string) => void
  onSubmit: () => void
  disabled: boolean
  placeholder?: string
  members: MentionableMember[]
}

function MentionComposer({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
  members,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  // `mentionQuery` is the partial text after the most recent '@' before the
  // caret. null = no active mention. `mentionAnchor` is the '@' character
  // offset into `value` so insertion can splice cleanly.
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionAnchor, setMentionAnchor] = useState<number>(-1)
  const [mentionIndex, setMentionIndex] = useState(0)

  const matches = useMemo(() => {
    if (mentionQuery === null || members.length === 0) return []
    const q = mentionQuery.toLowerCase()
    return members
      .filter((m) => {
        const name = (m.name ?? '').toLowerCase()
        const email = (m.email ?? '').toLowerCase()
        return name.includes(q) || email.includes(q)
      })
      .slice(0, 6)
  }, [mentionQuery, members])

  useEffect(() => {
    setMentionIndex(0)
  }, [mentionQuery])

  const detectMention = (next: string, caret: number) => {
    const upto = next.slice(0, caret)
    const at = upto.lastIndexOf('@')
    if (at < 0) {
      setMentionQuery(null)
      return
    }
    // Trigger only when '@' starts a token (beginning of string or after
    // whitespace). Avoids matching e.g. "email@host" inside ordinary text.
    const prev = upto[at - 1]
    if (at !== 0 && prev !== ' ' && prev !== '\n' && prev !== '\t') {
      setMentionQuery(null)
      return
    }
    const after = upto.slice(at + 1)
    if (/\s/.test(after)) {
      setMentionQuery(null)
      return
    }
    setMentionAnchor(at)
    setMentionQuery(after)
  }

  const insertMention = (idx: number) => {
    const m = matches[idx]
    if (!m || mentionAnchor < 0 || !textareaRef.current) return
    const ta = textareaRef.current
    const display = (m.name ?? m.email ?? 'user').trim() || 'user'
    const before = value.slice(0, mentionAnchor)
    const afterCaret = value.slice(ta.selectionStart)
    const inserted = `@[${display}](${m.id}) `
    const next = before + inserted + afterCaret
    onChange(next)
    setMentionQuery(null)
    setMentionAnchor(-1)
    requestAnimationFrame(() => {
      const newCaret = (before + inserted).length
      ta.focus()
      ta.setSelectionRange(newCaret, newCaret)
    })
  }

  return (
    <div className="pv-dr-comment-add" style={{ position: 'relative' }}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          const v = e.target.value
          onChange(v)
          detectMention(v, e.target.selectionStart ?? v.length)
        }}
        onKeyDown={(e) => {
          if (mentionQuery !== null && matches.length > 0) {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setMentionIndex((i) => (i + 1) % matches.length)
              return
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setMentionIndex((i) => (i - 1 + matches.length) % matches.length)
              return
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
              e.preventDefault()
              insertMention(mentionIndex)
              return
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              setMentionQuery(null)
              return
            }
          }
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            onSubmit()
          }
        }}
        rows={2}
        placeholder={placeholder}
      />
      {mentionQuery !== null && matches.length > 0 && (
        <div
          role="listbox"
          aria-label="Mention teammate"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 4px)',
            left: 4,
            zIndex: 50,
            minWidth: 220,
            maxWidth: 320,
            background: 'var(--pv-bg)',
            border: '1px solid var(--pv-line)',
            borderRadius: 6,
            boxShadow: '0 6px 24px rgba(15,20,25,0.12)',
            padding: 4,
            fontSize: 12,
          }}
        >
          {matches.map((m, i) => {
            const name = m.name || m.email || 'Unknown'
            const email = m.email ?? ''
            const active = i === mentionIndex
            return (
              <button
                key={m.id}
                type="button"
                role="option"
                aria-selected={active}
                onMouseDown={(e) => {
                  e.preventDefault()
                  insertMention(i)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '6px 8px',
                  border: 0,
                  borderRadius: 4,
                  background: active ? 'var(--pv-blue-tint)' : 'transparent',
                  color: active ? 'var(--pv-blue-ink)' : 'var(--pv-fg)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  fontSize: 12,
                }}
              >
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    background: 'linear-gradient(135deg, #d6e2ec, #bccddb)',
                    color: 'var(--pv-fg-2)',
                    fontSize: 10,
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {memberInitials(m)}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: 'block',
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {name}
                  </span>
                  {email && (
                    <span
                      style={{
                        display: 'block',
                        fontSize: 10,
                        color: 'var(--pv-fg-3)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {email}
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      )}
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span style={{ flex: 1, color: 'var(--pv-fg-3)', fontSize: 11 }}>
          @ to mention · Ctrl+Enter to post
        </span>
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled}
          aria-label="Post comment"
          className="pv-btn primary compact"
        >
          <Send size={12} /> Post
        </button>
      </div>
    </div>
  )
}
