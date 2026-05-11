import { useState, type ReactNode } from 'react'
import { parseEntityRefs, EntityRefChip } from '../../utils/entityRefs'

// Markdown editor — first cut of the standardised text input promised in
// memory/feedback_markdown_editor.md.
//
// Goals (v1):
//   - One component used everywhere we have multi-line text (descriptions,
//     notes, sign-off comments later).
//   - Plain-text Markdown source — what the user sees in Edit is what is
//     stored on the server. No hidden HTML, no rich-text serialisation.
//   - GFM-style mini-preview without bringing in a markdown parser dep
//     (CLAUDE.md rule 2: ask before adding deps). We render a deliberately
//     small subset; a real parser can swap in later.
//   - Cross-entity link chips (REQ-/VAL-/PRM-/VER-/CR-/...) inline.
//   - @[Name](userId) mentions rendered as chips.
//
// Out of scope for v1: tables, footnotes, images, blockquotes, fenced code
// blocks, paste-image upload. Those are planned for a follow-up cycle when
// a real Markdown parser is sanctioned.

const MENTION_TOKEN_RE = /@\[([^\]]+)\]\(([^)]+)\)/g

export interface MarkdownMember {
  id: string
  name?: string | null
  email?: string | null
}

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
}

export default function MarkdownEditor({
  value,
  onChange,
  placeholder,
  members = [],
  rows = 4,
  disabled = false,
}: Props) {
  const [tab, setTab] = useState<'write' | 'preview'>('write')

  return (
    <div
      style={{
        border: '1px solid var(--pv-line)',
        borderRadius: 4,
        background: 'var(--pv-bg)',
        overflow: 'hidden',
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
          title="Supports: **bold**, *italic*, `code`, # heading, - list, [text](url), REQ-001 etc., @[Name](userId)"
        >
          Markdown
        </span>
      </div>
      {tab === 'write' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={rows}
          placeholder={placeholder}
          style={{
            width: '100%',
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
      ) : (
        <div
          style={{
            padding: 8,
            minHeight: rows * 20,
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
// Minimal Markdown renderer — line-oriented. Each line is classified once
// (heading / list-item / blank / paragraph), then inline syntax is applied
// inside. NO third-party parser; safe by construction because we only emit
// React nodes and never set innerHTML.

interface PreviewProps {
  source: string
  members: MarkdownMember[]
}

function MarkdownPreview({ source, members }: PreviewProps) {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const out: ReactNode[] = []
  let listBuffer: ReactNode[] = []
  let para: string[] = []
  let key = 0

  const flushList = () => {
    if (listBuffer.length === 0) return
    out.push(<ul key={`ul-${key++}`} style={{ margin: '4px 0', paddingLeft: 20 }}>{listBuffer}</ul>)
    listBuffer = []
  }
  const flushPara = () => {
    if (para.length === 0) return
    const text = para.join(' ')
    out.push(
      <p key={`p-${key++}`} style={{ margin: '4px 0' }}>
        {renderInline(text, members, key++)}
      </p>,
    )
    para = []
  }

  for (const raw of lines) {
    const line = raw
    if (/^\s*$/.test(line)) {
      flushPara()
      flushList()
      continue
    }
    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      flushPara()
      flushList()
      const level = heading[1].length
      const inner = renderInline(heading[2], members, key++)
      const sizes = [20, 18, 16, 15, 14, 13]
      out.push(
        <div
          key={`h-${key++}`}
          style={{
            fontSize: sizes[Math.min(level - 1, sizes.length - 1)],
            fontWeight: 600,
            margin: '6px 0 2px',
            letterSpacing: '-0.01em',
          }}
        >
          {inner}
        </div>,
      )
      continue
    }
    const list = line.match(/^\s*[-*]\s+(.+)$/)
    if (list) {
      flushPara()
      listBuffer.push(
        <li key={`li-${key++}`} style={{ margin: '1px 0' }}>
          {renderInline(list[1], members, key++)}
        </li>,
      )
      continue
    }
    para.push(line.trim())
  }
  flushPara()
  flushList()

  return <>{out}</>
}

// Inline markdown: bold, italic, inline code, link, mention, entity-ref.
// Processed in a single left-to-right scan via a combined regex with named
// alternatives. Each match flushes the preceding plain-text slice through
// the entity-ref + mention pipeline so e.g. **REQ-001** still renders as
// a bold link.
function renderInline(text: string, members: MarkdownMember[], baseKey: number): ReactNode[] {
  const out: ReactNode[] = []
  // Order matters: longer / more-specific tokens first to avoid e.g. ** matching as two *.
  const RE = /(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(\*[^*\n]+\*)|(_[^_\n]+_)|(`[^`\n]+`)|(\[[^\]]+\]\([^)]+\))/g
  let lastIndex = 0
  let m: RegExpExecArray | null
  let k = baseKey
  while ((m = RE.exec(text)) !== null) {
    if (m.index > lastIndex) {
      out.push(...renderPlainSlice(text.slice(lastIndex, m.index), members, k++))
    }
    const tok = m[0]
    if ((tok.startsWith('**') && tok.endsWith('**')) || (tok.startsWith('__') && tok.endsWith('__'))) {
      out.push(
        <strong key={`b-${k++}`}>
          {renderPlainSlice(tok.slice(2, -2), members, k++)}
        </strong>,
      )
    } else if ((tok.startsWith('*') && tok.endsWith('*')) || (tok.startsWith('_') && tok.endsWith('_'))) {
      out.push(
        <em key={`i-${k++}`}>
          {renderPlainSlice(tok.slice(1, -1), members, k++)}
        </em>,
      )
    } else if (tok.startsWith('`') && tok.endsWith('`')) {
      out.push(
        <code
          key={`c-${k++}`}
          style={{
            background: 'var(--pv-surface-soft)',
            border: '1px solid var(--pv-line)',
            padding: '0 4px',
            borderRadius: 3,
            fontFamily: 'var(--pv-font-mono)',
            fontSize: 12,
          }}
        >
          {tok.slice(1, -1)}
        </code>,
      )
    } else if (tok.startsWith('[')) {
      const link = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (link) {
        const [, label, href] = link
        // Only allow http(s) and relative paths; reject javascript: and data:.
        const safe = /^(https?:\/\/|\/|#)/i.test(href)
        if (safe) {
          out.push(
            <a
              key={`a-${k++}`}
              href={href}
              target={href.startsWith('http') ? '_blank' : undefined}
              rel={href.startsWith('http') ? 'noreferrer' : undefined}
              style={{ color: 'var(--pv-blue)' }}
            >
              {label}
            </a>,
          )
        } else {
          out.push(<span key={`x-${k++}`}>{tok}</span>)
        }
      } else {
        out.push(<span key={`x-${k++}`}>{tok}</span>)
      }
    }
    lastIndex = m.index + tok.length
  }
  if (lastIndex < text.length) {
    out.push(...renderPlainSlice(text.slice(lastIndex), members, k++))
  }
  if (out.length === 0) out.push(...renderPlainSlice(text, members, k++))
  return out
}

// Plain-text inside an already-inline-decoded slice. We still need to detect
// mentions and entity refs here because bold / italic spans can wrap them.
function renderPlainSlice(text: string, members: MarkdownMember[], baseKey: number): ReactNode[] {
  const memberById = new Map(members.map((m) => [m.id, m]))
  const out: ReactNode[] = []
  let lastIndex = 0
  const re = new RegExp(MENTION_TOKEN_RE.source, 'g')
  let m: RegExpExecArray | null
  let k = baseKey
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) {
      out.push(...renderWithEntityRefs(text.slice(lastIndex, m.index), k++))
    }
    const [, name, userId] = m
    const known = memberById.get(userId)
    const display = known?.name ?? known?.email ?? name
    out.push(
      <span
        key={`m-${k++}`}
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
    lastIndex = m.index + m[0].length
  }
  if (lastIndex < text.length) {
    out.push(...renderWithEntityRefs(text.slice(lastIndex), k++))
  }
  if (out.length === 0) out.push(...renderWithEntityRefs(text, k++))
  return out
}

function renderWithEntityRefs(text: string, baseKey: number): ReactNode[] {
  const segs = parseEntityRefs(text)
  return segs.map((s, i) =>
    s.type === 'text' ? (
      <span key={`t-${baseKey}-${i}`}>{s.text}</span>
    ) : (
      <EntityRefChip key={`r-${baseKey}-${i}`} prefix={s.prefix} number={s.number} />
    ),
  )
}
