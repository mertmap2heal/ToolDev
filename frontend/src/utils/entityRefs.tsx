import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { validationService } from '../services/validation.service'

// Cross-entity reference parser. Recognises plain-text IDs like REQ-001,
// VAL-002, PRM-014 etc. that engineers will naturally type in comments,
// criterion notes, descriptions, and sign-off notes. Each match becomes a
// clickable chip that deep-links to the owning module with the ID pre-filled
// in the page's search box.
//
// The standardisation we are committing to (see memory/feedback_markdown_editor.md):
// a single GFM-style syntax across every text input in the app. This file
// is the resolver half of that contract.

export interface EntityPrefix {
  prefix: string
  module: string
  /** Path under /projects/:projectId/ */
  path: string
  /** Search query parameter name used on the target page (default: q) */
  queryParam?: string
  /** Optional human label shown in the chip tooltip */
  label?: string
}

// Canonical prefix table. Keep alphabetised by prefix so adding a new module
// is a one-line change. Prefixes are matched case-insensitively against the
// uppercase form to support `req-001`, `REQ-001`, `Req-001` equally.
export const ENTITY_PREFIXES: EntityPrefix[] = [
  { prefix: 'CR',   module: 'change-requests',          path: 'change-requests',          label: 'Change Request' },
  { prefix: 'FUNC', module: 'functions',                path: 'functions',                label: 'System Function' },
  { prefix: 'IF',   module: 'interface-management',     path: 'interface-management',     label: 'Interface' },
  { prefix: 'ISS',  module: 'issues',                   path: 'issues',                   label: 'Issue' },
  { prefix: 'PBS',  module: 'product-breakdown-structure', path: 'product-breakdown-structure', label: 'PBS Node' },
  { prefix: 'PRM',  module: 'parameters',               path: 'parameters',               label: 'Parameter' },
  { prefix: 'REQ',  module: 'requirements',             path: 'requirements',             label: 'Requirement' },
  { prefix: 'RISK', module: 'risk-management',          path: 'risk-management',          label: 'Risk' },
  { prefix: 'TASK', module: 'tasks',                    path: 'tasks',                    label: 'Task' },
  { prefix: 'VAL',  module: 'validation',               path: 'validation',               label: 'Validation Item' },
  { prefix: 'VER',  module: 'verification',             path: 'verification',             label: 'Verification' },
]

const PREFIX_BY_NAME: Map<string, EntityPrefix> = new Map(
  ENTITY_PREFIXES.map((e) => [e.prefix, e]),
)

// Build a single regex covering every known prefix. Word boundaries on both
// sides so MYREQ-001 (false positive) does not match. Numeric tail >=1 digit
// to allow VAL-1 as well as VAL-001.
const PREFIX_ALT = ENTITY_PREFIXES.map((e) => e.prefix).join('|')
const ENTITY_REF_RE = new RegExp(`\\b(${PREFIX_ALT})-(\\d+)\\b`, 'gi')

export interface EntityRefMatch {
  type: 'ref'
  prefix: string
  number: string
  key: string
}
export interface TextSegment {
  type: 'text'
  text: string
}
export type ParsedSegment = EntityRefMatch | TextSegment

// Split free text into alternating text / ref segments. Empty input returns
// a single empty text segment so the caller can render unconditionally.
export function parseEntityRefs(input: string): ParsedSegment[] {
  if (!input) return [{ type: 'text', text: '' }]
  const out: ParsedSegment[] = []
  let lastIndex = 0
  // Reset lastIndex because regex literal /g is stateful across calls.
  ENTITY_REF_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = ENTITY_REF_RE.exec(input)) !== null) {
    const [whole, pfx, num] = m
    const upper = pfx.toUpperCase()
    if (!PREFIX_BY_NAME.has(upper)) continue
    if (m.index > lastIndex) {
      out.push({ type: 'text', text: input.slice(lastIndex, m.index) })
    }
    out.push({ type: 'ref', prefix: upper, number: num, key: `${upper}-${num}` })
    lastIndex = m.index + whole.length
  }
  if (lastIndex < input.length) {
    out.push({ type: 'text', text: input.slice(lastIndex) })
  }
  if (out.length === 0) out.push({ type: 'text', text: input })
  return out
}

interface EntityRefChipProps {
  prefix: string
  number: string
  /** Override the projectId from the URL (e.g. for cross-project linking) */
  projectId?: string
}

export function EntityRefChip({ prefix, number, projectId: projectIdOverride }: EntityRefChipProps) {
  const params = useParams<{ projectId: string }>()
  const projectId = projectIdOverride ?? params.projectId
  const entity = PREFIX_BY_NAME.get(prefix.toUpperCase())
  const key = `${prefix.toUpperCase()}-${number}`
  // Hover state declared unconditionally so hook count stays constant whether
  // the prefix resolves or not (cf. the drawer rules-of-hooks fix).
  const [hovering, setHovering] = useState(false)
  const upperPrefix = prefix.toUpperCase()

  // For validation items we can lazily resolve the chip to a real backend
  // record using the existing list endpoint with `search`. Other modules
  // would need their own resolver; we add VAL today and leave the others as
  // plain links with a generic title until each module exposes a search.
  const isVal = upperPrefix === 'VAL'
  const { data: preview } = useQuery({
    queryKey: ['entity-ref-preview', 'VAL', projectId, key],
    enabled: !!projectId && isVal && hovering,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!projectId) return null
      const res = await validationService.list(projectId, { search: key })
      if (!res.success || !res.data) return null
      return res.data.find((i) => i.key === key) ?? null
    },
  })

  if (!entity || !projectId) {
    return (
      <span
        style={{
          fontFamily: 'var(--pv-font-mono, monospace)',
          background: 'var(--pv-surface-soft, #f3f3f3)',
          border: '1px solid var(--pv-line, #e0e0e0)',
          padding: '0 4px',
          borderRadius: 3,
          fontSize: 12,
        }}
      >
        {key}
      </span>
    )
  }

  const queryParam = entity.queryParam ?? 'q'
  const to = `/projects/${projectId}/${entity.path}?${queryParam}=${encodeURIComponent(key)}`
  // Default tooltip; if we have a preview, swap it for a richer text.
  const tooltip = preview
    ? `${preview.title} — ${preview.status}`
    : `Open ${entity.label ?? entity.module}: ${key}`
  return (
    <span
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <Link
        to={to}
        title={tooltip}
        style={{
          display: 'inline-flex',
          alignItems: 'baseline',
          fontFamily: 'var(--pv-font-mono, monospace)',
          background: 'var(--pv-blue-tint, rgba(43,108,176,0.12))',
          color: 'var(--pv-blue-ink, #1e4778)',
          border: '1px solid var(--pv-blue-line, rgba(43,108,176,0.25))',
          padding: '0 4px',
          borderRadius: 3,
          fontSize: 12,
          textDecoration: 'none',
        }}
      >
        {key}
      </Link>
      {hovering && preview && (
        <span
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 4px)',
            left: 0,
            zIndex: 50,
            minWidth: 220,
            maxWidth: 320,
            background: 'var(--pv-bg, #fff)',
            color: 'var(--pv-fg, #111)',
            border: '1px solid var(--pv-line, #e0e0e0)',
            borderRadius: 4,
            padding: '6px 8px',
            fontSize: 11,
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            whiteSpace: 'normal',
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{preview.title}</div>
          <div style={{ color: 'var(--pv-fg-3, #888)', fontFamily: 'var(--pv-font-mono, monospace)' }}>
            {entity.label} · {preview.status}
          </div>
        </span>
      )}
    </span>
  )
}

interface RenderProps {
  text: string
  /** Optional override projectId for cross-project rendering */
  projectId?: string
}

// Plain renderer — alternates plain text and clickable chips. Whitespace and
// newlines are preserved by the caller's container styling.
export function RenderWithEntityRefs({ text, projectId }: RenderProps) {
  const segments = parseEntityRefs(text)
  return (
    <>
      {segments.map((s, i) =>
        s.type === 'text' ? (
          <span key={i}>{s.text}</span>
        ) : (
          <EntityRefChip key={i} prefix={s.prefix} number={s.number} projectId={projectId} />
        ),
      )}
    </>
  )
}
