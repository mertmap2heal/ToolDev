import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { projectService } from '../../services/project.service'
import { X, Edit2, GitCompare, Copy, RotateCcw, Eye, Send, ExternalLink, Link2, MoreHorizontal, Maximize2, GitPullRequestArrow, ListChecks, Code2, SlidersHorizontal, Lock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { parameterService } from '../../services/parameter.service'
import { evaluateFormula } from './evaluateFormula'
import { useParameterPresence } from '../../hooks/useParameterPresence'
import { useAuthStore } from '../../store/authStore'
import type { Parameter } from 'shared/types/engineering.types'
import { format, formatDistanceToNow } from 'date-fns'
import clsx from 'clsx'
import VersionDiff, { type FieldDiff } from '../common/VersionDiff'

interface ParameterDetailDrawerProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  parameter: Parameter | null
  onEdit: (parameter: Parameter) => void
  /** Full parameter list for resolving {{param:ID}} formula references */
  allParameters?: Parameter[]
  /** Open in expanded (full-workspace) mode immediately. Used by the
   *  open-in-new-tab deep link so the parameter fills the page. */
  defaultExpanded?: boolean
}

// Human-readable labels for snapshot fields
const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  description: 'Description',
  defaultValue: 'Value',
  unit: 'Unit',
  tolerance: 'Tolerance',
  minValue: 'Min',
  maxValue: 'Max',
  status: 'Status',
  formula: 'Formula',
  dataType: 'Data type',
  tags: 'Tags',
}

// Fields to compare between versions (ordered for display)
const TRACKED_FIELDS = ['name', 'description', 'defaultValue', 'unit', 'tolerance', 'minValue', 'maxValue', 'status', 'formula', 'dataType', 'tags']

// Drawer header more-menu — shared item style
const menuItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '6px 10px',
  border: 0,
  borderRadius: 4,
  background: 'transparent',
  color: 'var(--pv-fg)',
  cursor: 'pointer',
  textAlign: 'left',
  fontFamily: 'inherit',
  fontSize: 12,
}

// ---------------------------------------------------------------------------
// Discussion / chat — localStorage-backed comments per parameter
// ---------------------------------------------------------------------------
interface DiscussionComment {
  id: string
  authorId: string
  authorName: string
  authorEmail: string
  body: string
  createdAt: string
}

function readDiscussion(parameterId: string): DiscussionComment[] {
  try {
    const raw = localStorage.getItem(`param-discussion-${parameterId}`)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function writeDiscussion(parameterId: string, items: DiscussionComment[]) {
  try {
    localStorage.setItem(`param-discussion-${parameterId}`, JSON.stringify(items))
    window.dispatchEvent(new CustomEvent('param-discussion-change', { detail: { parameterId } }))
  } catch {
    /* ignore */
  }
}

function initials(name: string | undefined, email: string | undefined): string {
  const src = (name && name.trim()) || (email ? email.split('@')[0] : '?')
  return src
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('') || '?'
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime()
  const ms = Date.now() - t
  if (ms < 60_000) return 'just now'
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} m ago`
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)} h ago`
  if (ms < 7 * 86_400_000) return `${Math.floor(ms / 86_400_000)} d ago`
  return format(new Date(iso), 'd MMM, HH:mm')
}

interface DiscussionProps {
  projectId: string
  parameterId: string
  currentUser: { id: string; name: string; email: string } | null
}

type MemberLite = {
  user: { id: string; name?: string | null; email?: string | null; avatarUrl?: string | null }
  role?: string
  joinedAt?: string
}

const MENTION_TOKEN_RE = /@\[([^\]]+)\]\(([^)]+)\)/g

function renderCommentBody(
  body: string,
  members: MemberLite[],
  onMentionClick: (anchor: HTMLElement, userId: string) => void,
): React.ReactNode[] {
  const out: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  const re = new RegExp(MENTION_TOKEN_RE.source, 'g')
  let key = 0
  while ((match = re.exec(body)) !== null) {
    const [whole, name, userId] = match
    if (match.index > lastIndex) {
      out.push(body.slice(lastIndex, match.index))
    }
    const known = members.find((m) => m.user.id === userId)
    out.push(
      <button
        key={`m-${key++}`}
        type="button"
        onClick={(e) => onMentionClick(e.currentTarget, userId)}
        title={known ? `${known.user.name ?? ''} <${known.user.email ?? ''}>` : 'View profile'}
        style={{
          display: 'inline',
          padding: '0 4px',
          margin: '0 1px',
          borderRadius: 3,
          border: 0,
          background: 'var(--pv-blue-tint)',
          color: 'var(--pv-blue-ink)',
          fontWeight: 500,
          fontFamily: 'inherit',
          cursor: 'pointer',
        }}
      >
        @{name}
      </button>,
    )
    lastIndex = match.index + whole.length
  }
  if (lastIndex < body.length) out.push(body.slice(lastIndex))
  return out
}

interface MentionPopover {
  userId: string
  rect: { top: number; left: number }
}

function DiscussionSection({ projectId, parameterId, currentUser }: DiscussionProps) {
  const [items, setItems] = useState<DiscussionComment[]>(() => readDiscussion(parameterId))
  const [draft, setDraft] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [mentionPopover, setMentionPopover] = useState<MentionPopover | null>(null)
  const [copiedMention, setCopiedMention] = useState<string | null>(null)
  // Project members for @-mention autocomplete
  const { data: members = [] } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: async () => {
      const res = await projectService.getProjectMembers(projectId)
      return res.success && res.data ? res.data : []
    },
    enabled: !!projectId,
    staleTime: 5 * 60_000,
  })
  // Mention autocomplete state. `query` is the partial text after the
  // most recent '@' before the caret; null = no active mention.
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionAnchor, setMentionAnchor] = useState<number>(-1)  // caret '@' offset
  const [mentionIndex, setMentionIndex] = useState(0)
  const mentionMatches = useMemo(() => {
    if (mentionQuery === null) return []
    const q = mentionQuery.toLowerCase()
    type Member = { user: { id: string; name?: string | null; email?: string | null } }
    return (members as Member[])
      .filter((m) => {
        const name = (m.user.name ?? '').toLowerCase()
        const email = (m.user.email ?? '').toLowerCase()
        return name.includes(q) || email.includes(q)
      })
      .slice(0, 6)
  }, [mentionQuery, members])
  useEffect(() => { setMentionIndex(0) }, [mentionQuery])

  const handleDraftChange = (value: string, caret: number) => {
    setDraft(value)
    // Find the most recent '@' before the caret that starts a mention token
    const upto = value.slice(0, caret)
    const at = upto.lastIndexOf('@')
    if (at < 0) { setMentionQuery(null); return }
    // Only trigger when '@' is at start, after whitespace, or after newline
    const prev = upto[at - 1]
    if (at !== 0 && prev !== ' ' && prev !== '\n' && prev !== '\t') { setMentionQuery(null); return }
    const after = upto.slice(at + 1)
    if (/\s/.test(after)) { setMentionQuery(null); return }
    setMentionAnchor(at)
    setMentionQuery(after)
  }

  const insertMention = (mIndex: number) => {
    type Member = { user: { id: string; name?: string | null; email?: string | null } }
    const m = (mentionMatches[mIndex] as Member | undefined)
    if (!m || mentionAnchor < 0 || !textareaRef.current) return
    const ta = textareaRef.current
    // Store as `@[Name](userId)` so rendering can resolve it back to a
    // hyperlink even after the project membership list changes. Plain-text
    // copy still reads as "Name (id)" — acceptable for clipboard fallback.
    const display = (m.user.name ?? m.user.email ?? 'user').trim() || 'user'
    const before = draft.slice(0, mentionAnchor)
    const afterCaret = draft.slice(ta.selectionStart)
    const inserted = `@[${display}](${m.user.id}) `
    const next = before + inserted + afterCaret
    setDraft(next)
    setMentionQuery(null)
    setMentionAnchor(-1)
    requestAnimationFrame(() => {
      const newCaret = (before + inserted).length
      ta.focus()
      ta.setSelectionRange(newCaret, newCaret)
    })
  }

  useEffect(() => {
    setItems(readDiscussion(parameterId))
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ parameterId: string }>).detail
      if (!detail || detail.parameterId === parameterId) {
        setItems(readDiscussion(parameterId))
      }
    }
    window.addEventListener('param-discussion-change', handler)
    return () => window.removeEventListener('param-discussion-change', handler)
  }, [parameterId])

  const post = useCallback(() => {
    const body = draft.trim()
    if (!body) return
    const author = currentUser ?? { id: 'anon', name: 'You', email: 'you@local' }
    const next: DiscussionComment = {
      id: crypto.randomUUID ? crypto.randomUUID() : `c-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      authorId: author.id,
      authorName: author.name,
      authorEmail: author.email,
      body,
      createdAt: new Date().toISOString(),
    }
    const updated = [...items, next]
    writeDiscussion(parameterId, updated)
    setItems(updated)
    setDraft('')
  }, [draft, currentUser, items, parameterId])

  const remove = useCallback((id: string) => {
    const updated = items.filter((c) => c.id !== id)
    writeDiscussion(parameterId, updated)
    setItems(updated)
  }, [items, parameterId])

  return (
    <div className="pv-dr-section">
      <h4>
        Discussion
        <span className="pv-dr-section-aside">
          — {items.length === 0 ? 'no comments yet' : `${items.length} comment${items.length === 1 ? '' : 's'}`}
        </span>
      </h4>
      {items.map((c) => (
        <div key={c.id} className="pv-dr-comment">
          <span className="pv-avatar" title={c.authorEmail}>
            {initials(c.authorName, c.authorEmail)}
          </span>
          <div className="body">
            <div className="head">
              <b>{c.authorName || c.authorEmail}</b>
              <span className="when" title={c.createdAt}>{formatRelative(c.createdAt)}</span>
              {currentUser?.id === c.authorId && (
                <button
                  type="button"
                  onClick={() => remove(c.id)}
                  className="delete-btn"
                >
                  delete
                </button>
              )}
            </div>
            <div className="text">
              {renderCommentBody(c.body, members as MemberLite[], (anchor, userId) => {
                const r = anchor.getBoundingClientRect()
                setMentionPopover({ userId, rect: { top: r.bottom + 4, left: r.left } })
              })}
            </div>
          </div>
        </div>
      ))}
      <div className="pv-dr-comment-add" style={{ position: 'relative' }}>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => handleDraftChange(e.target.value, e.target.selectionStart ?? 0)}
          onKeyUp={(e) => {
            const ta = e.currentTarget
            if (mentionQuery === null) handleDraftChange(ta.value, ta.selectionStart ?? 0)
          }}
          onKeyDown={(e) => {
            if (mentionQuery !== null && mentionMatches.length > 0) {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setMentionIndex((i) => (i + 1) % mentionMatches.length)
                return
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                setMentionIndex((i) => (i - 1 + mentionMatches.length) % mentionMatches.length)
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
              post()
            }
          }}
          placeholder="Write a comment, mention @teammates or link PRM-/REQ-/VER-…  (Ctrl+Enter to post)"
          rows={2}
        />
        {mentionQuery !== null && mentionMatches.length > 0 && (
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
            {mentionMatches.map((m, i) => {
              const member = m as { user: { id: string; name?: string | null; email?: string | null } }
              const name = member.user.name || member.user.email || 'Unknown'
              const email = member.user.email ?? ''
              const active = i === mentionIndex
              return (
                <button
                  key={member.user.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onMouseDown={(e) => { e.preventDefault(); insertMention(i) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '6px 8px',
                    border: 0, borderRadius: 4,
                    background: active ? 'var(--pv-blue-tint)' : 'transparent',
                    color: active ? 'var(--pv-blue-ink)' : 'var(--pv-fg)',
                    cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'inherit', fontSize: 12,
                  }}
                >
                  <span
                    style={{
                      width: 22, height: 22, borderRadius: 999,
                      background: 'linear-gradient(135deg, #d6e2ec, #bccddb)',
                      color: 'var(--pv-fg-2)', fontSize: 10, fontWeight: 600,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {initials(name, email)}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {name}
                    </span>
                    {email && (
                      <span style={{ display: 'block', fontSize: 10, color: 'var(--pv-fg-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {email}
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        )}
        <div className="row">
          <span style={{ flex: 1, color: 'var(--pv-fg-3)', fontSize: 11 }}>
            @ to mention · Ctrl+Enter to post
          </span>
          <button
            type="button"
            onClick={post}
            disabled={!draft.trim()}
            className="pv-dr-btn primary"
            style={{ height: 24, padding: '0 10px', fontSize: 12 }}
          >
            <Send size={11} />
            Post
          </button>
        </div>
      </div>
      {mentionPopover && (() => {
        const target = (members as MemberLite[]).find((m) => m.user.id === mentionPopover.userId)
        // Flip vertically + clamp horizontally so the card never falls off the
        // viewport. Cap height + scroll the body so every control stays
        // reachable even on a short window.
        const POP_W = 280
        const POP_MAX_H = Math.min(360, Math.max(180, window.innerHeight - 32))
        const margin = 8
        const flipUp = mentionPopover.rect.top + POP_MAX_H + margin > window.innerHeight
        const top = flipUp
          ? Math.max(margin, mentionPopover.rect.top - POP_MAX_H - 16)
          : Math.min(window.innerHeight - POP_MAX_H - margin, mentionPopover.rect.top)
        const left = Math.min(window.innerWidth - POP_W - margin, Math.max(margin, mentionPopover.rect.left))
        const baseStyle: React.CSSProperties = {
          position: 'fixed',
          top, left,
          zIndex: 1000,
          width: POP_W,
          maxHeight: POP_MAX_H,
          overflowY: 'auto',
          background: 'var(--pv-bg)',
          border: '1px solid var(--pv-line)',
          borderRadius: 8,
          boxShadow: '0 12px 32px rgba(15,20,25,0.15)',
          padding: 14,
          fontSize: 12,
        }
        if (!target) {
          return (
            <>
              <div
                onClick={() => setMentionPopover(null)}
                style={{ position: 'fixed', inset: 0, zIndex: 999 }}
              />
              <div role="dialog" onClick={(e) => e.stopPropagation()} style={{ ...baseStyle, color: 'var(--pv-fg-3)' }}>
                User no longer in this project.
                <button
                  type="button"
                  onClick={() => setMentionPopover(null)}
                  className="pv-dr-btn ghost"
                  style={{ marginTop: 10, height: 24, fontSize: 11 }}
                >
                  Close
                </button>
              </div>
            </>
          )
        }
        const u = target.user
        const display = u.name || u.email || 'User'
        return (
          <>
            <div
              onClick={() => setMentionPopover(null)}
              style={{ position: 'fixed', inset: 0, zIndex: 999 }}
            />
            <div
              role="dialog"
              aria-label={`Profile of ${display}`}
              onClick={(e) => e.stopPropagation()}
              style={baseStyle}
            >
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                <span
                  style={{
                    width: 36, height: 36, borderRadius: 999,
                    background: 'linear-gradient(135deg, #d6e2ec, #bccddb)',
                    color: 'var(--pv-fg-2)', fontSize: 13, fontWeight: 600,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {initials(u.name ?? '', u.email ?? '')}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--pv-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{display}</div>
                  {u.email && (
                    <a
                      href={`mailto:${u.email}`}
                      style={{
                        display: 'block',
                        fontSize: 11,
                        color: 'var(--pv-blue-ink)',
                        textDecoration: 'underline',
                        textDecorationStyle: 'dotted',
                        textUnderlineOffset: 2,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}
                    >
                      {u.email}
                    </a>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setMentionPopover(null)}
                  className="pv-icon-btn"
                  style={{ width: 22, height: 22 }}
                  aria-label="Close"
                >
                  <X size={12} />
                </button>
              </div>
              <dl
                style={{
                  display: 'grid',
                  gridTemplateColumns: '88px 1fr',
                  rowGap: 6, columnGap: 12,
                  margin: 0, fontSize: 12,
                }}
              >
                <dt style={{ color: 'var(--pv-fg-3)' }}>Project role</dt>
                <dd style={{ margin: 0, color: 'var(--pv-fg)' }}>
                  {target.role
                    ? target.role.charAt(0).toUpperCase() + target.role.slice(1)
                    : '—'}
                </dd>
                {target.joinedAt && (
                  <>
                    <dt style={{ color: 'var(--pv-fg-3)' }}>Joined</dt>
                    <dd style={{ margin: 0, color: 'var(--pv-fg)' }}>
                      {format(new Date(target.joinedAt), 'd MMM yyyy')}
                    </dd>
                  </>
                )}
                <dt style={{ color: 'var(--pv-fg-3)' }}>Profile</dt>
                <dd style={{ margin: 0 }}>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      navigator.clipboard.writeText(u.id).then(() => {
                        setCopiedMention(u.id)
                        setTimeout(() => setCopiedMention(null), 1500)
                      }).catch(() => { /* ignore */ })
                    }}
                    title={`Copy user id: ${u.id}`}
                    style={{
                      color: 'var(--pv-blue-ink)',
                      fontStyle: 'italic',
                      textDecoration: 'underline',
                      textUnderlineOffset: 2,
                    }}
                  >
                    {copiedMention === u.id ? 'Copied id' : 'View profile'}
                  </a>
                </dd>
              </dl>
              <div
                style={{
                  marginTop: 10,
                  paddingTop: 10,
                  borderTop: '1px solid var(--pv-line-soft)',
                  fontSize: 11,
                  color: 'var(--pv-fg-3)',
                  lineHeight: 1.4,
                }}
              >
                Full multi-project profile + @-mention notifications: not yet wired.
              </div>
            </div>
          </>
        )
      })()}
    </div>
  )
}

// Timeline-mode field diff (legacy shape) — distinct from VersionDiff's FieldDiff.
interface TimelineFieldDiff {
  field: string
  label: string
  prev: string
  next: string
}

function computeDiff(prev: Record<string, unknown> | null, next: Record<string, unknown>): TimelineFieldDiff[] {
  const diffs: TimelineFieldDiff[] = []
  for (const field of TRACKED_FIELDS) {
    const prevVal = prev != null ? String(prev[field] ?? '') : ''
    const nextVal = String(next[field] ?? '')
    if (prevVal !== nextVal) {
      diffs.push({ field, label: FIELD_LABELS[field] ?? field, prev: prevVal, next: nextVal })
    }
  }
  return diffs
}

// NX-2 (#440) — fields whose change carries a line-level diff in <VersionDiff>.
const PARAM_MULTILINE_FIELDS = new Set(['description', 'formula'])

/** Line-level LCS — mirrors backend diffService.lineDiff for the client path. */
function lineDiffClient(before: string, after: string): { op: 'eq' | 'add' | 'del'; text: string }[] {
  const a = before.split('\n')
  const b = after.split('\n')
  const n = a.length
  const m = b.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const ops: { op: 'eq' | 'add' | 'del'; text: string }[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push({ op: 'eq', text: a[i] }); i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ op: 'del', text: a[i] }); i++ }
    else { ops.push({ op: 'add', text: b[j] }); j++ }
  }
  while (i < n) { ops.push({ op: 'del', text: a[i] }); i++ }
  while (j < m) { ops.push({ op: 'add', text: b[j] }); j++ }
  return ops
}

/**
 * NX-2 (#440) — build the structured FieldDiff[] <VersionDiff> consumes from
 * two parameter snapshots. Uses TRACKED_FIELDS as the field list, mirroring the
 * backend diffService.fieldLevelDiff classification.
 */
function buildParamFieldDiffs(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
): FieldDiff[] {
  return TRACKED_FIELDS.map((name) => {
    const before = String(prev[name] ?? '')
    const after = String(next[name] ?? '')
    let changeType: FieldDiff['changeType']
    if (before === after) changeType = 'unchanged'
    else if (before === '' && after !== '') changeType = 'added'
    else if (before !== '' && after === '') changeType = 'removed'
    else changeType = 'changed'
    const entry: FieldDiff = { name, changeType, before, after }
    if (changeType === 'changed' && PARAM_MULTILINE_FIELDS.has(name)) {
      entry.lineDiff = lineDiffClient(before, after)
    }
    return entry
  })
}

// Inline avatar + name chip used in Provenance + Timeline.
function AuthorChip({ name, email, subtitle }: { name?: string | null; email?: string | null; subtitle?: string }) {
  const display = name?.trim() || email || 'Unknown'
  return (
    <span className="pv-dr-author">
      <span className="pv-avatar" aria-hidden>{initials(name ?? undefined, email ?? undefined)}</span>
      {display}
      {subtitle && (
        <span style={{ color: 'var(--pv-fg-3)', fontSize: 11, marginLeft: 4 }}>· {subtitle}</span>
      )}
    </span>
  )
}

// Classify a version-to-version diff into one of the timeline event kinds.
function classifyDiff(diffs: TimelineFieldDiff[], origIdx: number): 'publish' | 'stale' | 'edit' | 'created' {
  if (origIdx === 0) return 'created'
  const statusDiff = diffs.find(d => d.field === 'status')
  if (statusDiff && /^(approved|released)$/i.test(statusDiff.next)) return 'publish'
  if (diffs.some(d => d.field === 'defaultValue')) return 'stale'
  return 'edit'
}

export default function ParameterDetailDrawer({
  isOpen,
  onClose,
  projectId,
  parameter,
  onEdit,
  allParameters = [],
  defaultExpanded = false,
}: ParameterDetailDrawerProps) {
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null)
  // Compare mode: null = timeline view, otherwise two version IDs are selected
  const [compareMode, setCompareMode] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Multi-user presence — broadcast to anyone else viewing this same
  // parameter and receive their viewer set in return.
  const selfUser = useAuthStore((s) => s.user)
  const otherViewers = useParameterPresence(
    isOpen ? projectId : undefined,
    isOpen ? parameter?.id ?? null : null,
    selfUser?.id,
  )
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null)
  // Pending restore confirmation: versionId waiting for user to confirm
  const [pendingRestoreId, setPendingRestoreId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 1500)
    }).catch(() => { /* ignore */ })
  }

  const handleRestoreVersion = async (versionId: string) => {
    if (!parameter?.id) return
    setRestoringVersionId(versionId)
    setPendingRestoreId(null)
    try {
      const res = await parameterService.restoreVersion(projectId, parameter.id, versionId)
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['parameters', projectId] })
        queryClient.invalidateQueries({ queryKey: ['parameter-versions', projectId, parameter.id] })
      }
    } catch { /* ignore */ } finally {
      setRestoringVersionId(null)
    }
  }
  const [compareA, setCompareA] = useState<string | null>(null)  // older
  const [compareB, setCompareB] = useState<string | null>(null)  // newer

  const { data: impact, isLoading: impactLoading } = useQuery({
    queryKey: ['parameter-impact', projectId, parameter?.id],
    queryFn: async () => {
      if (!projectId || !parameter?.id) return null
      const res = await parameterService.getImpact(projectId, parameter.id)
      return res.success && res.data ? res.data : null
    },
    enabled: isOpen && !!projectId && !!parameter?.id,
  })

  const { data: versions = [], isLoading: versionsLoading } = useQuery({
    queryKey: ['parameter-versions', projectId, parameter?.id],
    queryFn: async () => {
      if (!projectId || !parameter?.id) return []
      const res = await parameterService.getVersions(projectId, parameter.id)
      return res.success && res.data ? res.data : []
    },
    enabled: isOpen && !!projectId && !!parameter?.id,
  })

  // Reset compare state when switching to a different parameter
  useEffect(() => {
    setCompareMode(false)
    setCompareA(null)
    setCompareB(null)
  }, [parameter?.id])

  const requirements = impact?.requirements ?? []
  const showShell = isOpen && !!parameter

  // Expanded mode — fills the workspace, hiding the table behind it.
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  // Inline more-menu in drawer header
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const moreMenuRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!isMoreOpen) return
    const onDoc = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [isMoreOpen])
  // Pending delete confirm (inline two-step)
  const [pendingDelete, setPendingDelete] = useState(false)
  // Reset menu state on parameter switch
  useEffect(() => {
    setIsMoreOpen(false)
    setPendingDelete(false)
    setIsExpanded(defaultExpanded)
  }, [parameter?.id, defaultExpanded])
  // Drag-to-resize drawer width. Persisted per tab; defaults to ~36rem.
  const [drawerWidth, setDrawerWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 576
    const stored = window.localStorage.getItem('parameter-drawer-width')
    const n = stored ? parseInt(stored, 10) : NaN
    return Number.isFinite(n) && n >= 384 ? n : 576
  })
  const handleResizeStart = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = drawerWidth
    const onMove = (ev: MouseEvent) => {
      const next = Math.max(384, Math.min(window.innerWidth - 240, startW + (startX - ev.clientX)))
      setDrawerWidth(next)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      setDrawerWidth(w => {
        if (typeof window !== 'undefined') window.localStorage.setItem('parameter-drawer-width', String(w))
        return w
      })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const status = (parameter?.status ?? 'draft').toLowerCase()
  const statusClass = status === 'approved'
    ? 'released'
    : status === 'obsolete'
      ? 'obsolete'
      : status === 'review' || status === 'in_review'
        ? 'review'
        : 'draft'
  const statusLabel = status === 'approved'
    ? 'Released'
    : status === 'obsolete'
      ? 'Obsolete'
      : status === 'review' || status === 'in_review'
        ? 'In review'
        : 'Draft'

  function typeBucket(t: string | null | undefined): 'float' | 'int' | 'bool' | 'str' | '' {
    if (!t) return ''
    const lower = t.toLowerCase()
    if (lower.includes('float') || lower.includes('double') || lower.includes('real') || lower.includes('number')) return 'float'
    if (lower.includes('int') || lower.includes('uint')) return 'int'
    if (lower.includes('bool')) return 'bool'
    if (lower.includes('str') || lower.includes('text') || lower.includes('char')) return 'str'
    return ''
  }
  const typeTagBucket = typeBucket(parameter?.dataType)

  return (
    <div
      className={clsx(
        showShell
          ? clsx('pv-drawer-shell flex-shrink-0', isExpanded && 'is-expanded')
          : 'w-0 min-w-0 h-full transition-all duration-300 ease-in-out'
      )}
      style={showShell && !isExpanded ? { width: drawerWidth, minWidth: 384 } : undefined}
      role={showShell ? 'dialog' : undefined}
      aria-label={showShell ? 'Parameter details' : undefined}
    >
      {showShell && parameter && (
        <>
          {/* Resize handle on left edge */}
          <button
            type="button"
            className="pv-drawer-resize"
            onMouseDown={handleResizeStart}
            aria-label="Resize drawer"
          />

          {/* HEADER — id + name + actions */}
          <div className="pv-dr-head">
            <span className="pv-dr-id">
              {parameter.parameterId || parameter.id.substring(0, 8)}
            </span>
            <span className="pv-dr-name" title={parameter.name}>{parameter.name}</span>
            <span className="pv-dr-spacer" />
            {otherViewers.length > 0 && (
              <span
                className="pv-dr-pill review"
                title={otherViewers.map((v) => v.email ?? v.userId).join(', ')}
                style={{ marginRight: 4 }}
              >
                <Eye size={11} />
                {otherViewers.length === 1 ? '1 viewing' : `${otherViewers.length} viewing`}
              </span>
            )}
            <button
              type="button"
              onClick={() => copyToClipboard(parameter.name, 'header-name')}
              className="pv-icon-btn"
              title="Copy reference"
              aria-label="Copy reference"
            >
              <Link2 size={14} />
            </button>
            <button
              type="button"
              onClick={() => {
                const url = `${window.location.pathname}?param=${parameter.id}`
                window.open(url, '_blank', 'noopener,noreferrer')
              }}
              className="pv-icon-btn"
              title="Open in new tab"
              aria-label="Open in new tab"
            >
              <ExternalLink size={14} />
            </button>
            <button
              type="button"
              className="pv-icon-btn"
              title={isExpanded ? 'Collapse' : 'Expand'}
              aria-label={isExpanded ? 'Collapse drawer' : 'Expand drawer'}
              onClick={() => setIsExpanded((v) => !v)}
            >
              <Maximize2 size={13} />
            </button>
            <div ref={moreMenuRef} style={{ position: 'relative' }}>
              <button
                type="button"
                className="pv-icon-btn"
                title="More actions"
                aria-label="More actions"
                aria-expanded={isMoreOpen}
                onClick={() => setIsMoreOpen((v) => !v)}
              >
                <MoreHorizontal size={14} />
              </button>
              {isMoreOpen && (
                <div
                  role="menu"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    right: 0,
                    zIndex: 60,
                    minWidth: 220,
                    background: 'var(--pv-bg)',
                    border: '1px solid var(--pv-line)',
                    borderRadius: 6,
                    boxShadow: '0 8px 24px rgba(15,20,25,0.12)',
                    padding: 4,
                    fontSize: 12,
                  }}
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setIsMoreOpen(false); onEdit(parameter); onClose() }}
                    style={menuItemStyle}
                  >
                    <Edit2 size={12} /> Edit parameter
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      copyToClipboard(parameter.parameterId || parameter.id, 'menu-copy-id')
                      setIsMoreOpen(false)
                    }}
                    style={menuItemStyle}
                  >
                    <Copy size={12} /> Copy ID
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      copyToClipboard(`${window.location.origin}${window.location.pathname}?param=${parameter.id}`, 'menu-copy-url')
                      setIsMoreOpen(false)
                    }}
                    style={menuItemStyle}
                  >
                    <Link2 size={12} /> Copy permalink
                  </button>
                  <div style={{ borderTop: '1px solid var(--pv-line-soft)', margin: '4px 0' }} />
                  <div style={{ padding: '4px 10px 2px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--pv-fg-3)' }}>
                    Set status
                  </div>
                  {(['draft', 'approved', 'obsolete'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      role="menuitem"
                      onClick={async () => {
                        setIsMoreOpen(false)
                        await parameterService.updateParameter(projectId, parameter.id, { status: s })
                        queryClient.invalidateQueries({ queryKey: ['parameters', projectId] })
                      }}
                      style={{
                        ...menuItemStyle,
                        color: (parameter.status ?? 'draft') === s ? 'var(--pv-blue-ink)' : 'var(--pv-fg)',
                        fontWeight: (parameter.status ?? 'draft') === s ? 500 : 400,
                      }}
                    >
                      <span
                        style={{
                          width: 8, height: 8, borderRadius: 999,
                          background:
                            s === 'approved' ? 'var(--pv-green)' :
                            s === 'obsolete' ? 'var(--pv-red)' :
                            'var(--pv-fg-3)',
                          display: 'inline-block',
                        }}
                      />
                      {s === 'approved' ? 'Released' : s === 'obsolete' ? 'Obsolete' : 'Draft'}
                      {(parameter.status ?? 'draft') === s && (
                        <span style={{ marginLeft: 'auto', fontSize: 10 }}>✓</span>
                      )}
                    </button>
                  ))}
                  <div style={{ borderTop: '1px solid var(--pv-line-soft)', margin: '4px 0' }} />
                  {!pendingDelete ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => setPendingDelete(true)}
                      style={{ ...menuItemStyle, color: 'var(--pv-red)' }}
                    >
                      <X size={12} /> Delete parameter
                    </button>
                  ) : (
                    <div style={{ padding: '4px 10px', display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ flex: 1, fontSize: 11, color: 'var(--pv-red)' }}>Delete?</span>
                      <button
                        type="button"
                        onClick={async () => {
                          setIsMoreOpen(false)
                          setPendingDelete(false)
                          await parameterService.deleteParameter(projectId, parameter.id)
                          queryClient.invalidateQueries({ queryKey: ['parameters', projectId] })
                          onClose()
                        }}
                        className="pv-dr-btn"
                        style={{ height: 22, padding: '0 8px', fontSize: 11, color: '#fff', background: 'var(--pv-red)', borderColor: 'var(--pv-red)' }}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(false)}
                        className="pv-dr-btn ghost"
                        style={{ height: 22, padding: '0 8px', fontSize: 11 }}
                      >
                        No
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="pv-icon-btn"
              aria-label="Close"
              title="Close"
            >
              <X size={15} />
            </button>
          </div>

          {/* SUB-HEADER — pills + display name + description */}
          <div className="pv-dr-sub">
            <div className="pv-dr-pills">
              {parameter.dataType && (
                <span className={clsx('pv-dr-pill', typeTagBucket)}>{parameter.dataType}</span>
              )}
              <span className={clsx('pv-dr-pill', statusClass)}>
                {statusLabel}
              </span>
              {parameter.unit && (
                <span className="pv-dr-pill">{parameter.unit}</span>
              )}
              {parameter.tags && parameter.tags.length > 0 && parameter.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="pv-dr-pill tag">{tag}</span>
              ))}
              {parameter.tags && parameter.tags.length > 3 && (
                <span className="pv-dr-pill">+{parameter.tags.length - 3}</span>
              )}
            </div>
            <div>
              <span className="pv-dr-display">{parameter.name}</span>
              {parameter.parameterId && (
                <span className="pv-dr-display-id">{parameter.parameterId}</span>
              )}
            </div>
            {parameter.description && (
              <p className="pv-dr-desc">{parameter.description}</p>
            )}
          </div>

          <div className="pv-dr-body">
          {/* DIFF / STALE banner — value changed since prior version */}
          {(() => {
            if (versions.length < 2) return null
            const latest = versions[versions.length - 1]
            const prev = versions[versions.length - 2]
            const diffs = computeDiff(prev.snapshot as Record<string, unknown>, latest.snapshot as Record<string, unknown>)
            const valDiff = diffs.find(d => d.field === 'defaultValue')
            if (!valDiff) return null
            const fromN = parseFloat(valDiff.prev)
            const toN = parseFloat(valDiff.next)
            const pct = (!isNaN(fromN) && !isNaN(toN) && fromN !== 0)
              ? `${toN > fromN ? '+' : ''}${(((toN - fromN) / Math.abs(fromN)) * 100).toFixed(1)}%`
              : null
            return (
              <div className="pv-dr-diff">
                <div className="row">
                  <span className="label">Value</span>
                  <span className="from">{valDiff.prev || '—'}</span>
                  <span style={{ color: 'var(--pv-fg-3)' }}>→</span>
                  <span className="to">{valDiff.next || '—'}{parameter.unit ? ` ${parameter.unit}` : ''}</span>
                  {pct && <span className="meta">{pct}</span>}
                </div>
                <div className="row">
                  <span className="label">Edited</span>
                  <span style={{ fontFamily: 'var(--pv-font-mono)', fontSize: 11.5, color: 'var(--pv-fg-2)' }}>
                    v{latest.version}.{String((latest as unknown as Record<string, unknown>).minorVersion ?? 0)}
                  </span>
                  <span className="meta">
                    {formatDistanceToNow(new Date(latest.createdAt), { addSuffix: true })}
                    {latest.createdBy?.name ? ` · ${latest.createdBy.name}` : ''}
                  </span>
                </div>
              </div>
            )
          })()}

          {/* CURRENT VALUE */}
          {(parameter.defaultValue != null || parameter.unit) && (
            <div className="pv-dr-section">
              <h4>Current value</h4>
              <div className="pv-dr-value">
                <span className="val">{parameter.defaultValue ?? '—'}</span>
                {parameter.unit && <span className="unit">{parameter.unit}</span>}
                <span className="vsep" />
                {parameter.tolerance && (
                  <span className="baseline">
                    tolerance<b>{parameter.tolerance}</b>
                  </span>
                )}
              </div>
              {parameter.formula && (
                <div className="pv-dr-formula">
                  <span className="f">ƒ</span>{parameter.formula}
                </div>
              )}
            </div>
          )}

          {/* DEFINITION */}
          <div className="pv-dr-section">
            <h4>Definition</h4>
            <dl className="pv-dr-kv">
              <dt>Name</dt>
              <dd>
                <span className="pv-mono" style={{ marginRight: 6 }}>{parameter.name}</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(parameter.name, 'name')}
                  className="pv-icon-btn"
                  style={{ width: 20, height: 20, verticalAlign: 'middle' }}
                  title="Copy name"
                >
                  {copiedField === 'name'
                    ? <span style={{ fontSize: 10, color: 'var(--pv-green)' }}>✓</span>
                    : <Copy size={11} />}
                </button>
              </dd>
              {parameter.parameterId && (
                <>
                  <dt>Parameter ID</dt>
                  <dd>
                    <span className="pv-mono" style={{ marginRight: 6 }}>{parameter.parameterId}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(parameter.parameterId!, 'parameterId')}
                      className="pv-icon-btn"
                      style={{ width: 20, height: 20, verticalAlign: 'middle' }}
                      title="Copy parameter ID"
                    >
                      {copiedField === 'parameterId'
                        ? <span style={{ fontSize: 10, color: 'var(--pv-green)' }}>✓</span>
                        : <Copy size={11} />}
                    </button>
                  </dd>
                </>
              )}
              {parameter.dataType && (
                <>
                  <dt>Type</dt>
                  <dd><span className="pv-mono">{parameter.dataType}</span></dd>
                </>
              )}
              {parameter.unit && (
                <>
                  <dt>Unit</dt>
                  <dd><span className="pv-mono">{parameter.unit}</span></dd>
                </>
              )}
              {(parameter.minValue != null || parameter.maxValue != null) && (
                <>
                  <dt>Range</dt>
                  <dd>
                    <span className="pv-mono">
                      [{parameter.minValue ?? '—'}, {parameter.maxValue ?? '—'}]
                    </span>
                  </dd>
                </>
              )}
              {parameter.tolerance && (
                <>
                  <dt>Tolerance</dt>
                  <dd><span className="pv-mono">{parameter.tolerance}</span></dd>
                </>
              )}
              {parameter.tags && parameter.tags.length > 0 && (
                <>
                  <dt>Tags</dt>
                  <dd>
                    {parameter.tags.map((t) => (
                      <span key={t} className="pv-dr-pill tag" style={{ marginRight: 4 }}>{t}</span>
                    ))}
                  </dd>
                </>
              )}
              {parameter.sourceFunction && (
                <>
                  <dt>Source function</dt>
                  <dd>
                    <span className="pv-mono">
                      {parameter.sourceFunction.functionId || 'N/A'}: {parameter.sourceFunction.name}
                    </span>
                  </dd>
                </>
              )}
            </dl>
          </div>

          {/* Formula */}
          {parameter.formula && (() => {
            const paramValues = allParameters.reduce<Record<string, number>>((acc, p) => {
              const v = parseFloat(p.defaultValue ?? '')
              if (!isNaN(v)) acc[p.id] = v
              return acc
            }, {})
            const { result, error, usedParamIds } = evaluateFormula(parameter.formula, paramValues)
            const referencedParams = usedParamIds
              .map(id => allParameters.find(p => p.id === id))
              .filter((p): p is Parameter => p !== undefined)

            // Build human-readable formula (replace {{param:ID}} with parameter names)
            let humanFormula = parameter.formula
            for (const p of referencedParams) {
              humanFormula = humanFormula.replace(
                new RegExp(`\\{\\{param:${p.id}\\}\\}`, 'gi'),
                `[${p.name}]`
              )
            }

            return (
              <div className="pv-dr-section">
                <h4>Formula</h4>
                <dl className="pv-dr-kv">
                  <dt>Expression</dt>
                  <dd><span className="pv-mono" style={{ wordBreak: 'break-all' }}>{humanFormula}</span></dd>
                  {error ? (
                    <>
                      <dt>Status</dt>
                      <dd style={{ color: 'var(--pv-amber)' }}>Cannot evaluate — {error}</dd>
                    </>
                  ) : result !== null ? (
                    <>
                      <dt>Result</dt>
                      <dd>
                        <span className="pv-mono" style={{ color: 'var(--pv-green)', fontWeight: 600 }}>
                          = {result}
                        </span>
                      </dd>
                    </>
                  ) : null}
                  {referencedParams.length > 0 && (
                    <>
                      <dt>References</dt>
                      <dd>
                        {referencedParams.map(p => (
                          <span
                            key={p.id}
                            className="pv-dr-pill float"
                            style={{ marginRight: 4 }}
                            title={p.defaultValue ? `default: ${p.defaultValue}` : 'no default value'}
                          >
                            {p.name}{p.defaultValue ? ` = ${p.defaultValue}` : ''}
                          </span>
                        ))}
                      </dd>
                    </>
                  )}
                </dl>
              </div>
            )
          })()}

          {/* SOURCE & PROVENANCE */}
          {(() => {
            const lastVersion = versions.length > 0 ? versions[versions.length - 1] : null
            const firstVersion = versions.length > 0 ? versions[0] : null
            const hasOrigin = !!parameter.sourceFunction
            const hasEditor = !!lastVersion?.createdBy
            if (!hasOrigin && !hasEditor && !firstVersion) return null
            const fnLink = parameter.sourceFunction
              ? `/projects/${projectId}/functions?selectedId=${parameter.sourceFunction.id}`
              : null
            return (
              <div className="pv-dr-section">
                <h4>Source &amp; provenance</h4>
                <dl className="pv-dr-kv">
                  <dt>Origin</dt>
                  <dd>
                    {parameter.sourceFunction ? (
                      <>
                        <Link to={fnLink!} className="src-link">
                          {parameter.sourceFunction.functionId || parameter.sourceFunction.name}
                        </Link>
                        <span style={{ color: 'var(--pv-fg-3)', marginLeft: 6 }}>· system function</span>
                      </>
                    ) : (
                      <span style={{ color: 'var(--pv-fg-3)' }}>Manual entry</span>
                    )}
                  </dd>
                  <dt>Sync method</dt>
                  <dd>
                    <span style={{ color: 'var(--pv-fg-2)' }}>
                      {parameter.sourceFunction ? 'Function-derived · auto on commit' : 'Manual'}
                    </span>
                    {lastVersion && (
                      <span style={{ color: 'var(--pv-fg-3)', fontSize: 11, marginLeft: 6 }}>
                        · last sync {format(new Date(lastVersion.createdAt), 'd MMM HH:mm')}
                      </span>
                    )}
                  </dd>
                  {lastVersion?.createdBy && (
                    <>
                      <dt>Last edited by</dt>
                      <dd>
                        <AuthorChip
                          name={lastVersion.createdBy.name}
                          email={lastVersion.createdBy.email}
                          subtitle={`v${lastVersion.version}.${String((lastVersion as unknown as Record<string, unknown>).minorVersion ?? 0)}`}
                        />
                      </dd>
                    </>
                  )}
                  {firstVersion?.createdBy && versions.length > 1 && (
                    <>
                      <dt>Created by</dt>
                      <dd>
                        <AuthorChip
                          name={firstVersion.createdBy.name}
                          email={firstVersion.createdBy.email}
                          subtitle={format(new Date(firstVersion.createdAt), 'd MMM yyyy')}
                        />
                      </dd>
                    </>
                  )}
                </dl>
              </div>
            )
          })()}

          {/* USED IN — linked requirements */}
          <div className="pv-dr-section">
            <h4>
              Used in
              <span className="pv-dr-section-aside">
                — {requirements.length} reference{requirements.length === 1 ? '' : 's'}
              </span>
            </h4>
            {impactLoading ? (
              <p style={{ fontSize: 12, color: 'var(--pv-fg-3)', margin: 0 }}>Loading…</p>
            ) : requirements.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--pv-fg-3)', margin: 0 }}>
                No requirements reference this parameter.
              </p>
            ) : (
              <div className="pv-dr-refs">
                {requirements.slice(0, 10).map((req) => (
                  <Link
                    key={req.id}
                    to={`/projects/${projectId}/requirements?requirementId=${req.id}`}
                    className="pv-dr-ref"
                  >
                    <span className="ref-kind req">
                      <ListChecks size={13} />
                    </span>
                    <span className="ref-id">{req.requirementId || req.id.slice(0, 8)}</span>
                    <span className="ref-title" title={req.title ?? ''}>
                      {req.title || 'Untitled'}
                    </span>
                  </Link>
                ))}
                {requirements.length > 10 && (
                  <span className="more-link">
                    View all {requirements.length} references →
                  </span>
                )}
              </div>
            )}
          </div>

          {/* CHANGE HISTORY */}
          <div className="pv-dr-section">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <h4 style={{ margin: 0 }}>
                Recent history
                {versions.length > 0 && (
                  <span className="pv-dr-section-aside">
                    — {versions.length} version{versions.length !== 1 ? 's' : ''}
                  </span>
                )}
              </h4>
              {versions.length >= 2 && (
                <button
                  type="button"
                  onClick={() => {
                    setCompareMode(!compareMode)
                    setCompareA(null)
                    setCompareB(null)
                  }}
                  className={clsx('pv-dr-btn ghost', compareMode && 'primary')}
                  style={{ height: 24, padding: '0 8px', fontSize: 11 }}
                >
                  <GitCompare size={11} />
                  {compareMode ? 'Cancel compare' : 'Compare'}
                </button>
              )}
            </div>

            {versionsLoading ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
            ) : versions.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No version history yet.</p>
            ) : compareMode ? (
              // ── Compare mode ──────────────────────────────────────────────
              <div className="space-y-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Select two versions to compare. Click a version row to set it as A (older) or B (newer).
                </p>
                {/* Version selection list */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden divide-y divide-gray-200 dark:divide-gray-700">
                  {[...versions].reverse().map((v) => {
                    const vLabel = `v${v.version}.${String((v as unknown as Record<string, unknown>).minorVersion ?? 0)}`
                    const isA = compareA === v.id
                    const isB = compareB === v.id
                    return (
                      <div key={v.id} className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                        isA ? 'bg-orange-50 dark:bg-orange-900/20' : isB ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                        onClick={() => {
                          if (isA) { setCompareA(null); return }
                          if (isB) { setCompareB(null); return }
                          if (!compareA) { setCompareA(v.id); return }
                          if (!compareB) { setCompareB(v.id); return }
                          // Both set: replace the one with older index
                          setCompareA(v.id); setCompareB(null)
                        }}
                      >
                        <span className={`text-xs font-bold w-5 text-center ${isA ? 'text-orange-600 dark:text-orange-400' : isB ? 'text-blue-600 dark:text-blue-400' : 'text-gray-300 dark:text-gray-600'}`}>
                          {isA ? 'A' : isB ? 'B' : '○'}
                        </span>
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-14 flex-shrink-0">{vLabel}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{format(new Date(v.createdAt), 'MMM d, yyyy HH:mm')}</span>
                        <span className="text-xs text-gray-400 mx-1">·</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{v.createdBy?.name ?? 'Unknown'}</span>
                      </div>
                    )
                  })}
                </div>

                {/* NX-2 (#440) — shared <VersionDiff> replaces the bespoke table */}
                {compareA && compareB ? (() => {
                  const vA = versions.find(v => v.id === compareA)
                  const vB = versions.find(v => v.id === compareB)
                  if (!vA || !vB) return null

                  const labelA = `A · v${vA.version}.${String((vA as unknown as Record<string, unknown>).minorVersion ?? 0)}`
                  const labelB = `B · v${vB.version}.${String((vB as unknown as Record<string, unknown>).minorVersion ?? 0)}`

                  const fieldDiffs = buildParamFieldDiffs(
                    vA.snapshot as Record<string, unknown>,
                    vB.snapshot as Record<string, unknown>,
                  )

                  return (
                    <VersionDiff
                      fields={fieldDiffs}
                      labelA={labelA}
                      labelB={labelB}
                      fieldLabels={FIELD_LABELS}
                    />
                  )
                })() : (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Select two versions to compare.
                  </p>
                )}
              </div>
            ) : (
              // ── Timeline mode — newest first, design's pv-dr-timeline ─────
              <div className="pv-dr-timeline">
                {[...versions].reverse().map((v, displayIdx) => {
                  const origIdx = versions.length - 1 - displayIdx
                  const prevSnapshot = origIdx > 0 ? (versions[origIdx - 1].snapshot as Record<string, unknown>) : null
                  const diffs = computeDiff(prevSnapshot, v.snapshot as Record<string, unknown>)
                  const kind = classifyDiff(diffs, origIdx)
                  const isExpanded = expandedVersionId === v.id
                  const isCurrent = displayIdx === 0
                  const vLabel = `v${v.version}.${String((v as unknown as Record<string, unknown>).minorVersion ?? 0)}`

                  // Headline action text per kind
                  let action: React.ReactNode
                  if (kind === 'created') action = <><b>Created</b> initial version</>
                  else if (kind === 'publish') action = <><b>Released</b> on {vLabel}</>
                  else if (kind === 'stale') {
                    const valDiff = diffs.find(d => d.field === 'defaultValue')
                    action = <><b>Value updated</b>{valDiff ? <> · <span style={{ fontFamily: 'var(--pv-font-mono)' }}>{valDiff.prev || '—'} → {valDiff.next || '—'}</span></> : null}</>
                  }
                  else action = <><b>{diffs[0]?.label ?? 'Edited'}</b>{diffs.length > 1 ? ` + ${diffs.length - 1} more` : ''}</>

                  const detail = diffs.length > 0
                    ? diffs.slice(0, 3).map(d => `${d.label}: ${d.prev || '—'} → ${d.next || '—'}`).join(' · ')
                    : (origIdx === 0 ? 'Initial version' : 'No tracked changes')

                  return (
                    <div key={v.id} className={clsx('pv-dr-event', kind === 'publish' && 'is-publish', kind === 'stale' && 'is-stale', kind === 'edit' && 'is-edit')}>
                      <button
                        type="button"
                        onClick={() => setExpandedVersionId(isExpanded ? null : v.id)}
                        style={{ background: 'none', border: 0, padding: 0, width: '100%', textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit' }}
                      >
                        <div className="e-row">
                          <span className="e-action">
                            {action}
                            {isCurrent && <span style={{ marginLeft: 6, color: 'var(--pv-blue-ink)', fontSize: 11 }}>· current</span>}
                          </span>
                          <span className="e-meta">
                            {formatDistanceToNow(new Date(v.createdAt), { addSuffix: false })}
                          </span>
                        </div>
                        <div className="e-detail">
                          {vLabel} · {v.createdBy?.name ?? 'Unknown'} · {detail}
                        </div>
                      </button>
                      {isExpanded && diffs.length > 0 && (
                        <div style={{ marginTop: 6, paddingLeft: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {diffs.map(d => (
                            <div key={d.field} style={{ fontSize: 11.5, fontFamily: 'var(--pv-font-mono)' }}>
                              <span style={{ color: 'var(--pv-fg-3)', marginRight: 6 }}>{d.label}</span>
                              <span style={{ textDecoration: 'line-through', color: 'var(--pv-fg-3)' }}>{d.prev || '—'}</span>
                              <span style={{ color: 'var(--pv-fg-3)', margin: '0 6px' }}>→</span>
                              <span style={{ color: 'var(--pv-fg)', fontWeight: 600 }}>{d.next || '—'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {!isCurrent && (
                        <div style={{ marginTop: 4 }}>
                          {pendingRestoreId === v.id ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 10, color: 'var(--pv-fg-3)' }}>Restore this version?</span>
                              <button
                                type="button"
                                onClick={() => handleRestoreVersion(v.id)}
                                disabled={restoringVersionId === v.id}
                                className="pv-dr-btn"
                                style={{ height: 22, padding: '0 8px', fontSize: 11, color: 'var(--pv-amber)', borderColor: 'var(--pv-amber-line)' }}
                              >
                                <RotateCcw size={10} />
                                {restoringVersionId === v.id ? 'Restoring…' : 'Yes, restore'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setPendingRestoreId(null)}
                                className="pv-dr-btn ghost"
                                style={{ height: 22, padding: '0 8px', fontSize: 11 }}
                              >
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPendingRestoreId(v.id)}
                              disabled={restoringVersionId === v.id}
                              className="pv-dr-btn ghost"
                              style={{ height: 22, padding: '0 8px', fontSize: 11 }}
                              title="Restore to this version"
                            >
                              <RotateCcw size={10} />
                              Restore
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>{/* end change history pv-dr-section */}

          {/* Discussion (chat) — localStorage-backed comments per parameter */}
          <DiscussionSection
            projectId={projectId}
            parameterId={parameter.id}
            currentUser={
              selfUser
                ? { id: selfUser.id, name: selfUser.name ?? '', email: selfUser.email ?? '' }
                : null
            }
          />
          </div>{/* end pv-dr-body */}

          {/* FOOTER — adaptive: function-sourced shows source flow, manual shows edit flow */}
          <div className="pv-dr-foot">
            <span className="left">
              {parameter.sourceFunction ? (
                <>
                  <Lock size={12} />
                  Read-only · sourced from{' '}
                  <span className="pv-mono" style={{ marginLeft: 4 }}>
                    {parameter.sourceFunction.functionId || parameter.sourceFunction.name}
                  </span>
                </>
              ) : (
                <>
                  <SlidersHorizontal size={12} />
                  Manual entry
                </>
              )}
            </span>
            <span className="right">
              {parameter.sourceFunction ? (
                <>
                  <Link
                    to={`/projects/${projectId}/functions?selectedId=${parameter.sourceFunction.id}`}
                    className="pv-dr-btn ghost"
                  >
                    <ExternalLink size={11} />
                    View source
                  </Link>
                  {versions.length >= 2 && (
                    <button
                      type="button"
                      onClick={() => {
                        setCompareMode(true)
                        setCompareA(versions[versions.length - 2].id)
                        setCompareB(versions[versions.length - 1].id)
                      }}
                      className="pv-dr-btn"
                    >
                      <GitCompare size={11} />
                      View diff
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { onEdit(parameter); onClose() }}
                    className="pv-dr-btn primary"
                    title="Override the function-derived value locally"
                  >
                    <Edit2 size={11} />
                    Override locally
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(parameter.name, 'footer-ref')}
                    className="pv-dr-btn ghost"
                    title="Copy parameter reference"
                  >
                    <Code2 size={11} />
                    Copy ref
                  </button>
                  <button
                    type="button"
                    onClick={() => { onEdit(parameter); onClose() }}
                    className="pv-dr-btn"
                  >
                    <Edit2 size={11} />
                    Edit
                  </button>
                  <button
                    type="button"
                    className="pv-dr-btn primary"
                    onClick={() => { onEdit(parameter); onClose() }}
                  >
                    <GitPullRequestArrow size={11} />
                    Open
                  </button>
                </>
              )}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
