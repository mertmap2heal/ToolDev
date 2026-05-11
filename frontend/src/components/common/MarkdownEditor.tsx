import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import {
  Bold, Italic, Strikethrough, Heading, Quote, Code, Link2 as LinkIcon,
  List, ListOrdered, CheckSquare, Table, Code2,
} from 'lucide-react'
import { parseEntityRefs, EntityRefChip } from '../../utils/entityRefs'

// Standardised Markdown editor — the single canonical text-input the rest of
// the app builds on (see memory/feedback_markdown_editor.md and
// memory/feedback_universal_chat.md).
//
// Surface, GitLab-style:
//   - Tabs: Write / Preview
//   - Toolbar of formatting actions (B / I / S / heading / quote / inline
//     code / link / bullet list / numbered list / task list / table /
//     code block). Each inserts markdown tokens at the caret or around the
//     selection — never the contents of the document.
//   - @mention autocomplete: type '@' to open a member popover. Selection
//     persists as `@[Name](userId)` so preview can render a chip even when
//     the display name changes.
//   - Cross-entity refs (REQ-001 / VAL-014 / PRM-002 ...) recognised inline
//     and rendered as chips in preview by the parseEntityRefs util.
//   - GFM via marked + DOMPurify; output is sanitised HTML walked into
//     React nodes — never set via dangerouslySetInnerHTML.
//
// Public contract is unchanged (value/onChange/placeholder/members/rows/
// disabled) so existing call sites keep working.

const MENTION_TOKEN_RE = /@\[([^\]]+)\]\(([^)]+)\)/g

export interface MarkdownMember {
  id: string
  name?: string | null
  email?: string | null
}

// Toolbar action keys. Callers pick which buttons appear so that surfaces
// with different conventions (a Validation description vs a Discussion comment)
// only expose the actions that make sense in that context.
export type MdAction =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'heading'
  | 'quote'
  | 'code'
  | 'codeblock'
  | 'link'
  | 'list'
  | 'ol'
  | 'task'
  | 'table'
  | 'mention'

export const MD_ACTIONS_FULL: MdAction[] = [
  'bold', 'italic', 'strike', 'heading', 'quote', 'code', 'codeblock', 'link',
  'list', 'ol', 'task', 'table', 'mention',
]

// Compact set for narrative fields like Validation item description: no
// task-list (a description is not a checklist) and no table (descriptions
// are prose, not data).
export const MD_ACTIONS_COMPACT: MdAction[] = [
  'bold', 'italic', 'strike', 'heading', 'quote', 'code', 'link', 'list', 'ol', 'mention',
]

// Minimal set for inline notes (criterion notes, sign-off comments).
export const MD_ACTIONS_INLINE: MdAction[] = [
  'bold', 'italic', 'code', 'link', 'mention',
]

interface Props {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  /** Optional mentionable users; used by preview to resolve display names. */
  members?: MarkdownMember[]
  /** Rows for the textarea. Default 4. */
  rows?: number
  /** Disabled — render preview only. */
  disabled?: boolean
  /** Which toolbar actions to render. Defaults to MD_ACTIONS_FULL. */
  actions?: MdAction[]
  /** Initial tab. Defaults to write. Useful for read-mostly fields. */
  defaultTab?: 'write' | 'preview'
  /** Minimum textarea height in px. Default 96. */
  minHeight?: number
}

export default function MarkdownEditor({
  value,
  onChange,
  placeholder,
  members = [],
  rows = 4,
  disabled = false,
  actions = MD_ACTIONS_FULL,
  defaultTab = 'write',
  minHeight = 96,
}: Props) {
  const [tab, setTab] = useState<'write' | 'preview'>(defaultTab)
  const actionSet = useMemo(() => new Set(actions), [actions])
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  // Mention popover state. `mentionQuery` is the partial text after the
  // most-recent '@' before the caret. null = no active mention.
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionAnchor, setMentionAnchor] = useState<number>(-1)
  const [mentionIndex, setMentionIndex] = useState(0)

  const mentionMatches = useMemo(() => {
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

  // --- Selection / caret helpers ----------------------------------------

  const getSel = (): { start: number; end: number } => {
    const ta = textareaRef.current
    if (!ta) return { start: value.length, end: value.length }
    return { start: ta.selectionStart ?? 0, end: ta.selectionEnd ?? 0 }
  }

  // Wrap the current selection with `before` and `after`. If nothing is
  // selected, drop a token and place the caret between before/after so the
  // user can type immediately.
  const wrapSelection = (before: string, after: string = before, placeholderText = '') => {
    if (disabled) return
    const { start, end } = getSel()
    const selected = value.slice(start, end)
    const insertion = selected || placeholderText
    const next = value.slice(0, start) + before + insertion + after + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      const ta = textareaRef.current
      if (!ta) return
      ta.focus()
      const caretStart = start + before.length
      const caretEnd = caretStart + insertion.length
      ta.setSelectionRange(caretStart, caretEnd)
    })
  }

  // Prefix each selected line with `prefix`. If nothing is selected, prefix
  // the current line. Used by lists, blockquote, headings.
  const prefixLines = (prefix: string | ((index: number) => string)) => {
    if (disabled) return
    const { start, end } = getSel()
    // Expand selection to whole lines so we don't break mid-line markdown.
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    const lineEndIdx = value.indexOf('\n', end)
    const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx
    const block = value.slice(lineStart, lineEnd)
    const lines = block.split('\n')
    const next = lines
      .map((l, i) => (typeof prefix === 'function' ? prefix(i) : prefix) + l)
      .join('\n')
    const updated = value.slice(0, lineStart) + next + value.slice(lineEnd)
    onChange(updated)
    requestAnimationFrame(() => {
      const ta = textareaRef.current
      if (!ta) return
      ta.focus()
      ta.setSelectionRange(lineStart, lineStart + next.length)
    })
  }

  // Insert a block (eg. fenced code, table) at the caret on its own line(s).
  const insertBlock = (block: string) => {
    if (disabled) return
    const { start, end } = getSel()
    // Ensure block starts on a fresh line.
    const needLeading = start > 0 && value[start - 1] !== '\n'
    const needTrailing = end < value.length && value[end] !== '\n'
    const insertion = (needLeading ? '\n' : '') + block + (needTrailing ? '\n' : '')
    const next = value.slice(0, start) + insertion + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      const ta = textareaRef.current
      if (!ta) return
      ta.focus()
      const caret = start + insertion.length
      ta.setSelectionRange(caret, caret)
    })
  }

  // --- Mention detection -----------------------------------------------

  const detectMention = (next: string, caret: number) => {
    const upto = next.slice(0, caret)
    const at = upto.lastIndexOf('@')
    if (at < 0) {
      setMentionQuery(null)
      return
    }
    // Trigger only when '@' starts a token (start-of-string or after
    // whitespace) so we don't open the popover inside emails.
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
    const m = mentionMatches[idx]
    const ta = textareaRef.current
    if (!m || mentionAnchor < 0 || !ta) return
    const display = (m.name ?? m.email ?? 'user').trim() || 'user'
    const before = value.slice(0, mentionAnchor)
    const afterCaret = value.slice(ta.selectionStart ?? mentionAnchor)
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

  // --- Render -----------------------------------------------------------

  return (
    <div
      style={{
        border: '1px solid var(--pv-line)',
        borderRadius: 4,
        background: 'var(--pv-bg)',
        overflow: 'visible',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          borderBottom: '1px solid var(--pv-line)',
          background: 'var(--pv-surface-soft)',
        }}
      >
        <button
          type="button"
          onClick={() => setTab('write')}
          disabled={disabled}
          style={tabStyle(tab === 'write')}
        >
          Write
        </button>
        <button
          type="button"
          onClick={() => setTab('preview')}
          style={tabStyle(tab === 'preview')}
        >
          Preview
        </button>
        <span style={{ flex: 1 }} />
        <span
          style={{
            fontSize: 10,
            color: 'var(--pv-fg-3)',
            paddingRight: 8,
            letterSpacing: '0.02em',
          }}
          title="Markdown supported: **bold**, *italic*, ~~strike~~, # heading, > quote, `code`, ``` blocks, - / 1. / - [ ] lists, tables, [link](url), REQ-001 refs, @mentions."
        >
          Markdown
        </span>
      </div>

      {tab === 'write' && !disabled && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 2,
            padding: '4px 6px',
            borderBottom: '1px solid var(--pv-line)',
            background: 'var(--pv-surface-soft)',
          }}
        >
          {actionSet.has('bold') && (
            <TBtn title="Bold (Ctrl+B)" onClick={() => wrapSelection('**', '**', 'bold')}>
              <Bold size={14} />
            </TBtn>
          )}
          {actionSet.has('italic') && (
            <TBtn title="Italic (Ctrl+I)" onClick={() => wrapSelection('_', '_', 'italic')}>
              <Italic size={14} />
            </TBtn>
          )}
          {actionSet.has('strike') && (
            <TBtn title="Strikethrough" onClick={() => wrapSelection('~~', '~~', 'strike')}>
              <Strikethrough size={14} />
            </TBtn>
          )}
          {(actionSet.has('heading') || actionSet.has('quote') || actionSet.has('code') || actionSet.has('codeblock') || actionSet.has('link')) && <TSep />}
          {actionSet.has('heading') && (
            <TBtn title="Heading" onClick={() => prefixLines('## ')}>
              <Heading size={14} />
            </TBtn>
          )}
          {actionSet.has('quote') && (
            <TBtn title="Quote" onClick={() => prefixLines('> ')}>
              <Quote size={14} />
            </TBtn>
          )}
          {actionSet.has('code') && (
            <TBtn title="Inline code" onClick={() => wrapSelection('`', '`', 'code')}>
              <Code size={14} />
            </TBtn>
          )}
          {actionSet.has('codeblock') && (
            <TBtn title="Code block" onClick={() => insertBlock('```\ncode\n```')}>
              <Code2 size={14} />
            </TBtn>
          )}
          {actionSet.has('link') && (
            <TBtn
              title="Link"
              onClick={() => {
                const url = window.prompt('URL:', 'https://') ?? ''
                if (!url) return
                wrapSelection('[', `](${url})`, 'link text')
              }}
            >
              <LinkIcon size={14} />
            </TBtn>
          )}
          {(actionSet.has('list') || actionSet.has('ol') || actionSet.has('task')) && <TSep />}
          {actionSet.has('list') && (
            <TBtn title="Bulleted list" onClick={() => prefixLines('- ')}>
              <List size={14} />
            </TBtn>
          )}
          {actionSet.has('ol') && (
            <TBtn title="Numbered list" onClick={() => prefixLines((i) => `${i + 1}. `)}>
              <ListOrdered size={14} />
            </TBtn>
          )}
          {actionSet.has('task') && (
            <TBtn title="Task list" onClick={() => prefixLines('- [ ] ')}>
              <CheckSquare size={14} />
            </TBtn>
          )}
          {actionSet.has('table') && <TSep />}
          {actionSet.has('table') && (
            <TBtn
              title="Table"
              onClick={() =>
                insertBlock('| Column | Column |\n| --- | --- |\n| Cell | Cell |')
              }
            >
              <Table size={14} />
            </TBtn>
          )}
          {actionSet.has('mention') && <TSep />}
          {actionSet.has('mention') && (
            <TBtn
              title="Mention a teammate"
              onClick={() => {
                const ta = textareaRef.current
                if (!ta) return
                const { start } = getSel()
                const needSpace = start > 0 && !/\s/.test(value[start - 1] ?? '')
                const insert = `${needSpace ? ' ' : ''}@`
                const next = value.slice(0, start) + insert + value.slice(start)
                onChange(next)
                requestAnimationFrame(() => {
                  const caret = start + insert.length
                  ta.focus()
                  ta.setSelectionRange(caret, caret)
                  detectMention(next, caret)
                })
              }}
            >
              <span style={{ fontFamily: 'var(--pv-font-mono)', fontSize: 12, fontWeight: 600 }}>@</span>
            </TBtn>
          )}
        </div>
      )}

      {tab === 'write' ? (
        <div style={{ position: 'relative' }}>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              const v = e.target.value
              onChange(v)
              detectMention(v, e.target.selectionStart ?? v.length)
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
                  setMentionIndex(
                    (i) => (i - 1 + mentionMatches.length) % mentionMatches.length,
                  )
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
              if ((e.metaKey || e.ctrlKey) && (e.key === 'b' || e.key === 'B')) {
                e.preventDefault()
                wrapSelection('**', '**', 'bold')
                return
              }
              if ((e.metaKey || e.ctrlKey) && (e.key === 'i' || e.key === 'I')) {
                e.preventDefault()
                wrapSelection('_', '_', 'italic')
                return
              }
              // Tab / Shift+Tab — indent / outdent the selected lines by two
              // spaces. Multi-line selection is preserved. When no selection
              // and the caret is on an empty line, simply insert two spaces
              // (so Tab still works as expected for short indent).
              if (e.key === 'Tab') {
                e.preventDefault()
                const ta = textareaRef.current
                if (!ta) return
                const start = ta.selectionStart ?? 0
                const end = ta.selectionEnd ?? 0
                const lineStart = value.lastIndexOf('\n', start - 1) + 1
                const lineEndIdx = value.indexOf('\n', end)
                const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx
                const block = value.slice(lineStart, lineEnd)
                if (e.shiftKey) {
                  const out = block
                    .split('\n')
                    .map((l) => (l.startsWith('  ') ? l.slice(2) : l.startsWith('\t') ? l.slice(1) : l))
                    .join('\n')
                  const next = value.slice(0, lineStart) + out + value.slice(lineEnd)
                  onChange(next)
                  requestAnimationFrame(() => {
                    ta.focus()
                    ta.setSelectionRange(lineStart, lineStart + out.length)
                  })
                } else {
                  const out = block.split('\n').map((l) => '  ' + l).join('\n')
                  const next = value.slice(0, lineStart) + out + value.slice(lineEnd)
                  onChange(next)
                  requestAnimationFrame(() => {
                    ta.focus()
                    ta.setSelectionRange(lineStart, lineStart + out.length)
                  })
                }
                return
              }
            }}
            disabled={disabled}
            rows={rows}
            placeholder={placeholder}
            style={{
              width: '100%',
              minHeight,
              border: 0,
              outline: 0,
              padding: 8,
              fontSize: 13,
              lineHeight: 1.5,
              background: 'transparent',
              color: 'var(--pv-fg)',
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
          {mentionQuery !== null && mentionMatches.length > 0 && (
            <div
              role="listbox"
              aria-label="Mention teammate"
              style={{
                position: 'absolute',
                top: '100%',
                left: 8,
                zIndex: 50,
                minWidth: 220,
                maxWidth: 320,
                background: 'var(--pv-bg)',
                border: '1px solid var(--pv-line)',
                borderRadius: 4,
                boxShadow: '0 6px 24px rgba(15,20,25,0.12)',
                padding: 4,
                fontSize: 12,
                marginTop: 2,
              }}
            >
              {mentionMatches.map((m, i) => {
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
        </div>
      ) : (
        <div
          style={{
            padding: 8,
            minHeight,
            fontSize: 13,
            lineHeight: 1.5,
            color: 'var(--pv-fg)',
          }}
        >
          {value.trim() ? (
            <MarkdownPreview source={value} members={members} />
          ) : (
            <span style={{ color: 'var(--pv-fg-3)', fontStyle: 'italic' }}>
              Nothing to preview yet.
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// Toolbar primitives. Kept tiny so the editor file stays readable.
function TBtn({
  title,
  onClick,
  children,
}: {
  title: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 24,
        minWidth: 24,
        padding: '0 4px',
        background: 'transparent',
        border: '1px solid transparent',
        borderRadius: 3,
        cursor: 'pointer',
        color: 'var(--pv-fg-2)',
      }}
      onMouseDown={(e) => e.preventDefault()} // keep textarea focused
      onMouseOver={(e) => {
        e.currentTarget.style.background = 'var(--pv-bg)'
        e.currentTarget.style.borderColor = 'var(--pv-line)'
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.borderColor = 'transparent'
      }}
    >
      {children}
    </button>
  )
}

function TSep() {
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-block',
        width: 1,
        height: 16,
        background: 'var(--pv-line)',
        margin: '0 2px',
      }}
    />
  )
}

function memberInitials(m: MarkdownMember): string {
  const src = (m.name && m.name.trim()) || (m.email ? m.email.split('@')[0] : '?')
  return (
    src
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? 'var(--pv-bg)' : 'transparent',
    color: active ? 'var(--pv-fg)' : 'var(--pv-fg-3)',
    border: 0,
    borderBottom: active ? '2px solid var(--pv-fg)' : '2px solid transparent',
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: active ? 600 : 500,
    fontFamily: 'inherit',
    cursor: 'pointer',
    height: 28,
  }
}

// ---------------------------------------------------------------------------
// Markdown renderer — pipeline:
//   1. Pre-process source: turn @[Name](userId) tokens into a sentinel that
//      survives the marked parse (so mentions render even inside bold/em).
//   2. marked → HTML (GFM enabled: tables, task-lists, autolinks, strikethrough).
//   3. DOMPurify sanitise — drops scripts, event handlers, javascript: URLs.
//      Sanitised HTML is then walked with DOMParser; each text node is
//      replaced by React nodes that may include EntityRefChip / mention chips.
//
// No HTML string ever reaches dangerouslySetInnerHTML.

interface PreviewProps {
  source: string
  members: MarkdownMember[]
}

// Sentinel format chosen so it survives Markdown inline parsing (no special
// characters), is unlikely to appear in real text, and round-trips through
// DOMPurify untouched.
const MENTION_SENTINEL_OPEN = 'MENTIONOPEN9F2E'
const MENTION_SENTINEL_CLOSE = 'MENTIONCLOSE9F2E'

function preProcessMentions(src: string): string {
  return src.replace(MENTION_TOKEN_RE, (_full, name: string, userId: string) => {
    // Encode payload as base64 to keep the sentinel ASCII-only so it survives
    // any inline tokenisation that marked applies. `unescape(encodeURIComponent)`
    // handles non-ASCII names safely before btoa.
    const payload = unescape(encodeURIComponent(`${name}|${userId}`))
    const enc = window.btoa(payload)
    return `${MENTION_SENTINEL_OPEN}${enc}${MENTION_SENTINEL_CLOSE}`
  })
}

function decodeSentinel(payload: string): { name: string; userId: string } | null {
  try {
    const raw = decodeURIComponent(escape(window.atob(payload)))
    const [name, userId] = raw.split('|')
    if (!name || !userId) return null
    return { name, userId }
  } catch {
    return null
  }
}

export function MarkdownPreview({ source, members }: PreviewProps) {
  const memberById = useMemo(
    () => new Map(members.map((m) => [m.id, m])),
    [members],
  )
  const rendered = useMemo<ReactNode>(() => {
    const pre = preProcessMentions(source)
    const html = marked.parse(pre, { gfm: true, breaks: false, async: false }) as string
    const safe = DOMPurify.sanitize(html, {
      ADD_ATTR: ['target', 'rel'],
      FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'],
      FORBID_ATTR: ['onerror', 'onclick', 'onload'],
    })
    // Parse the sanitised HTML and walk it, swapping text nodes for React
    // nodes that include entity-ref chips and mention chips.
    const parser = new DOMParser()
    const doc = parser.parseFromString(`<div>${safe}</div>`, 'text/html')
    const root = doc.body.firstChild as HTMLElement | null
    if (!root) return null
    let keyCounter = 0
    const nextKey = () => `mdn-${keyCounter++}`
    const renderMentionChip = (name: string, userId: string): ReactNode => {
      const known = memberById.get(userId)
      const display = known?.name ?? known?.email ?? name
      return (
        <span
          key={nextKey()}
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
        </span>
      )
    }
    const decorateText = (text: string): ReactNode[] => {
      // Two-pass: first the base64 sentinel produced by preProcessMentions
      // (the normal path). Then a fallback scan for raw `@[Name](uuid)` so
      // any body that somehow reached the walker un-preprocessed still
      // renders as a chip instead of the raw markdown source.
      const out: ReactNode[] = []
      const reSentinel = new RegExp(
        `${MENTION_SENTINEL_OPEN}([A-Za-z0-9+/=]+)${MENTION_SENTINEL_CLOSE}`,
        'g',
      )
      let lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = reSentinel.exec(text)) !== null) {
        if (m.index > lastIndex) {
          out.push(...decorateRawMention(text.slice(lastIndex, m.index)))
        }
        const decoded = decodeSentinel(m[1])
        if (decoded) out.push(renderMentionChip(decoded.name, decoded.userId))
        lastIndex = m.index + m[0].length
      }
      if (lastIndex < text.length) {
        out.push(...decorateRawMention(text.slice(lastIndex)))
      }
      if (out.length === 0) out.push(...decorateRawMention(text))
      return out
    }
    // Fallback: detect literal `@[Name](uuid)` in a text node. Splits the
    // text and emits chips inline.
    const decorateRawMention = (text: string): ReactNode[] => {
      const out: ReactNode[] = []
      const re = /@\[([^\]]+)\]\(([^)]+)\)/g
      let lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = re.exec(text)) !== null) {
        if (m.index > lastIndex) out.push(...withEntityRefs(text.slice(lastIndex, m.index)))
        out.push(renderMentionChip(m[1], m[2]))
        lastIndex = m.index + m[0].length
      }
      if (lastIndex < text.length) out.push(...withEntityRefs(text.slice(lastIndex)))
      if (out.length === 0) out.push(...withEntityRefs(text))
      return out
    }
    const withEntityRefs = (text: string): ReactNode[] => {
      const segs = parseEntityRefs(text)
      return segs.map((s) =>
        s.type === 'text' ? (
          <span key={nextKey()}>{s.text}</span>
        ) : (
          <EntityRefChip key={nextKey()} prefix={s.prefix} number={s.number} />
        ),
      )
    }
    const toReact = (node: Node): ReactNode => {
      if (node.nodeType === Node.TEXT_NODE) {
        const t = node.textContent ?? ''
        return <>{decorateText(t)}</>
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return null
      const el = node as HTMLElement
      const tag = el.tagName.toLowerCase()
      const children: ReactNode[] = []
      el.childNodes.forEach((c) => {
        const r = toReact(c)
        if (r !== null) children.push(r)
      })
      // Map element to React. We only emit tags that DOMPurify already
      // sanitised, so the whitelist here is the set we want to style.
      const props: { [k: string]: unknown; key: string } = { key: nextKey() }
      if (tag === 'a') {
        const href = el.getAttribute('href') ?? '#'
        props.href = href
        if (href.startsWith('http')) {
          props.target = '_blank'
          props.rel = 'noreferrer'
        }
        props.style = { color: 'var(--pv-blue)' }
        return <a {...props}>{children}</a>
      }
      if (tag === 'code') {
        props.style = {
          background: 'var(--pv-surface-soft)',
          border: '1px solid var(--pv-line)',
          padding: '0 4px',
          borderRadius: 3,
          fontFamily: 'var(--pv-font-mono)',
          fontSize: 12,
        }
        return <code {...props}>{children}</code>
      }
      if (tag === 'pre') {
        props.style = {
          background: 'var(--pv-surface-soft)',
          border: '1px solid var(--pv-line)',
          padding: 8,
          borderRadius: 4,
          fontFamily: 'var(--pv-font-mono)',
          fontSize: 12,
          overflowX: 'auto',
          margin: '6px 0',
        }
        return <pre {...props}>{children}</pre>
      }
      if (tag === 'table') {
        props.style = { borderCollapse: 'collapse', margin: '6px 0', fontSize: 12 }
        return <table {...props}>{children}</table>
      }
      if (tag === 'th' || tag === 'td') {
        props.style = {
          border: '1px solid var(--pv-line)',
          padding: '4px 6px',
          textAlign: 'left',
        }
        return tag === 'th' ? <th {...props}>{children}</th> : <td {...props}>{children}</td>
      }
      if (tag === 'blockquote') {
        props.style = {
          borderLeft: '3px solid var(--pv-line)',
          margin: '4px 0',
          padding: '0 8px',
          color: 'var(--pv-fg-2)',
        }
        return <blockquote {...props}>{children}</blockquote>
      }
      if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') {
        const sizes: Record<string, number> = { h1: 20, h2: 18, h3: 16, h4: 15, h5: 14, h6: 13 }
        props.style = {
          fontSize: sizes[tag],
          fontWeight: 600,
          margin: '6px 0 2px',
          letterSpacing: '-0.01em',
        }
        switch (tag) {
          case 'h1': return <h1 {...props}>{children}</h1>
          case 'h2': return <h2 {...props}>{children}</h2>
          case 'h3': return <h3 {...props}>{children}</h3>
          case 'h4': return <h4 {...props}>{children}</h4>
          case 'h5': return <h5 {...props}>{children}</h5>
          default:   return <h6 {...props}>{children}</h6>
        }
      }
      if (tag === 'ul' || tag === 'ol') {
        props.style = { margin: '4px 0', paddingLeft: 20 }
        return tag === 'ul' ? <ul {...props}>{children}</ul> : <ol {...props}>{children}</ol>
      }
      if (tag === 'li') return <li {...props}>{children}</li>
      if (tag === 'p') {
        props.style = { margin: '4px 0' }
        return <p {...props}>{children}</p>
      }
      if (tag === 'strong' || tag === 'b') return <strong {...props}>{children}</strong>
      if (tag === 'em' || tag === 'i') return <em {...props}>{children}</em>
      if (tag === 'del' || tag === 's') return <del {...props}>{children}</del>
      if (tag === 'hr') return <hr key={nextKey()} />
      if (tag === 'br') return <br key={nextKey()} />
      // Fallback for any tag DOMPurify let through that is not styled here -
      // render as a generic span so structure is preserved without exposing
      // the original element type.
      return <span {...props}>{children}</span>
    }
    return <>{Array.from(root.childNodes).map((c) => toReact(c))}</>
  }, [source, memberById])

  return rendered
}
