import { useMemo, useState, type ReactNode } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
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

function MarkdownPreview({ source, members }: PreviewProps) {
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
    const decorateText = (text: string): ReactNode[] => {
      const out: ReactNode[] = []
      // First split out mention sentinels.
      const reSentinel = new RegExp(
        `${MENTION_SENTINEL_OPEN}([A-Za-z0-9+/=]+)${MENTION_SENTINEL_CLOSE}`,
        'g',
      )
      let lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = reSentinel.exec(text)) !== null) {
        if (m.index > lastIndex) {
          out.push(...withEntityRefs(text.slice(lastIndex, m.index)))
        }
        const decoded = decodeSentinel(m[1])
        if (decoded) {
          const known = memberById.get(decoded.userId)
          const display = known?.name ?? known?.email ?? decoded.name
          out.push(
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
            </span>,
          )
        }
        lastIndex = m.index + m[0].length
      }
      if (lastIndex < text.length) {
        out.push(...withEntityRefs(text.slice(lastIndex)))
      }
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
